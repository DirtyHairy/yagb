import { AddressingMode, Condition, Instruction, Operation, decodeInstruction } from './instruction';
import { Interrupt, irq } from './interrupt';
import { hex16, hex8 } from '../helper/format';

import { Bus } from './bus';
import { Clock } from './clock';
import { Event } from 'microevent.ts';
import { Mode } from './mode';
import { Savestate } from './savestate';
import { System } from './system';

export const enum r8 {
    f = 0,
    a = 1,
    c = 2,
    b = 3,
    e = 4,
    d = 5,
    l = 6,
    h = 7,
}

export const enum r16 {
    af = 0,
    bc = 1,
    de = 2,
    hl = 3,
    sp = 4,
}

export const enum flag {
    z = 0x80,
    n = 0x40,
    h = 0x20,
    c = 0x10,
}

export interface CpuState {
    r8: Uint8Array;
    r16: Uint16Array;
    p: number;
    interruptsEnabled: boolean;
    pendingEi: boolean;
    halt: boolean;
}

const SAVESTATE_VERSION = 0x00;

export function extendSign8(x: number): number {
    return (x & 0x7f) - (x & 0x80);
}

function getIrqVector(interrupt: irq): number {
    let handler = 0x40;

    for (let i = 1; i <= irq.joypad; i <<= 1) {
        if (i === interrupt) return handler;
        handler += 0x08;
    }

    throw new Error(`invalid irq ${hex8(interrupt)}`);
}

export class Cpu {
    constructor(private mode: Mode, private bus: Bus, private clock: Clock, private interrupt: Interrupt, private system: System) {
        const r16 = new Uint16Array(5);
        const r8 = new Uint8Array(r16.buffer);

        this.state = {
            r8,
            r16,
            p: 0x00,
            interruptsEnabled: false,
            halt: false,
            pendingEi: false,
        };
    }

    reset() {
        this.state.r16[r16.af] = this.mode === Mode.cgb ? 0x11b0 : 0x01b0;
        this.state.r16[r16.bc] = 0x0013;
        this.state.r16[r16.de] = 0x00d8;
        this.state.r16[r16.hl] = 0x014d;
        this.state.p = 0x0100;
        this.state.r16[r16.sp] = 0xfffe;
        this.state.interruptsEnabled = false;
        this.state.halt = false;
        this.state.pendingEi = false;
    }

    save(savestate: Savestate): void {
        const flags = (this.state.interruptsEnabled ? 0x01 : 0x00) | (this.state.halt ? 0x02 : 0x00) | (this.state.pendingEi ? 0x04 : 0x00);

        savestate.startChunk(SAVESTATE_VERSION).writeBuffer(this.state.r8).write16(this.state.p).write16(flags);
    }

    load(savestate: Savestate): void {
        savestate.validateChunk(SAVESTATE_VERSION);

        this.state.r8.set(savestate.readBuffer(this.state.r8.length));
        this.state.p = savestate.read16();

        const flags = savestate.read16();
        this.state.interruptsEnabled = (flags & 0x01) !== 0;
        this.state.halt = (flags & 0x02) !== 0;
        this.state.pendingEi = (flags & 0x04) !== 0;
    }

    step(count: number): number {
        this.clock.resetCpuCycles();

        for (let i = 0; i < count; i++) {
            if (this.system.isTrap) break;

            if (!this.handleInterrupts()) {
                this.dispatch(decodeInstruction(this.bus, this.state.p));
            }

            if (!this.state.halt) this.onAfterExecute.dispatch(this.state.p);
        }

        return this.clock.cpuCycles;
    }

    run(cyclesGoal: number): number {
        this.clock.resetCpuCycles();

        while (this.clock.cpuCycles < cyclesGoal) {
            if (this.system.isTrap) break;

            if (!this.handleInterrupts()) {
                this.dispatch(decodeInstruction(this.bus, this.state.p));
            }

            if (!this.state.halt) this.onAfterExecute.dispatch(this.state.p);
        }

        return this.clock.cpuCycles;
    }

    printState(): string {
        return `af=${hex16(this.state.r16[r16.af])} bc=${hex16(this.state.r16[r16.bc])} de=${hex16(this.state.r16[r16.de])} hl=${hex16(
            this.state.r16[r16.hl]
        )} s=${hex16(this.state.r16[r16.sp])} p=${hex16(this.state.p)} interrupts=${this.state.interruptsEnabled ? 'on' : 'off'}`;
    }

