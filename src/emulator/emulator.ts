import { Cartridge, createCartridge } from './cartridge';
import { Joypad, key } from './joypad';
import { decodeInstruction, disassembleInstruction } from './instruction';

import { Audio } from './audio';
import { Bus } from './bus';
import { Clock } from './clock';
import { Cpu } from './cpu';
import { Event } from 'microevent.ts';
import { Interrupt } from './interrupt';
import { Ppu } from './ppu';
import { Ram } from './ram';
import { Serial } from './serial';
import { System } from './system';
import { Timer } from './timer';
import { Trace } from './trace';
import { Unmapped } from './unmapped';
import { hex16 } from '../helper/format';

export interface BusTrap {
    address: number;
    trapRead: boolean;
    trapWrite: boolean;
}

export class Emulator {
    constructor(cartridgeImage: Uint8Array, printCb: (message: string) => void, savedRam?: Uint8Array) {
        this.system = new System(printCb);
        this.bus = new Bus(this.system);
        this.interrupt = new Interrupt();
        this.ppu = new Ppu(this.system, this.interrupt);
        this.audio = new Audio();
        this.timer = new Timer(this.interrupt);
        this.serial = new Serial(this.interrupt);
        this.clock = new Clock(this.ppu, this.timer, this.serial);
        this.cpu = new Cpu(this.bus, this.clock, this.interrupt, this.system);
        this.ram = new Ram();
        this.joypad = new Joypad(this.interrupt);
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

        this.cpu.onExecute.addHandler((address) => this.trace.add(address));
        this.bus.onRead.addHandler((address) => this.busTraps.get(address)?.trapRead && this.system.trap(`trap read from ${hex16(address)}`));
        this.bus.onWrite.addHandler((address) => this.busTraps.get(address)?.trapWrite && this.system.trap(`trap write to ${hex16(address)}`));
        this.onTrap = this.system.onTrap;

        this.reset(savedRam);
    }

    getCartridgeRam(): Uint8Array | undefined {
        return this.cartridge.getRam();
    }

    clearCartridgeRam(): void {
        this.cartridge.clearRam();
    }

    addBreakpoint(address: number): void {
        this.breakpoints.add(address);

        if (!this.cpu.onAfterExecute.isHandlerAttached(this.onAfterExecuteHandler)) {
            this.cpu.onAfterExecute.addHandler(this.onAfterExecuteHandler);
        }
    }

    clearBreakpoint(address: number): void {
        this.breakpoints.delete(address);

        if (this.breakpoints.size === 0) this.cpu.onAfterExecute.removeHandler(this.onAfterExecuteHandler);
    }

    clearBreakpoints(): void {
        this.breakpoints.clear();
        this.cpu.onAfterExecute.removeHandler(this.onAfterExecuteHandler);
    }

    getBreakpoints(): Array<number> {
        return Array.from(this.breakpoints).sort();
    }

    addTrapWrite(address: number): void {
        this.busTraps.set(address, { ...(this.busTraps.get(address) || { address, trapRead: false, trapWrite: false }), trapWrite: true });
    }

    addTrapRead(address: number): void {
        this.busTraps.set(address, { ...(this.busTraps.get(address) || { address, trapRead: false, trapWrite: false }), trapRead: true });
    }

    clearRWTrap(address: number) {
        this.busTraps.delete(address);
    }

    clearRWTraps(): void {
        this.busTraps.clear();
    }

    getTraps(): Array<BusTrap> {
        return Array.from(this.busTraps.values()).sort((t1, t2) => t1.address - t2.address);
    }

    isTrap(): boolean {
        return this.system.isTrap;
    }

    getTrace(count?: number): string {
        const trace = this.trace.getTrace();
        const busLocked = this.bus.isLocked();
        this.bus.unlock();

        const traceLines = (count === undefined ? trace : trace.slice(trace.length - count, trace.length))
            .map((address, index) => `${index + 1}. ${this.disassemblyLineAt(address)}`)
            .join('\n');

        if (busLocked) this.bus.lock();
        return traceLines;
    }

    step(count: number): number {
        this.system.clearTrap();
        return this.cpu.step(count);
    }

    run(cyclesGoal: number): number {
        this.system.clearTrap();
        return this.cpu.run(cyclesGoal);
    }

    reset(savedRam?: Uint8Array): void {
        this.cartridge.reset(savedRam);
        this.cpu.reset();
        this.ram.reset();
        this.ppu.reset();
        this.timer.reset();
        this.joypad.reset();
        this.interrupt.reset();
        this.trace.reset();
        this.bus.reset();
        this.serial.reset();
    }

    printCartridgeInfo(): string {
        return `Cartridge: ${this.cartridge.printInfo()}`;
    }

    printState(): string {
        return `CPU:\n${this.cpu.printState()}\n\nIRQ:\n${this.interrupt.printState()}\n\nTimer:\n${this.timer.printState()}\n\nPPU:\n${this.ppu.printState()}\n\nCartridge:\n${this.cartridge.printState()}`;
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

    lastTrapMessage(): string {
        return this.system.getTrapMessage();
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

    getFrameData(): ArrayBuffer {
        return this.ppu.getFrameData();
    }

    keyDown(k: key): void {
        this.joypad.down(k);
    }

    keyUp(k: key): void {
        this.joypad.up(k);
    }

    clearKeys(): void {
        this.joypad.clearKeys();
    }

    private disassemblyLineAt(address: number): string {
        return `${this.breakpoints.has(address) ? ' *' : '  '} ${hex16(address)}: ${disassembleInstruction(this.bus, address)}`;
    }

    private onAfterExecuteHandler = (p: number): void => {
        if (this.breakpoints.has(p)) this.system.trap(`hit breakpoint at ${hex16(p)}`);
    };

    readonly onTrap: Event<string>;

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

    private breakpoints = new Set<number>();
    private busTraps = new Map<number, BusTrap>();
}
