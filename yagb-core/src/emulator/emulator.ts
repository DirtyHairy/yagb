import { Cartridge, CgbSupportLevel, createCartridge } from './cartridge';
import { Joypad, key } from './joypad';
import { decodeInstruction, disassembleInstruction } from './instruction';

import { Apu } from './apu';
import { Bus } from './bus';
import { Clock } from './clock';
import { Cpu } from './cpu';
import { Event } from 'microevent.ts';
import { Interrupt } from './interrupt';
import { Mode } from './mode';
import { Ppu } from './ppu';
import { Ram } from './ram';
import { SampleQueue } from './apu/sample-queue';
import { Savestate } from './savestate';
import { Serial } from './serial';
import { System } from './system';
import { Timer } from './timer';
import { Trace } from './trace';
// import { Unmapped } from './unmapped';
import { hex16 } from '../helper/format';

export interface BusTrap {
    address: number;
    trapRead: boolean;
    trapWrite: boolean;
}

export class Emulator {
    constructor(cartridgeImage: Uint8Array, printCb: (message: string) => void, savedRam?: Uint8Array) {
        this.system = new System(printCb);

        const cartridge = createCartridge(cartridgeImage, this.system);
        if (!cartridge) {
            throw new Error('bad cartridge image');
        }

        const mode = cartridge.cgbSupportLevel === CgbSupportLevel.none ? Mode.dmg : Mode.cgb;

        this.bus = new Bus(this.system);
        this.interrupt = new Interrupt();
        this.ppu = new Ppu(this.system, this.interrupt);
        this.apu = new Apu();
        this.timer = new Timer(this.interrupt);
        this.serial = new Serial(this.interrupt);
        this.clock = new Clock(this.ppu, this.timer, this.serial, this.apu);
        this.cpu = new Cpu(mode, this.bus, this.clock, this.interrupt, this.system);
        this.ram = new Ram();
        this.joypad = new Joypad(this.interrupt);
        // const unmapped = new Unmapped();

        this.cartridge = cartridge;

        this.cartridge.install(this.bus);
        this.ram.install(this.bus);
        this.interrupt.install(this.bus);
        this.serial.install(this.bus);
        this.ppu.install(this.bus);
        this.apu.install(this.bus);
        this.timer.install(this.bus);
        this.joypad.install(this.bus);
        this.sampleQueue?.reset();
        // CGBTODO
        // unmapped.install(this.bus);

        this.cpu.onExecute.addHandler(this.onExecuteHandler);
        this.onTrap = this.system.onTrap;

        this.reset(savedRam);
    }

    getNvData(): Uint8Array | undefined {
        return this.cartridge.getNvData();
    }

    clearCartridgeRam(): void {
        this.cartridge.clearNvData();
    }

    addBreakpoint(address: number): void {
        this.breakpoints.add(address);
        this.updateHooks();
    }

    clearBreakpoint(address: number): void {
        this.breakpoints.delete(address);
        this.updateHooks();
    }

    clearBreakpoints(): void {
        this.breakpoints.clear();
        this.updateHooks();
    }

    getBreakpoints(): Array<number> {
        return Array.from(this.breakpoints).sort();
    }

    addTrapWrite(address: number): void {
        this.busTraps.set(address, {
            ...(this.busTraps.get(address) || {
                address,
                trapRead: false,
                trapWrite: false,
            }),
            trapWrite: true,
        });
        this.updateHooks();
    }

    addTrapRead(address: number): void {
        this.busTraps.set(address, {
            ...(this.busTraps.get(address) || {
                address,
                trapRead: false,
                trapWrite: false,
            }),
            trapRead: true,
        });
        this.updateHooks();
    }

    clearRWTrap(address: number) {
        this.busTraps.delete(address);
        this.updateHooks();
    }

    clearRWTraps(): void {
        this.busTraps.clear();
        this.updateHooks();
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
        this.apu.reset();
    }

    printCartridgeInfo(): string {
        return `Cartridge: ${this.cartridge.describe()}`;
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

    startAudio(sampleRate: number): SampleQueue {
        this.sampleQueue = new SampleQueue(sampleRate);
        this.apu.setSampleQueue(this.sampleQueue);

        return this.sampleQueue;
    }

    save(): Savestate {
        this.savestate.reset();

        this.timer.save(this.savestate);
        this.serial.save(this.savestate);
        this.ram.save(this.savestate);
        this.ppu.save(this.savestate);
        this.interrupt.save(this.savestate);
        this.cpu.save(this.savestate);
        this.cartridge.save(this.savestate);
        this.apu.save(this.savestate);
        this.joypad.save(this.savestate);
        this.bus.save(this.savestate);

        return this.savestate;
    }

    load(data: Uint8Array): void {
        try {
            const savestate = new Savestate(data);

            this.timer.load(savestate);
            this.serial.load(savestate);
            this.ram.load(savestate);
            this.ppu.load(savestate);
            this.interrupt.load(savestate);
            this.cpu.load(savestate);
            this.cartridge.load(savestate);
            this.apu.load(savestate);
            this.joypad.load(savestate);
            this.bus.load(savestate);

            if (savestate.bytesRemaining() !== 0) {
                throw new Error('savestate size mismatch');
            }
        } catch (e) {
            this.reset();
            throw e;
        }
    }

    private disassemblyLineAt(address: number): string {
        return `${this.breakpoints.has(address) ? ' *' : '  '} ${hex16(address)}: ${disassembleInstruction(this.bus, address)}`;
    }

    private onAfterExecuteHandler = (p: number): void => {
        if (this.breakpoints.has(p)) this.system.trap(`hit breakpoint at ${hex16(p)}`);
    };

    private updateHooks(): void {
        if (this.breakpoints.size > 0 && !this.cpu.onAfterExecute.isHandlerAttached(this.onAfterExecuteHandler)) {
            this.cpu.onAfterExecute.addHandler(this.onAfterExecuteHandler);
        }

        if (this.breakpoints.size === 0) {
            this.cpu.onAfterExecute.removeHandler(this.onAfterExecuteHandler);
        }

        const hasReadTraps = Array.from(this.busTraps.values()).some((trap) => trap.trapRead);
        const hasWriteTrap = Array.from(this.busTraps.values()).some((trap) => trap.trapWrite);

        if (hasReadTraps && !this.bus.onRead.isHandlerAttached(this.onBusReadHandler)) {
            this.bus.onRead.addHandler(this.onBusReadHandler);
        }

        if (!hasReadTraps) {
            this.bus.onRead.removeHandler(this.onBusReadHandler);
        }

        if (hasWriteTrap && !this.bus.onWrite.isHandlerAttached(this.onBusWriteHandler)) {
            this.bus.onWrite.addHandler(this.onBusWriteHandler);
        }

        if (!hasWriteTrap) {
            this.bus.onWrite.removeHandler(this.onBusWriteHandler);
        }
    }

    private onBusReadHandler = (address: number) => this.busTraps.get(address)?.trapRead && this.system.trap(`trap read from ${hex16(address)}`);
    private onBusWriteHandler = (address: number) => this.busTraps.get(address)?.trapWrite && this.system.trap(`trap write to ${hex16(address)}`);
    private onExecuteHandler = (address: number) => this.trace.add(address);

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
    private apu: Apu;
    private timer: Timer;
    private joypad: Joypad;
    private sampleQueue: SampleQueue | undefined = undefined;

    private trace: Trace = new Trace(10000);

    private breakpoints = new Set<number>();
    private busTraps = new Map<number, BusTrap>();

    private savestate = new Savestate(new Uint8Array(1024 * 1024));
}