    private handleInterrupts(): boolean {
        if (this.interrupt.isPending()) this.state.halt = false;

        if (!this.state.interruptsEnabled) return false;

        const irq = this.interrupt.getNext();
        if (!irq) return false;

        this.interrupt.clear(irq);
        this.state.interruptsEnabled = false;

        this.stackPush16(this.state.p);

        this.state.p = getIrqVector(irq);
        this.tick(5);

        return true;
    }

    private stackPush16(value: number): void {
        value = value & 0xffff;
        this.state.r16[r16.sp] -= 2;
        this.bus.write16(this.state.r16[r16.sp], value);
    }

    private stackPop16(): number {
        const value = this.bus.read16(this.state.r16[r16.sp]) & 0xffff;
        this.state.r16[r16.sp] = (this.state.r16[r16.sp] + 2) & 0xffff;

        return value;
    }

    private dispatch(instruction: Instruction): void {
        if (this.state.halt) {
            this.tick(1);
            return;
        }

        this.onExecute.dispatch(this.state.p);

        switch (instruction.op) {
            case Operation.adc:
                return this.opAdc(instruction);

            case Operation.add:
                return this.opAdd(instruction);

            case Operation.add16:
                return this.opAdd16(instruction);

            case Operation.add16s:
                return this.opAdd16s(instruction);

            case Operation.and:
                return this.opAnd(instruction);

            case Operation.call:
                return this.opCall(instruction);

            case Operation.cb:
                this.system.trap('can not call CB');

                return;

            case Operation.ccf:
                return this.opCcf(instruction);

            case Operation.cp:
                return this.opCp(instruction);

            case Operation.cpl:
                return this.opCpl(instruction);

            case Operation.daa:
                return this.opDaa(instruction);

            case Operation.dec:
                return this.opDec(instruction);

            case Operation.dec16:
                return this.opDec16(instruction);

            case Operation.di:
                return this.opDi(instruction);

            case Operation.ei:
                return this.opEi(instruction);

            case Operation.halt:
                return this.opHalt(instruction);

            case Operation.inc:
                return this.opInc(instruction);

            case Operation.inc16:
                return this.opInc16(instruction);

            case Operation.jp:
                return this.opJp(instruction);

            case Operation.jr:
                return this.opJr(instruction);

            case Operation.ld:
                return this.opLd(instruction);

            case Operation.ldd:
                return this.opLdd(instruction);

            case Operation.ldi:
                return this.opLdi(instruction);

            case Operation.lds: {
                return this.opLds(instruction);
            }

            case Operation.nop:
                return this.opNop(instruction);

            case Operation.or:
                return this.opOr(instruction);

            case Operation.pop:
                return this.opPop(instruction);

            case Operation.push:
                return this.opPush(instruction);

            case Operation.ret:
                return this.opRet(instruction);

            case Operation.reti:
                return this.opReti(instruction);

            case Operation.rlca:
                return this.opRlca(instruction);

            case Operation.rla:
                return this.opRla(instruction);

            case Operation.rrca:
                return this.opRrca(instruction);

            case Operation.rra:
                return this.opRra(instruction);

            case Operation.sbc:
                return this.opSbc(instruction);

            case Operation.scf:
                return this.opScf(instruction);

            case Operation.stop:
                return this.opStop(instruction);

            case Operation.sub:
                return this.opSub(instruction);

            case Operation.xor:
                return this.opXor(instruction);

            case Operation.bit:
                return this.opBit(instruction);

            case Operation.set:
                return this.opSet(instruction);

            case Operation.res:
                return this.opRes(instruction);

            case Operation.swap:
                return this.opSwap(instruction);

            case Operation.rlc:
                return this.opRlc(instruction);

            case Operation.rl:
                return this.opRl(instruction);

            case Operation.rrc:
                return this.opRrc(instruction);

            case Operation.rr:
                return this.opRr(instruction);

            case Operation.sla:
                return this.opSla(instruction);

            case Operation.srl:
                return this.opSrl(instruction);

            case Operation.sra:
                return this.opSra(instruction);

            case Operation.rst:
                return this.opRst(instruction);

            default:
                this.system.trap(`invalid instruction ${hex8(instruction.opcode)} at ${hex16(this.state.p)}`);
        }
    }

