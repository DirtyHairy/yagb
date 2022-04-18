import { AddressingMode, Condition, Instruction, Operation, decodeInstruction } from './instruction';
import { Interrupt, irq } from './interrupt';
import { hex16, hex8 } from '../helper/format';

import { Bus } from './bus';
import { Clock } from './clock';
import { Event } from 'microevent.ts';
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
}

function extendSign8(x: number): number {
    return x & 0x80 ? -((~x + 0x01) & 0xff) : x;
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
    constructor(private bus: Bus, private clock: Clock, private interrupt: Interrupt, private system: System) {
        const r16 = new Uint16Array(5);
        const r8 = new Uint8Array(r16.buffer);

        this.state = {
            r8,
            r16,
            p: 0x00,
            interruptsEnabled: false,
        };
    }

    reset() {
        this.state.r16[r16.af] = 0x0100;
        this.state.r16[r16.bc] = 0x0013;
        this.state.r16[r16.de] = 0x00d8;
        this.state.r16[r16.hl] = 0x014d;
        this.state.p = 0x0100;
        this.state.r16[r16.sp] = 0xfffe;
        this.state.interruptsEnabled = false;
    }

    step(count: number): number {
        let cycles = 0;

        for (let i = 0; i < count; i++) {
            if (this.system.isTrap) break;

            const irqCycles = this.handleInterrupts();
            if (irqCycles !== 0) {
                cycles += irqCycles;
            } else {
                cycles += this.dispatch(decodeInstruction(this.bus, this.state.p));
            }

            this.onAfterExecute.dispatch(this.state.p);
        }

        return cycles;
    }

    run(cyclesGoal: number): number {
        let cycles = 0;

        while (cycles < cyclesGoal) {
            if (this.system.isTrap) break;

            const irqCycles = this.handleInterrupts();
            if (irqCycles !== 0) {
                cycles += irqCycles;
            } else {
                cycles += this.dispatch(decodeInstruction(this.bus, this.state.p));
            }

            this.onAfterExecute.dispatch(this.state.p);
        }

        return cycles;
    }

    printState(): string {
        return `af=${hex16(this.state.r16[r16.af])} bc=${hex16(this.state.r16[r16.bc])} de=${hex16(this.state.r16[r16.de])} hl=${hex16(
            this.state.r16[r16.hl]
        )} s=${hex16(this.state.r16[r16.sp])} p=${hex16(this.state.p)} interrupts=${this.state.interruptsEnabled ? 'on' : 'off'}`;
    }

    private handleInterrupts(): number {
        if (!this.state.interruptsEnabled) return 0;

        const irq = this.interrupt.getNext();
        if (!irq) return 0;

        this.interrupt.clear(irq);
        this.state.interruptsEnabled = false;

        this.stackPush16(this.state.p);

        this.state.p = getIrqVector(irq);
        this.clock.increment(5);

        return 5;
    }

    private stackPush16(value: number): void {
        value = value & 0xffff;
        this.bus.write16(this.state.r16[r16.sp] - 1, value);
        this.state.r16[r16.sp] = (this.state.r16[r16.sp] - 2) & 0xffff;
    }

    private stackPop16(): number {
        const value = this.bus.read16(this.state.r16[r16.sp]) & 0xffff;
        this.state.r16[r16.sp] = (this.state.r16[r16.sp] + 2) & 0xffff;

        return value;
    }

    private dispatch(instruction: Instruction): number {
        this.onExecute.dispatch(this.state.p);

        switch (instruction.op) {
            case Operation.adc:
                return this.opAdc(instruction);

            case Operation.add:
                return this.opAdd(instruction);

            case Operation.add16:
                return this.oppAdd16(instruction);

            case Operation.and:
                return this.opAnd(instruction);

            case Operation.call:
                return this.opCall(instruction);

            case Operation.cb:
                this.system.trap('can not call CB');

                return 0;

            case Operation.ccf: {
                this.clock.increment(instruction.cycles);

                // prettier-ignore
                this.state.r8[r8.f] =
                    (this.state.r8[r8.f] & flag.z) |
                    ((this.state.r8[r8.f] & flag.c) === flag.c ? 0x00 : flag.c);

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;
            }

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
                return 0;
        }
    }

    private opAdc(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand1 = this.getArg1(instruction);
        const operand2 = this.getArg2(instruction);
        const flagc = (this.state.r8[r8.f] & flag.c) >>> 4;
        const result = operand1 + operand2 + flagc;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
                (result === 0 ? flag.z : 0x00) |
                ((((operand1 & 0xf) + (operand2 & 0xf) + flagc) > 0xf) ? flag.h : 0x00) |
                (result > 0xff ? flag.c : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opAdd(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand1 = this.getArg1(instruction);
        const operand2 = this.getArg2(instruction);
        const result = operand1 + operand2;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
                    (result === 0 ? flag.z : 0x00) |
                    ((((operand1 & 0xf) + (operand2 & 0xf)) > 0xf)  ? flag.h : 0x00) |
                    (result > 0xff ? flag.c : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private oppAdd16(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand1 = this.getArg1(instruction);
        const operand2 = this.getArg2(instruction);
        const result = operand1 + operand2;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
            this.state.r8[r8.f] & flag.z |
            ((((operand1 & 0xffff) + (operand2 & 0xffff)) > 0x0fff) ? flag.h : 0x00) |
            (result > 0xffff ? flag.c : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opAnd(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        this.state.r8[r8.a] &= this.getArg1(instruction);
        this.state.r8[r8.f] = flag.h | (this.state.r8[r8.a] === 0 ? flag.z : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opCall(instruction: Instruction) {
        const condition = this.evaluateCondition(instruction);
        const cycles = instruction.cycles + (condition ? 3 : 0);
        this.clock.increment(cycles);

        const returnTo = (this.state.p + instruction.len) & 0xffff;

        if (condition) {
            this.stackPush16(returnTo);
            this.state.p = this.getArg1(instruction);
        } else {
            this.state.p = returnTo;
        }

        return cycles;
    }

    private opCp(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const a = this.state.r8[r8.a];
        const operand = this.getArg1(instruction);

        // prettier-ignore
        this.state.r8[r8.f] =
            (a === operand ? flag.z : 0x00) |
            flag.n |
            ((a & 0xf) < (operand & 0xf) ? flag.h : 0x00) |
            (a < operand ? flag.c : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opCpl(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        this.state.r8[r8.a] ^= 0xff;

        this.state.r8[r8.f] = this.state.r8[r8.f] | flag.n | flag.h;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opDec(instruction: Instruction) {
        this.clock.increment(instruction.cycles);

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
        return instruction.cycles;
    }

    private opDaa(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        let operand = this.state.r8[r8.a];

                const flagN = this.state.r8[r8.f] & flag.n,
                    flagC = this.state.r8[r8.f] & flag.c,
                    flagH = this.state.r8[r8.f] & flag.h;

        let setFlagC = 0;
        if (flagH || (!flagN && (operand & 0xf) > 0x09)) {
            operand += flagN ? ~0x06 : 0x06;
        }

        if (flagC || (!flagN && (operand & 0xf0) >>> 4 > 0x09)) {
            operand += flagN ? ~0x60 : 0x60;
            setFlagC = flag.c;
        }

        operand &= 0xff;

        const setFlagZ = operand === 0 ? flag.z : 0;

        this.state.r8[r8.f] &= ~(flag.h | flag.z | flag.c);
        this.state.r8[r8.f] |= setFlagC | setFlagZ;

        this.state.r8[r8.a] = operand;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opDec16(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = operand - 0x01;

        this.setArg1(instruction, result);

        this.state.r8[r8.f] = 0;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opDi(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        this.state.interruptsEnabled = false;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opEi(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        this.state.interruptsEnabled = true;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opHalt(instruction: Instruction): number {
        this.system.trap('encountered HALT');
        this.clock.increment(instruction.cycles);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opInc(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = operand + 0x01;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
                    (this.state.r8[r8.f] & flag.c) |
                    ((result & 0xff) === 0 ? flag.z : 0x00) |
                    ((((operand & 0x0f) + 0x01) & 0xf0) !== 0 ? flag.h : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opInc16(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = operand + 0x01;

        this.setArg1(instruction, result);

        this.state.r8[r8.f] = 0;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opJp(instruction: Instruction): number {
        const condition = this.evaluateCondition(instruction);
        const cycles = instruction.cycles + (condition ? 1 : 0);
        this.clock.increment(cycles);

        const target = this.getArg1(instruction);

        if (condition) {
            this.state.p = target & 0xffff;
        } else {
            this.state.p = (this.state.p + instruction.len) & 0xffff;
        }

        return cycles;
    }

    private opLd(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        this.setArg1(instruction, this.getArg2(instruction));

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opJr(instruction: Instruction): number {
        const condition = this.evaluateCondition(instruction);
        const cycles = instruction.cycles + (condition ? 1 : 0);
        this.clock.increment(cycles);

        const displacement = this.getArg1(instruction);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        if (condition) {
            this.state.p = (this.state.p + displacement) & 0xffff;
        }

        return cycles;
    }

    private opLdd(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const result = this.getArg2(instruction) - 0x01;
        this.setArg1(instruction, result);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opLdi(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const result = this.getArg2(instruction) + 0x01;
        this.setArg1(instruction, result);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opNop(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opOr(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        this.state.r8[r8.a] |= this.getArg1(instruction);
        this.state.r8[r8.f] = this.state.r8[r8.a] === 0 ? flag.z : 0x00;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opPop(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        this.setArg1(instruction, this.stackPop16());
        this.state.r8[r8.f] &= 0xf0;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opPush(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.getArg1(instruction);

        this.stackPush16(operand);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opRet(instruction: Instruction): number {
        const condition = this.evaluateCondition(instruction);
        const cycles = instruction.cycles + (condition ? 3 : 0);
        this.clock.increment(cycles);

        if (condition) {
            this.state.p = this.stackPop16();
        } else {
            this.state.p = (this.state.p + instruction.len) & 0xffff;
        }

        return cycles;
    }

    private opReti(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        this.state.p = this.stackPop16();

        this.state.interruptsEnabled = true;

        return instruction.cycles;
    }

    private opRlca(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.state.r8[r8.a];

        this.state.r8[r8.a] = (operand << 1) | (operand >>> 7);

        // prettier-ignore
        this.state.r8[r8.f] =
                    ((operand & 0x80) >>> 3);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opRla(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.state.r8[r8.a];

        this.state.r8[r8.a] = (operand << 1) | ((this.state.r8[r8.f] & flag.c) >>> 4);

        // prettier-ignore
        this.state.r8[r8.f] =
            ((operand & 0x80) >>> 3);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opRrca(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.state.r8[r8.a];

        this.state.r8[r8.a] = (operand >>> 1) | (operand << 7);

        // prettier-ignore
        this.state.r8[r8.f] =
            ((operand & 0x01) << 4);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opRra(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.state.r8[r8.a];

        this.state.r8[r8.a] = (operand >>> 1) | ((this.state.r8[r8.f] & flag.c) << 3);

        // prettier-ignore
        this.state.r8[r8.f] =
            ((operand & 0x01) << 4);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opSbc(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand1 = this.getArg1(instruction);
        const operand2 = this.getArg2(instruction);
        const flagc = (this.state.r8[r8.f] & flag.c) >>> 4;
        const result = operand1 - operand2 - flagc;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
            (result === 0 ? flag.z : 0x00) |
            ((((operand1 & 0xf) - (operand2 & 0xf) - flagc) < 0) ? flag.h : 0x00) |
            (result < 0x00 ? flag.c : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opScf(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        // prettier-ignore
        this.state.r8[r8.f] =
            (this.state.r8[r8.f] & flag.z) |
            flag.c;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opStop(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        // prettier-ignore
        this.state.r8[r8.f] =
            (this.state.r8[r8.f] & flag.z) |
            flag.c;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opSub(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand1 = this.state.r8[r8.a];
        const operand2 = this.getArg1(instruction);
        const result = operand1 - operand2;

        this.state.r8[r8.a] = result;

        // prettier-ignore
        this.state.r8[r8.f] =
            (result === 0 ? flag.z : 0x00) |
            ((((operand1 & 0xf) - (operand2 & 0xf)) < 0)  ? flag.h : 0x00) |
            (result < 0x00 ? flag.c : 0x00);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opXor(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        this.state.r8[r8.a] = this.state.r8[r8.a] ^ this.getArg1(instruction);
        this.state.r8[r8.f] = this.state.r8[r8.a] ? 0x00 : flag.z;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opBit(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.getArg2(instruction);
        const bitMask = 1 << this.getArg1(instruction);

        // prettier-ignore
        this.state.r8[r8.f] =
            (this.state.r8[r8.f] & flag.c) |
            flag.h |
            (operand & bitMask ? 0x00 : flag.z);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opSet(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.getArg2(instruction);
        const bitMask = 1 << this.getArg1(instruction);

        this.setArg2(instruction, operand | bitMask);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opRes(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.getArg2(instruction);
        const bitMask = ~(1 << this.getArg1(instruction));

        this.setArg2(instruction, operand & bitMask);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opSwap(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = ((operand & 0xf0) >>> 4) | ((operand & 0x0f) << 4);

        this.setArg1(instruction, result);

        this.state.r8[r8.f] = result === 0 ? flag.z : 0x00;

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opRlc(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = ((operand << 1) | (operand >>> 7)) & 0xff;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
            (result === 0 ? flag.z : 0x00) |
            ((operand & 0x80) >>> 3);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opRl(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = ((operand << 1) | ((this.state.r8[r8.f] & flag.c) >>> 4)) & 0xff;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
            (result === 0 ? flag.z : 0x00) |
            ((operand & 0x80) >>> 3);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opRrc(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = ((operand >>> 1) | (operand << 7)) & 0xff;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
                    (result === 0 ? flag.z : 0x00) |
                    ((operand & 0x01) << 4);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opRr(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = ((operand >>> 1) | ((this.state.r8[r8.f] & flag.c) << 3)) & 0xff;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
            (result === 0 ? flag.z : 0x00) |
            ((operand & 0x01) << 4);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opSla(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = (operand << 1) & 0xff;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
            (result === 0 ? flag.z : 0x00) |
            ((operand & 0x80) >>> 3);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opSra(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = ((operand >> 1) | (operand & 0x80)) & 0xff;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
            (result === 0 ? flag.z : 0x00) |
            ((operand & 0x01) << 4);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opSrl(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        const operand = this.getArg1(instruction);
        const result = (operand >> 1) & 0xff;

        this.setArg1(instruction, result);

        // prettier-ignore
        this.state.r8[r8.f] =
            (result === 0 ? flag.z : 0x00) |
            ((operand & 0x01) << 4);

        this.state.p = (this.state.p + instruction.len) & 0xffff;
        return instruction.cycles;
    }

    private opRst(instruction: Instruction): number {
        this.clock.increment(instruction.cycles);

        this.stackPush16((this.state.p + 1) & 0xffff);

        this.state.p = this.getArg1(instruction);

        return instruction.cycles;
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
                this.state.r8[par] = value & 0xff;
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
                this.state.r16[par] = value & 0xffff;
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

    readonly onExecute = new Event<number>();
    readonly onAfterExecute = new Event<number>();

    readonly state: CpuState;
}
