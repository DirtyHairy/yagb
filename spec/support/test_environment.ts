import { Bus, ReadHandler, WriteHandler } from '../../src/emulator/bus';

import { Clock } from '../../src/emulator/clock';
import { Cpu } from '../../src/emulator/cpu';
import { Interrupt } from '../../src/emulator/interrupt';
import { Ppu } from '../../src/emulator/ppu';
import { Ram } from '../../src/emulator/ram';
import { System } from '../../src/emulator/system';
import { Timer } from '../../src/emulator/timer';
import { Unmapped } from '../../src/emulator/unmapped';

export class TestEnvironment {
    public readonly system: System;
    public readonly interrupt: Interrupt;
    public readonly ppu: Ppu;
    public readonly timer: Timer;
    public readonly clock: Clock;
    public readonly bus: Bus;
    public readonly ram: Ram;
    public readonly cpu: Cpu;
    public readonly unmapped: Unmapped;
    public readonly cartridge: Uint8Array;

    public readonly code: ArrayLike<number>;
    public readonly address: number;

    constructor(code: ArrayLike<number>, address = 0x100) {
        this.system = new System((msg) => console.log(msg));
        this.system.onBreak.addHandler((msg) => {
            throw new Error(msg);
        });

        this.interrupt = new Interrupt();
        this.ppu = new Ppu(this.system, this.interrupt);
        this.timer = new Timer(this.interrupt);

        this.clock = new Clock(this.ppu, this.timer);

        this.bus = new Bus(this.system);
        this.ram = new Ram();
        this.cpu = new Cpu(this.bus, this.clock, this.interrupt, this.system);
        this.cartridge = new Uint8Array(0x8000);
        this.unmapped = new Unmapped();

        this.code = code;
        this.address = address;

        const read: ReadHandler = (address) => this.cartridge[address];
        const write: WriteHandler = (address, value) => (this.cartridge[address] = value);

        for (let i = 0; i < 0x8000; i++) {
            this.bus.map(i, read, write);
        }

        for (let i = 0xf00; i < 0xff80; i++) {
            this.bus.map(i, read, write);
        }

        this.ram.install(this.bus);
        this.interrupt.install(this.bus);
        this.timer.install(this.bus);
        this.unmapped.install(this.bus);

        this.reset();
    }

    public reset(): void {
        this.cartridge.fill(0);
        this.cpu.reset();
        this.ram.reset();
        this.ppu.reset();
        this.timer.reset();
        this.interrupt.reset();
        this.bus.reset();

        this.cpu.state.p = this.address;
        this.cartridge.subarray(this.address).set(this.code);
    }
}