    private opAdc(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand1 = this.getArg1(instruction);
        const operand2 = this.getArg2(instruction);
        const flagc = (this.state.r8[r8.f] & flag.c) >>> 4;
        const result = operand1 + operand2 + flagc;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
                ((result & 0xff) === 0 ? flag.z : 0x00) |
                ((((operand1 & 0xf) + (operand2 & 0xf) + flagc) > 0xf) ? flag.h : 0x00) |
                (result > 0xff ? flag.c : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opAdd(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand1 = this.getArg1(instruction);
        const operand2 = this.getArg2(instruction);
        const result = operand1 + operand2;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
            (((result & 0xff) === 0) ? flag.z : 0x00) |
            ((((operand1 & 0xf) + (operand2 & 0xf)) > 0xf) ? flag.h : 0x00) |
            ((result > 0xff) ? flag.c : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opAdd16(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand1 = this.getArg1(instruction);
        const operand2 = this.getArg2(instruction);
        const result = operand1 + operand2;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
            (this.state.r8[r8.f] & flag.z) |
            ((((operand1 & 0x0fff) + (operand2 & 0x0fff)) > 0x0fff) ? flag.h : 0x00) |
            (result > 0xffff ? flag.c : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opAdd16s(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand1 = this.getArg1(instruction);
        const operand2 = this.getArg2(instruction);

        this.setArg1(instruction, operand1 + operand2);

        // prettier-ignore
        this.state.r8[r8.f] =
            ((((operand1 & 0xf) + (operand2 & 0xf)) > 0xf) ? flag.h : 0x00) |
            ((((operand1 & 0xff) + (operand2 & 0xff)) > 0xff) ? flag.c : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opAnd(instruction: Instruction): void {
        this.tick(instruction.cycles);

        this.state.r8[r8.a] &= this.getArg1(instruction);
        this.state.r8[r8.f] = flag.h | (this.state.r8[r8.a] === 0 ? flag.z : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opCall(instruction: Instruction): void {
        const condition = this.evaluateCondition(instruction);
        const cycles = instruction.cycles + (condition ? 3 : 0);
        this.tick(cycles);

        const returnTo = (this.state.p + instruction.len) & 0xffff;

        if (condition) {
            this.stackPush16(returnTo);
            this.state.p = this.getArg1(instruction);
        } else {
            this.state.p = returnTo;
        }
    }

    private opCcf(instruction: Instruction): void {
        this.tick(instruction.cycles);

        // flip flag C and reset flags N, H, do not touch flag Z
        this.state.r8[r8.f] = (this.state.r8[r8.f] ^ flag.c) & (flag.z | flag.c);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opCp(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const a = this.state.r8[r8.a];
        const operand = this.getArg1(instruction);

        // prettier-ignore
        this.state.r8[r8.f] =
            (a === operand ? flag.z : 0x00) |
            flag.n |
            ((a & 0xf) < (operand & 0xf) ? flag.h : 0x00) |
            (a < operand ? flag.c : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opCpl(instruction: Instruction): void {
        this.tick(instruction.cycles);

        this.state.r8[r8.a] ^= 0xff;

        this.state.r8[r8.f] = this.state.r8[r8.f] | flag.n | flag.h;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opDec(instruction: Instruction) {
        this.tick(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = operand - 0x01;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
                    (this.state.r8[r8.f] & flag.c) |
                    flag.n |
                    ((result & 0xff) === 0 ? flag.z : 0x00) |
                    ((((operand & 0x0f) - 0x01) & 0xf0) !== 0 ? flag.h : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opDaa(instruction: Instruction): void {
        this.tick(instruction.cycles);

        let result = this.state.r8[r8.a];

        const flagN = this.state.r8[r8.f] & flag.n,
            flagC = this.state.r8[r8.f] & flag.c,
            flagH = this.state.r8[r8.f] & flag.h;

        if (flagN) {
            if (flagH) result -= 0x06;
            if (flagC) result -= 0x60;
        } else {
            if (flagH || (result & 0x0f) > 0x09) result += 0x06;
            if (flagC || result > 0x9f) result += 0x60;
        }

        this.state.r8[r8.a] = result;
        this.state.r8[r8.f] = (this.state.r8[r8.f] & flag.n) | (this.state.r8[r8.a] === 0 ? flag.z : 0) | (flagC || result > 0xff ? flag.c : 0);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opDec16(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = operand - 0x01;

        this.setArg1(instruction, result);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opDi(instruction: Instruction): void {
        this.tick(instruction.cycles);

        this.state.interruptsEnabled = false;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opEi(instruction: Instruction): void {
        this.tick(instruction.cycles);

        this.state.pendingEi = true;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opHalt(instruction: Instruction): void {
        const halt = this.state.interruptsEnabled || !this.interrupt.isPending();
        // Incomplete emulation of HALT bug: we include a clock penalty, but we
        // don't account for the double P read.
        const cycles = instruction.cycles + (halt ? 0 : 1);

        this.tick(cycles);
        this.state.halt = halt;

        this.state.p = this.state.p + 1;
    }

    private opInc(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = operand + 0x01;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
                    (this.state.r8[r8.f] & flag.c) |
                    ((result & 0xff) === 0 ? flag.z : 0x00) |
                    ((((operand & 0x0f) + 0x01) & 0xf0) !== 0 ? flag.h : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opInc16(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = operand + 0x01;

        this.setArg1(instruction, result);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opJp(instruction: Instruction): void {
        const condition = this.evaluateCondition(instruction);
        const cycles = instruction.cycles + (condition ? 1 : 0);
        this.tick(cycles);

        const target = this.getArg1(instruction);

        if (condition) {
            this.state.p = target & 0xffff;
        } else {
            this.state.p = (this.state.p + instruction.len) & 0xffff;
        }
    }

    private opLd(instruction: Instruction): void {
        const cyclesSplit =
            ((instruction.mode1 | instruction.mode2) &
                (AddressingMode.reg8io | AddressingMode.imm16ind8 | AddressingMode.reg16ind8 | AddressingMode.imm8io)) !==
            0
                ? 1
                : 0;
        this.tick(instruction.cycles - cyclesSplit);

        this.setArg1(instruction, this.getArg2(instruction));

        if (cyclesSplit) this.tick(1);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opJr(instruction: Instruction): void {
        const condition = this.evaluateCondition(instruction);
        const cycles = instruction.cycles + (condition ? 1 : 0);
        this.tick(cycles);

        const displacement = this.getArg1(instruction);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        if (condition) {
            this.state.p = (this.state.p + displacement) & 0xffff;
        }
    }

    private opLdd(instruction: Instruction): void {
        this.tick(instruction.cycles - 1);

        this.setArg1(instruction, this.getArg2(instruction));
        this.state.r16[r16.hl] -= 0x01;

        this.tick(1);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opLdi(instruction: Instruction): void {
        this.tick(instruction.cycles - 1);

        this.setArg1(instruction, this.getArg2(instruction));
        this.state.r16[r16.hl] += 0x01;

        this.tick(1);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opLds(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.getArg1(instruction);
        const stackPointer = this.state.r16[r16.sp];

        this.state.r16[r16.hl] = stackPointer + operand;

        // prettier-ignore
        this.state.r8[r8.f] =
            ((((stackPointer & 0xf) + (operand & 0xf)) > 0xf) ? flag.h : 0x00) |
            ((((stackPointer & 0xff) + (operand & 0xff)) > 0xff) ? flag.c : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opNop(instruction: Instruction): void {
        this.tick(instruction.cycles);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opOr(instruction: Instruction): void {
        this.tick(instruction.cycles);

        this.state.r8[r8.a] |= this.getArg1(instruction);
        this.state.r8[r8.f] = this.state.r8[r8.a] === 0 ? flag.z : 0x00;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opPop(instruction: Instruction): void {
        this.tick(instruction.cycles);

        this.setArg1(instruction, this.stackPop16());
        this.state.r8[r8.f] &= 0xf0;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opPush(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.getArg1(instruction);

        this.stackPush16(operand);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opRet(instruction: Instruction): void {
        const condition = this.evaluateCondition(instruction);
        const cycles = instruction.cycles + (condition ? 3 : 0);
        this.tick(cycles);

        if (condition) {
            this.state.p = this.stackPop16();
        } else {
            this.state.p = (this.state.p + instruction.len) & 0xffff;
        }
    }

    private opReti(instruction: Instruction): void {
        this.tick(instruction.cycles);

        this.state.p = this.stackPop16();

        this.state.interruptsEnabled = true;
    }

    private opRlca(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.state.r8[r8.a];

        this.state.r8[r8.a] = (operand << 1) | (operand >>> 7);

        // prettier-ignore
        this.state.r8[r8.f] =
                    ((operand & flag.z) >>> 3);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opRla(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.state.r8[r8.a];

        this.state.r8[r8.a] = (operand << 1) | ((this.state.r8[r8.f] & flag.c) >>> 4);

        // prettier-ignore
        this.state.r8[r8.f] =
            ((operand & flag.z) >>> 3);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opRrca(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.state.r8[r8.a];

        this.state.r8[r8.a] = (operand >>> 1) | (operand << 7);

        // prettier-ignore
        this.state.r8[r8.f] =
            ((operand & 0x01) << 4);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opRra(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.state.r8[r8.a];

        this.state.r8[r8.a] = (operand >>> 1) | ((this.state.r8[r8.f] & flag.c) << 3);

        // prettier-ignore
        this.state.r8[r8.f] =
            ((operand & 0x01) << 4);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opSbc(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand1 = this.getArg1(instruction);
        const operand2 = this.getArg2(instruction);
        const flagc = (this.state.r8[r8.f] & flag.c) >>> 4;
        const result = operand1 - operand2 - flagc;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
            flag.n |
            ((result & 0xff) === 0 ? flag.z : 0x00) |
            ((((operand1 & 0xf) - (operand2 & 0xf) - flagc) < 0x00) ? flag.h : 0x00) |
            (result < 0x00 ? flag.c : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opScf(instruction: Instruction): void {
        this.tick(instruction.cycles);

        // prettier-ignore
        this.state.r8[r8.f] =
            (this.state.r8[r8.f] & flag.z) |
            flag.c;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opStop(instruction: Instruction): void {
        this.clock.notifyStop();

        this.tick(instruction.cycles);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opSub(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand1 = this.state.r8[r8.a];
        const operand2 = this.getArg1(instruction);
        const result = operand1 - operand2;

        this.state.r8[r8.a] = result;

        // prettier-ignore
        this.state.r8[r8.f] =
            flag.n |
            ((this.state.r8[r8.a] === 0x00) ? flag.z : 0x00) |
            ((((operand1 & 0xf) - (operand2 & 0xf)) < 0x00) ? flag.h : 0x00) |
            ((result < 0x00) ? flag.c : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opXor(instruction: Instruction): void {
        this.tick(instruction.cycles);

        this.state.r8[r8.a] ^= this.getArg1(instruction);
        this.state.r8[r8.f] = this.state.r8[r8.a] ? 0x00 : flag.z;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opBit(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.getArg2(instruction);
        const bitMask = 1 << this.getArg1(instruction);

        // prettier-ignore
        this.state.r8[r8.f] =
            (this.state.r8[r8.f] & flag.c) |
            flag.h |
            (operand & bitMask ? 0x00 : flag.z);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opSet(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.getArg2(instruction);
        const bitMask = 1 << this.getArg1(instruction);

        this.setArg2(instruction, operand | bitMask);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opRes(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.getArg2(instruction);
        const bitMask = ~(1 << this.getArg1(instruction));

        this.setArg2(instruction, operand & bitMask);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opSwap(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = ((operand & 0xf0) >>> 4) | ((operand & 0x0f) << 4);

        this.setArg1(instruction, result);

        this.state.r8[r8.f] = (result & 0xff) === 0 ? flag.z : 0x00;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opRlc(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = ((operand << 1) | (operand >>> 7)) & 0xff;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
            ((result & 0xff) === 0 ? flag.z : 0x00) |
            ((operand & 0x80) >>> 3);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opRl(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = ((operand << 1) | ((this.state.r8[r8.f] & flag.c) >>> 4)) & 0xff;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
            ((result & 0xff) === 0 ? flag.z : 0x00) |
            ((operand & flag.z) >>> 3);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opRrc(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = ((operand >>> 1) | (operand << 7)) & 0xff;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
                    ((result & 0xff) === 0 ? flag.z : 0x00) |
                    ((operand & 0x01) << 4);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opRr(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = ((operand >>> 1) | ((this.state.r8[r8.f] & flag.c) << 3)) & 0xff;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
            ((result & 0xff) === 0 ? flag.z : 0x00) |
            ((operand & 0x01) << 4);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opSla(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = (operand << 1) & 0xff;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
            ((result & 0xff) === 0 ? flag.z : 0x00) |
            ((operand & 0x80) >>> 3);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opSra(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = ((operand >> 1) | (operand & 0x80)) & 0xff;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
            ((result & 0xff) === 0 ? flag.z : 0x00) |
            ((operand & 0x01) << 4);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opSrl(instruction: Instruction): void {
        this.tick(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = (operand >> 1) & 0xff;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
            ((result & 0xff) === 0 ? flag.z : 0x00) |
            ((operand & 0x01) << 4);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
    }

    private opRst(instruction: Instruction): void {
        this.tick(instruction.cycles);

        this.stackPush16((this.state.p + 1) & 0xffff);

        this.state.p = this.getArg1(instruction);
    }

    private getArg(par: number, mode: AddressingMode): number {
        switch (mode) {
            case AddressingMode.implicit:
            case AddressingMode.bit:
                return par;

            case AddressingMode.imm8:
                return this.bus.read((this.state.p + 0x01) & 0xffff);

            case AddressingMode.imm8io: {
                const index = this.bus.read((this.state.p + 0x01) & 0xffff);
                return this.bus.read(0xff00 + index);
            }

            case AddressingMode.imm8sign: {
                return extendSign8(this.bus.read((this.state.p + 0x01) & 0xffff));
            }

            case AddressingMode.reg8:
                return this.state.r8[par];

            case AddressingMode.reg8io:
                return this.bus.read(0xff00 + this.state.r8[par]);

            case AddressingMode.imm16:
                return this.bus.read16((this.state.p + 0x01) & 0xffff);

            case AddressingMode.imm16ind8: {
                const index = this.bus.read16((this.state.p + 0x01) & 0xffff);
                return this.bus.read(index);
            }

            case AddressingMode.reg16:
                return this.state.r16[par];

            case AddressingMode.reg16ind8:
                return this.bus.read(this.state.r16[par]);

            default:
                throw new Error(`bad addressing mode ${hex8(mode)}`);
        }
    }

    private getArg1(instruction: Instruction): number {
        return this.getArg(instruction.par1, instruction.mode1);
    }

    private getArg2(instruction: Instruction): number {
        return this.getArg(instruction.par2, instruction.mode2);
    }

    private setArg(par: number, mode: AddressingMode, value: number): void {
        switch (mode) {
            case AddressingMode.imm8io: {
                const index = this.bus.read((this.state.p + 0x01) & 0xffff);
                this.bus.write(0xff00 + index, value & 0xff);
                break;
            }

            case AddressingMode.reg8:
                this.state.r8[par] = value;
                break;

            case AddressingMode.reg8io:
                this.bus.write(0xff00 + this.state.r8[par], value & 0xff);
                break;

            case AddressingMode.imm16ind8:
                this.bus.write(this.bus.read16((this.state.p + 0x01) & 0xffff), value & 0xff);
                break;

            case AddressingMode.imm16ind16:
                this.bus.write16(this.bus.read16((this.state.p + 0x01) & 0xffff), value & 0xffff);
                break;

            case AddressingMode.reg16ind8:
                this.bus.write(this.state.r16[par], value & 0xff);
                break;

            case AddressingMode.reg16:
                this.state.r16[par] = value;
                break;

            default:
                throw new Error(`bad addressing mode ${hex8(mode)}`);
        }
    }

    private setArg1(instruction: Instruction, value: number): void {
        this.setArg(instruction.par1, instruction.mode1, value);
    }

    private setArg2(instruction: Instruction, value: number): void {
        this.setArg(instruction.par2, instruction.mode2, value);
    }

    private evaluateCondition(instruction: Instruction): boolean {
        switch (instruction.condition) {
            case Condition.c:
                return (this.state.r8[r8.f] & flag.c) !== 0x00;

            case Condition.nc:
                return (this.state.r8[r8.f] & flag.c) === 0x00;

            case Condition.z:
                return (this.state.r8[r8.f] & flag.z) !== 0x00;

            case Condition.nz:
                return (this.state.r8[r8.f] & flag.z) === 0x00;
        }

        return true;
    }

    private tick(cycles: number) {
        // Emulate delayed EI
        if (this.state.pendingEi && cycles > 0) {
            this.clock.increment(1);
            this.state.pendingEi = false;
            this.state.interruptsEnabled = true;

            cycles--;

            if (cycles === 0) return;
        }

        this.clock.increment(cycles);
    }

    readonly onExecute = new Event<number>();
    readonly onAfterExecute = new Event<number>();

    readonly state: CpuState;
}
