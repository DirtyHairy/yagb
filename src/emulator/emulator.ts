import { Cartridge, createCartridge } from './cartridge';
import { decodeInstruction, disassemleInstruction } from './instruction';

import { Audio } from './audio';
import { Bus } from './bus';
import { Clock } from './clock';
import { Cpu } from './cpu';
import { Interrupt } from './interrupt';
import { Ppu } from './ppu';
import { Ram } from './ram';
import { Serial } from './serial';
import { System } from './system';
import { TraceEntry } from './trace';
import { hex16 } from '../helper/format';

export class Emulator {
    constructor(cartridgeImage: Uint8Array, printCb: (message: string) => void) {
        this.system = new System(printCb);
        this.bus = new Bus(this.system);
        this.ppu = new Ppu(this.system);
        this.audio = new Audio();
        this.clock = new Clock(this.ppu);
        this.cpu = new Cpu(this.bus, this.clock, this.system);
        this.ram = new Ram();
        this.interrupt = new Interrupt();
        this.serial = new Serial();

        const cartridge = createCartridge(cartridgeImage, this.system);
        if (!cartridge) {
            throw new Error('bad cartridge image');
        }

        this.cartridge = cartridge;

        this.cartridge.install(this.bus);
        this.ram.install(this.bus);
        this.interrupt.install(this.bus);
        this.serial.install(this.bus);
        this.ppu.install(this.bus);
        this.audio.install(this.bus);

        this.system.onBreak.addHandler((message) => {
            this.break = true;
            this.breakMessage = message;
        });

        this.reset();
    }

    addBreakpoint(address: number): void {
        this.breakpoints.add(address);
    }

    clearBreakpoint(address: number): void {
        this.breakpoints.delete(address);
    }

    clearBreakpoints(): void {
        this.breakpoints.clear();
    }

    getBreakpoints(): Array<number> {
        return Array.from(this.breakpoints).sort();
    }

    getTraces(): Array<TraceEntry> {
        return this.traces;
    }

    step(count: number): [boolean, number] {
        this.break = false;
        let cycles = 0;

        for (let i = 0; i < count; i++) {
            this.traces.unshift(
                new TraceEntry(this.bus, {
                    ...this.cpu.state,
                    r16: new Uint16Array(this.cpu.state.r16),
                    r8: new Uint8Array(this.cpu.state.r8),
                })
            );

            if (this.traces.length > 30) {
                this.traces.pop();
            }

            cycles += this.cpu.step(1);

            if (this.breakpoints.has(this.cpu.state.p)) {
                this.system.break(`breakpoint at ${hex16(this.cpu.state.p)}`);
            }

            if (this.break) break;
        }

        return [!this.break, cycles];
    }

    reset(): void {
        this.cartridge.reset();
        this.cpu.reset();
        this.ram.reset();
        this.ppu.reset();
    }

    printState(): string {
        return `CPU:\n${this.cpu.printState()}`;
    }

    disassemble(count: number, address = this.cpu.state.p): Array<string> {
        const disassembledInstructions: Array<string> = [];
        let disassembledCount = 0;

        while (disassembledCount < count) {
            const disassembleAddress = (address + disassembledCount) & 0xffff;
            const instruction = decodeInstruction(this.bus, disassembleAddress);

            disassembledInstructions.push(
                `${this.breakpoints.has(disassembleAddress) ? ' *' : '  '} ${hex16(disassembleAddress)}: ${disassemleInstruction(
                    this.bus,
                    disassembleAddress
                )}`
            );

            disassembledCount += instruction.len;
        }

        return disassembledInstructions;
    }

    lastBreakMessage(): string {
        return this.breakMessage;
    }

    getCpu(): Cpu {
        return this.cpu;
    }

    getBus(): Bus {
        return this.bus;
    }

    private system: System;

    private bus: Bus;
    private cartridge: Cartridge;
    private cpu: Cpu;
    private clock: Clock;
    private ram: Ram;
    private interrupt: Interrupt;
    private serial: Serial;
    private ppu: Ppu;
    private audio: Audio;

    private break = false;
    private breakMessage = '';

    private breakpoints = new Set<number>();

    private traces = new Array<TraceEntry>();
}
