import { AddressingMode, Condition, Instruction, Operation, decodeInstruction } from './instruction';
import { Interrupt, irq } from './interrupt';
import { hex16, hex8 } from '../helper/format';

import { Bus } from './bus';
import { Clock } from './clock';
import { Event } from 'microevent.ts';
import { SystemInterface } from './system';

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
    stopped: boolean;
    halted: boolean;
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
    constructor(private bus: Bus, private clock: Clock, private interrupt: Interrupt, private system: SystemInterface) {
        const r16 = new Uint16Array(5);
        const r8 = new Uint8Array(r16.buffer);

        this.state = {
            r8,
            r16,
            p: 0x00,
            interruptsEnabled: false,
            stopped: false,
            halted: false,
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
        this.state.stopped = false;
        this.state.halted = false;
    }

    step(count: number): number {
        let cycles = 0;

        for (let i = 0; i < count; i++) {
            const irqCycles = this.handleInterrupts();
            if (irqCycles !== 0) {
                cycles += irqCycles;
                continue;
            }

            cycles += this.dispatch(decodeInstruction(this.bus, this.state.p));
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
        this.state.r16[r16.sp] = (this.state.r16[r16.sp] - 0x01) & 0xffff;
        this.bus.write(this.state.r16[r16.sp], value >>> 8);
        this.state.r16[r16.sp] = (this.state.r16[r16.sp] - 0x01) & 0xffff;
        this.bus.write(this.state.r16[r16.sp], value & 0xff);
    }

    private stackPop16(): number {
        const value = this.bus.read16(this.state.r16[r16.sp]) & 0xffff;
        this.state.r16[r16.sp] = (this.state.r16[r16.sp] + 2) & 0xffff;

        return value;
    }

    private dispatch(instruction: Instruction): number {
        if (instruction.op !== Operation.invalid) this.onExecute.dispatch(this.state.p);

        switch (instruction.op) {
            case Operation.adc: {
                this.clock.increment(instruction.cycles);

                const operand1 = this.getArg1(instruction);
                const operand2 = this.getArg2(instruction);
                const flagc = (this.state.r8[r8.f] & flag.c) >>> 4;
                const result = operand1 + operand2 + flagc;

                this.setArg1(instruction, result & 0xffff);

                // prettier-ignore
                this.state.r8[r8.f] =
                    (result === 0 ? flag.z : 0x00) |
                    ((((operand1 & 0xf) + (operand2 & 0xf) + flagc) > 0xf) ? flag.h : 0x00) |
                    (result > 0xff ? flag.c : 0x00);

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;
            }

            case Operation.add: {
                this.clock.increment(instruction.cycles);

                const operand1 = this.getArg1(instruction);
                const operand2 = this.getArg2(instruction);
                const result = operand1 + operand2;

                this.setArg1(instruction, result & 0xffff);

                // prettier-ignore
                this.state.r8[r8.f] =
                    (result === 0 ? flag.z : 0x00) |
                    ((((operand1 & 0xf) + (operand2 & 0xf)) > 0xf)  ? flag.h : 0x00) |
                    (result > 0xff ? flag.c : 0x00);

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;
            }

            case Operation.and:
                this.clock.increment(instruction.cycles);

                this.state.r8[r8.a] &= this.getArg1(instruction);
                this.state.r8[r8.f] = flag.h | (this.state.r8[r8.a] === 0 ? flag.z : 0x00);

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;

            case Operation.call: {
                this.clock.increment(instruction.cycles);

                const returnTo = (this.state.p + instruction.len) & 0xffff;

                this.stackPush16(returnTo);

                this.state.p = this.getArg1(instruction);

                return instruction.cycles;
            }

            case Operation.cb:
                this.system.break('can not call CB');

                return 0;

            case Operation.cp: {
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

            case Operation.cpl: {
                this.clock.increment(instruction.cycles);

                this.state.r8[r8.a] ^= 0xff;

                this.state.r8[r8.f] = this.state.r8[r8.f] | flag.n | flag.h;

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;
            }

            case Operation.dec: {
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

            case Operation.di:
                this.clock.increment(instruction.cycles);

                this.state.interruptsEnabled = false;

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;

            case Operation.ei:
                this.clock.increment(instruction.cycles);

                this.state.interruptsEnabled = true;

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;

            case Operation.halt:
                this.clock.increment(instruction.cycles);

                this.state.halted = true;

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;

            case Operation.inc: {
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

            case Operation.jp:
                this.clock.increment(instruction.cycles);

                this.state.p = this.getArg1(instruction);

                return instruction.cycles;

            case Operation.jr: {
                const condition = this.evaluateCondition(instruction);
                const cycles = instruction.cycles + (condition ? 1 : 0);
                this.clock.increment(cycles);

                const displacement = extendSign8(this.getArg1(instruction));

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                if (condition) {
                    this.state.p = (this.state.p + displacement) & 0xffff;
                }

                return cycles;
            }

            case Operation.ld: {
                this.clock.increment(instruction.cycles);

                this.setArg1(instruction, this.getArg2(instruction));

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;
            }

            case Operation.ldd: {
                this.clock.increment(instruction.cycles);

                this.setArg1(instruction, this.getArg2(instruction));
                this.state.r16[r16.hl] = (this.state.r16[r16.hl] - 0x01) & 0xffff;

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;
            }

            case Operation.ldi: {
                this.clock.increment(instruction.cycles);

                this.setArg1(instruction, this.getArg2(instruction));
                this.state.r16[r16.hl] = (this.state.r16[r16.hl] + 0x01) & 0xffff;

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;
            }

            case Operation.nop:
                this.clock.increment(instruction.cycles);

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;

            case Operation.or:
                this.clock.increment(instruction.cycles);

                this.state.r8[r8.a] |= this.getArg1(instruction);
                this.state.r8[r8.f] = this.state.r8[r8.a] === 0 ? flag.z : 0x00;

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;

            case Operation.pop:
                this.clock.increment(instruction.cycles);

                this.setArg1(instruction, this.stackPop16());
                this.state.r8[r8.f] &= 0xf0;

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;

            case Operation.push: {
                this.clock.increment(instruction.cycles);

                const operand = this.getArg1(instruction);

                this.stackPush16(operand);

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;
            }

            case Operation.ret: {
                const condition = this.evaluateCondition(instruction);
                const cycles = instruction.cycles + (instruction.opcode !== 0xc9 ? (condition ? 1 : -2) : 0);
                this.clock.increment(cycles);

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                if (condition) {
                    this.state.p = this.stackPop16();
                }

                return cycles;
            }

            case Operation.reti: {
                this.clock.increment(instruction.cycles);

                this.state.p = this.stackPop16();

                this.state.interruptsEnabled = true;

                return instruction.cycles;
            }

            case Operation.rlca: {
                this.clock.increment(instruction.cycles);

                const operand = this.state.r8[r8.a];
                const result = ((operand << 1) | (operand >>> 7)) & 0xff;

                this.state.r8[r8.a] = result;

                // prettier-ignore
                this.state.r8[r8.f] =
                    (result === 0 ? flag.z : 0x00) |
                    ((operand & 0x80) >>> 3);

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;
            }

            case Operation.rla: {
                this.clock.increment(instruction.cycles);

                const operand = this.state.r8[r8.a];
                const result = ((operand << 1) | ((this.state.r8[r8.f] & flag.c) >>> 4)) & 0xff;

                this.state.r8[r8.a] = result;

                // prettier-ignore
                this.state.r8[r8.f] =
                    (result === 0 ? flag.z : 0x00) |
                    ((operand & 0x80) >>> 3);

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;
            }

            case Operation.rrca: {
                this.clock.increment(instruction.cycles);

                const operand = this.state.r8[r8.a];
                const result = ((operand >>> 1) | (operand << 7)) & 0xff;

                this.state.r8[r8.a] = result;

                // prettier-ignore
                this.state.r8[r8.f] =
                    (result === 0 ? flag.z : 0x00) |
                    ((operand & 0x01) << 4);

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;
            }

            case Operation.rra: {
                this.clock.increment(instruction.cycles);

                const operand = this.state.r8[r8.a];
                const result = ((operand >>> 1) | ((this.state.r8[r8.f] & flag.c) << 3)) & 0xff;

                this.state.r8[r8.a] = result;

                // prettier-ignore
                this.state.r8[r8.f] =
                    (result === 0 ? flag.z : 0x00) |
                    ((operand & 0x01) << 4);

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;
            }

            case Operation.sbc: {
                this.clock.increment(instruction.cycles);

                const operand1 = this.getArg1(instruction);
                const operand2 = this.getArg2(instruction);
                const flagc = (this.state.r8[r8.f] & flag.c) >>> 4;
                const result = operand1 - operand2 - flagc;

                this.setArg1(instruction, result & 0xffff);

                // prettier-ignore
                this.state.r8[r8.f] =
                    (result === 0 ? flag.z : 0x00) |
                    ((((operand1 & 0xf) - (operand2 & 0xf) - flagc) < 0) ? flag.h : 0x00) |
                    (result < 0x00 ? flag.c : 0x00);

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;
            }

            case Operation.stop:
                this.clock.increment(instruction.cycles);

                this.state.stopped = true;
                this.state.interruptsEnabled = true;

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;

            case Operation.sub: {
                this.clock.increment(instruction.cycles);

                const operand1 = this.state.r8[r8.a];
                const operand2 = this.getArg1(instruction);
                const result = operand1 - operand2;

                this.state.r8[r8.a] = result & 0xffff;

                // prettier-ignore
                this.state.r8[r8.f] =
                    (result === 0 ? flag.z : 0x00) |
                    ((((operand1 & 0xf) - (operand2 & 0xf)) < 0)  ? flag.h : 0x00) |
                    (result < 0x00 ? flag.c : 0x00);

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;
            }

            case Operation.xor:
                this.clock.increment(instruction.cycles);

                this.state.r8[r8.a] = this.state.r8[r8.a] ^ this.getArg1(instruction);
                this.state.r8[r8.f] = this.state.r8[r8.a] ? 0x00 : flag.z;

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;

            case Operation.bit: {
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

            case Operation.set: {
                this.clock.increment(instruction.cycles);

                const operand = this.getArg2(instruction);
                const bitMask = 1 << this.getArg1(instruction);

                this.setArg2(instruction, operand | bitMask);

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;
            }

            case Operation.res: {
                this.clock.increment(instruction.cycles);

                const operand = this.getArg2(instruction);
                const bitMask = ~(1 << this.getArg1(instruction));

                this.setArg2(instruction, operand & bitMask);

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;
            }

            case Operation.swap: {
                this.clock.increment(instruction.cycles);

                const operand = this.getArg1(instruction);
                const result = ((operand & 0xf0) >>> 4) | ((operand & 0x0f) << 4);

                this.setArg1(instruction, result);

                this.state.r8[r8.f] = result === 0 ? flag.z : 0x00;

                this.state.p = (this.state.p + instruction.len) & 0xffff;
                return instruction.cycles;
            }

            case Operation.rlc: {
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

            case Operation.rl: {
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

            case Operation.rrc: {
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

            case Operation.rr: {
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

            case Operation.sla: {
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

            case Operation.srl: {
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

            case Operation.sra: {
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

            case Operation.rst: {
                this.clock.increment(instruction.cycles);

                this.stackPush16(this.state.p);

                this.state.p = this.getArg1(instruction);

                return instruction.cycles;
            }

            default:
                this.system.break(`invalid instruction ${hex8(instruction.op)} at ${hex16(this.state.p)}`);
                return 0;
        }
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
                this.bus.write(0xff00 + index, value);
                break;
            }

            case AddressingMode.reg8:
                this.state.r8[par] = value & 0xff;
                break;

            case AddressingMode.reg8io:
                this.bus.write(0xff00 + this.state.r8[par], value);
                break;

            case AddressingMode.imm16ind8:
                this.bus.write(this.bus.read16((this.state.p + 0x01) & 0xffff), value & 0xff);
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

    readonly state: CpuState;
}
