import { Cartridge, CgbSupportLevel, createCartridge } from './cartridge';
import { Clock, createClock } from './clock';
import { Event, EventInterface } from 'microevent.ts';
import { Joypad, key } from './joypad';
import { Mode, modeToString } from './mode';
import { Ppu, createPpu, ppuFrameOperation } from './ppu';
import { decodeInstruction, disassembleInstruction } from './instruction';

import { Apu } from './apu';
import { Bus } from './bus';
import { Cpu } from './cpu';
import { Infrared } from './infrared';
import { Interrupt } from './interrupt';
import { Palette } from './ppu/palette-compat';
import { Ram } from './ram';
import { SampleQueue } from './apu/sample-queue';
import { Savestate } from './savestate';
import { SavestateHeader } from './savestate-header';
import { Serial } from './serial';
import { System } from './system';
import { Timer } from './timer';
import { Trace } from './trace';
import { Unmapped } from './unmapped';
import { hex16 } from '../helper/format';

const CLOCK_DMG = 1048576;

export const enum PreferredModel {
    dmg = 'dmg',
    cgb = 'cgb',
    auto = 'auto',
}

export interface BusTrap {
    address: number;
    trapRead: boolean;
    trapWrite: boolean;
}

function determineMode(preferredModel: PreferredModel, supportLevel: CgbSupportLevel): Mode {
    switch (preferredModel) {
        case PreferredModel.auto:
            return supportLevel === CgbSupportLevel.none ? Mode.dmg : Mode.cgb;

        case PreferredModel.dmg:
            return supportLevel === CgbSupportLevel.cgbOnly ? Mode.cgb : Mode.dmg;

        case PreferredModel.cgb:
            return supportLevel === CgbSupportLevel.none ? Mode.cgbcompat : Mode.cgb;
    }
}

export class Emulator {
    constructor(private cartridgeImage: Uint8Array, preferredModel: PreferredModel, printCb: (message: string) => void, savedRam?: Uint8Array) {
        this.system = new System(printCb);

        const cartridge = createCartridge(cartridgeImage, this.system);
        if (!cartridge) {
            throw new Error('bad cartridge image');
        }

        this.mode = determineMode(preferredModel, cartridge.cgbSupportLevel);

        this.bus = new Bus(this.mode, this.system);
        this.interrupt = new Interrupt();
        this.ppu = createPpu(this.mode, this.system, this.interrupt, cartridgeImage);
        this.apu = new Apu();
        this.timer = new Timer(this.interrupt);
        this.serial = new Serial(this.interrupt);
        this.clock = createClock(this.mode, this.ppu, this.timer, this.serial, this.apu);
        this.cpu = new Cpu(this.mode, this.bus, this.clock, this.interrupt, this.system);
        this.ram = new Ram(this.mode);
        this.joypad = new Joypad(this.interrupt);
        this.infrared = new Infrared(this.mode);
        this.cartridge = cartridge;
        const unmapped = new Unmapped(this.mode, this.bus);

        this.ppu.setCpu(this.cpu).setClock(this.clock);

        this.cartridge.install(this.bus);
        this.ram.install(this.bus);
        this.interrupt.install(this.bus);
        this.serial.install(this.bus);
        this.ppu.install(this.bus);
        this.apu.install(this.bus);
        this.timer.install(this.bus);
        this.joypad.install(this.bus);
        this.infrared.install(this.bus);
        this.clock.install(this.bus);
        this.sampleQueue?.reset();
        unmapped.install();

        this.cpu.onExecute.addHandler(this.onExecuteHandler);
        this.onTrap = this.system.onTrap;

        this.reset(savedRam);
    }

    get newFrameEvent(): EventInterface<ppuFrameOperation> {
        return this.ppu.newFrameEvent;
    }

    getClock(): number {
        return this.mode === Mode.cgb ? 2 * CLOCK_DMG : CLOCK_DMG;
    }

    getNvData(): Uint8Array | undefined {
        return this.cartridge.getNvData();
    }

