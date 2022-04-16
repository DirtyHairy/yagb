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
import { Unmapped } from './unmapped';
import { hex16 } from '../helper/format';

export interface Trap {
    address: number;
    trapRead: boolean;
    trapWrite: boolean;
}

export class Emulator {
    constructor(cartridgeImage: Uint8Array, printCb: (message: string) => void) {
        this.system = new System(printCb);
        this.bus = new Bus(this.system);
        this.interrupt = new Interrupt();
        this.ppu = new Ppu(this.system, this.interrupt);
        this.audio = new Audio();
        this.timer = new Timer(this.interrupt);
        this.clock = new Clock(this.ppu, this.timer);
        this.cpu = new Cpu(this.bus, this.clock, this.interrupt, this.system);
        this.ram = new Ram();
        this.serial = new Serial();
        this.joypad = new Joypad();
        const unmapped = new Unmapped();

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
        unmapped.install(this.bus);

        this.system.onBreak.addHandler((message) => {
            this.break = true;
            this.breakMessage = message;
        });

        this.cpu.onExecute.addHandler((address) => this.trace.add(address));
        this.bus.onRead.addHandler((address) => this.traps.get(address)?.trapRead && this.system.break(`trap read from ${hex16(address)}`));
        this.bus.onWrite.addHandler((address) => this.traps.get(address)?.trapWrite && this.system.break(`trap write to ${hex16(address)}`));

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

    addTrapWrite(address: number): void {
        this.traps.set(address, { ...(this.traps.get(address) || { address, trapRead: false, trapWrite: false }), trapWrite: true });
    }

    addTrapRead(address: number): void {
        this.traps.set(address, { ...(this.traps.get(address) || { address, trapRead: false, trapWrite: false }), trapRead: true });
    }

    clearTrap(address: number) {
        this.traps.delete(address);
    }

    clearTraps(): void {
        this.traps.clear();
    }

    getTraps(): Array<Trap> {
        return Array.from(this.traps.values()).sort((t1, t2) => t1.address - t2.address);
    }

    getTrace(count?: number): string {
        const trace = this.trace.getTrace();
        const busLocked = this.bus.isLocked();
        this.bus.unlock();

        const traceLines = (count === undefined ? trace : trace.slice(trace.length - count, trace.length))
            .map((address) => this.disassemblyLineAt(address))
            .join('\n');

        if (busLocked) this.bus.lock();
        return traceLines;
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
        this.bus.reset();
    }

    printState(): string {
        return `CPU:\n${this.cpu.printState()}\n\nIRQ:\n${this.interrupt.printState()}\n\nTimer:\n${this.timer.printState()}\n\nPPU:\n${this.ppu.printState()}`;
    }

    disassemble(count: number, address = this.cpu.state.p): Array<string> {
        const disassembledInstructions: Array<string> = [];
        const busLocked = this.bus.isLocked();
        this.bus.unlock();

        for (let i = 0; i < count; i++) {
            const instruction = decodeInstruction(this.bus, address);

            disassembledInstructions.push(this.disassemblyLineAt(address));

            address = (address + instruction.len) & 0xffff;
        }

        if (busLocked) this.bus.lock();
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

    getFrameIndex(): number {
        return this.ppu.getFrameIndex();
    }

    getFrameData(): ImageData {
        return this.ppu.getFrameData();
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
    private traps = new Map<number, Trap>();
}
