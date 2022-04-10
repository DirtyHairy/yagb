import { Cartridge, createCartridge } from './cartridge';
import { decodeInstruction, disassembleInstruction } from './instruction';

import { Audio } from './audio';
import { Bus } from './bus';
import { Clock } from './clock';
import { Cpu } from './cpu';
import { Interrupt } from './interrupt';
import { Joypad } from './joypad';
import { Ppu } from './ppu';
import { Ram } from './ram';
import { Serial } from './serial';
import { System } from './system';
import { Timer } from './timer';
import { Trace } from './trace';
import { hex16 } from '../helper/format';

export class Emulator {
    constructor(cartridgeImage: Uint8Array, printCb: (message: string) => void) {
        this.system = new System(printCb);
        this.bus = new Bus(this.system);
        this.ppu = new Ppu(this.system);
        this.audio = new Audio();
        this.interrupt = new Interrupt();
        this.clock = new Clock(this.ppu);
        this.cpu = new Cpu(this.bus, this.clock, this.interrupt, this.system);
        this.ram = new Ram();
        this.serial = new Serial();
        this.timer = new Timer();
        this.joypad = new Joypad();

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
        this.timer.install(this.bus);
        this.joypad.install(this.bus);

        this.system.onBreak.addHandler((message) => {
            this.break = true;
            this.breakMessage = message;
        });

        this.cpu.onExecute.addHandler((address) => this.trace.add(address));

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

    getTrace(count?: number): string {
        const trace = this.trace.getTrace();

        return (count === undefined ? trace : trace.slice(trace.length - count, trace.length))
            .map((address) => this.disassemblyLineAt(address))
            .join('\n');
    }

    step(count: number): [boolean, number] {
        this.break = false;
        let cycles = 0;

        for (let i = 0; i < count; i++) {
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
        this.timer.reset();
        this.joypad.reset();
        this.interrupt.reset();
        this.trace.reset();
    }

    printState(): string {
        return `CPU:\n${this.cpu.printState()}\n\n` + `IRQ:\n${this.interrupt.printState()}`;
    }

    disassemble(count: number, address = this.cpu.state.p): Array<string> {
        const disassembledInstructions: Array<string> = [];

        for (let i = 0; i < count; i++) {
            const instruction = decodeInstruction(this.bus, address);

            disassembledInstructions.push(this.disassemblyLineAt(address));

            address = (address + instruction.len) & 0xffff;
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

    private disassemblyLineAt(address: number): string {
        return `${this.breakpoints.has(address) ? ' *' : '  '} ${hex16(address)}: ${disassembleInstruction(this.bus, address)}`;
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
    private timer: Timer;
    private joypad: Joypad;

    private trace: Trace = new Trace();

    private break = false;
    private breakMessage = '';

    private breakpoints = new Set<number>();
}