    getScanline(): number {
        return this.ppu.getScanline();
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

    addScanlineTrap(line: number): void {
        this.scanlineTraps.add(line);
        this.updateHooks();
    }

    clearScanlineTrap(line: number): void {
        this.scanlineTraps.delete(line);
        this.updateHooks();
    }

    clearScahnlineTraps(): void {
        this.scanlineTraps.clear();
        this.updateHooks();
    }

    getScanlineTraps(): Array<number> {
        return Array.from(this.scanlineTraps).sort();
    }

    getCartridgeImage(): Uint8Array {
        return this.cartridgeImage;
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
        const dmaBase = this.bus.getDmaBase();
        this.bus.unlock();

        const traceLines = (count === undefined ? trace : trace.slice(trace.length - count, trace.length))
            .map((address, index) => `${index + 1}. ${this.disassemblyLineAt(address)}`)
            .join('\n');

        if (busLocked) this.bus.lock(dmaBase);
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
        this.clock.reset();
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
        let state = `CPU:\n${this.cpu.printState()}\n\nIRQ:\n${this.interrupt.printState()}\n\nTimer:\n${this.timer.printState()}\n\nPPU:\n${this.ppu.printState()}\n\nCartridge:\n${this.cartridge.printState()}`;
        if (this.mode === Mode.cgb) state += `\n\nClock:\n${this.clock.printState()}`;

        return state;
    }

    disassemble(count: number, address = this.cpu.state.p): Array<string> {
        const disassembledInstructions: Array<string> = [];
        const busLocked = this.bus.isLocked();
        const dmaBase = this.bus.getDmaBase();
        this.bus.unlock();

        for (let i = 0; i < count; i++) {
            const instruction = decodeInstruction(this.bus, address);

            disassembledInstructions.push(this.disassemblyLineAt(address));

            address = (address + instruction.len) & 0xffff;
        }

        if (busLocked) this.bus.lock(dmaBase);
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

    getMode(): Mode {
        return this.mode;
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
        const header = new SavestateHeader(this.mode);

        this.savestate.reset();

        header.save(this.savestate);
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
        this.clock.save(this.savestate);

        return this.savestate;
    }

    load(data: Uint8Array): void {
        try {
            const savestate = new Savestate(data);
            const header = SavestateHeader.load(savestate);

            if (header.mode !== this.mode) {
                throw new Error(`unable to load: savestate is for ${modeToString(header.mode)}, but emulator is running as ${modeToString(this.mode)}`);
            }

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
            this.clock.load(savestate);

            if (savestate.bytesRemaining() !== 0) {
                throw new Error('savestate size mismatch');
            }
        } catch (e) {
            this.reset();
            throw e;
        }
    }

    setPalette(palette: Palette): void {
        this.ppu.setPalette(palette);
    }

    getPalette(): Palette {
        return this.ppu.getPalette();
    }

    private disassemblyLineAt(address: number): string {
        return `${this.breakpoints.has(address) ? ' *' : '  '} ${hex16(address)}: ${disassembleInstruction(this.bus, address)}`;
    }

    private onAfterExecuteHandler = (p: number): void => {
        if (this.breakpoints.has(p)) this.system.trap(`hit breakpoint at ${hex16(p)}`);

        const scanline = this.ppu.getScanline();
        if (this.lastScanline !== scanline && this.scanlineTraps.has(scanline)) this.system.trap(`hit scanline trap at line ${scanline}`);

        this.lastScanline = scanline;
    };

    private updateHooks(): void {
        if ((this.breakpoints.size > 0 || this.scanlineTraps.size > 0) && !this.cpu.onAfterExecute.isHandlerAttached(this.onAfterExecuteHandler)) {
            this.cpu.onAfterExecute.addHandler(this.onAfterExecuteHandler);
            this.lastScanline = -1;
        }

        if (this.breakpoints.size === 0 && this.scanlineTraps.size === 0) {
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

    private mode: Mode;

    private bus: Bus;
    private cartridge: Cartridge;
    private cpu: Cpu;
    private clock: Clock;
    private ram: Ram;
    private infrared: Infrared;
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
    private scanlineTraps = new Set<number>();
    private lastScanline = -1;

    private savestate = new Savestate(new Uint8Array(1024 * 1024));
}
