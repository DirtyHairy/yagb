import { Bus, ReadHandler, WriteHandler } from '../../src/emulator/bus';
import { Cpu, r8 } from '../../src/emulator/cpu';

import { Apu } from '../../src/emulator/apu';
import { Clock } from '../../src/emulator/clock';
import { ClockDmg } from '../../src/emulator/clock/clock-dmg';
import { Interrupt } from '../../src/emulator/interrupt';
import { Mode } from '../../src/emulator/mode';
import { Ppu } from '../../src/emulator/ppu';
import { PpuDmg } from '../../src/emulator/ppu/ppu-dmg';
import { Ram } from '../../src/emulator/ram';
import { Serial } from './../../src/emulator/serial';
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
    public readonly serial: Serial;
    public readonly cpu: Cpu;
    public readonly unmapped: Unmapped;
    public readonly cartridge: Uint8Array;
    public readonly apu: Apu;

    public readonly code: ArrayLike<number>;
    public readonly address: number;

    constructor(code: ArrayLike<number>, address = 0x100) {
        this.system = new System((msg) => console.log(msg));
        this.system.onTrap.addHandler((msg) => {
            throw new Error(msg);
        });

        this.interrupt = new Interrupt();
        this.ppu = new PpuDmg(this.system, this.interrupt, Mode.dmg, 0);
        this.timer = new Timer(this.interrupt);
        this.serial = new Serial(this.interrupt);
        this.apu = new Apu();
        this.clock = new ClockDmg(this.ppu, this.timer, this.serial, this.apu);
        this.bus = new Bus(Mode.dmg, this.system);
        this.ram = new Ram(Mode.dmg);
        this.cpu = new Cpu(Mode.dmg, this.bus, this.clock, this.interrupt, this.system);
        this.cartridge = new Uint8Array(0x8000);
        this.unmapped = new Unmapped(Mode.dmg, this.bus);

        this.ppu.setCpu(this.cpu).setClock(this.clock);

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
        this.unmapped.install();

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

        this.cpu.state.r8[r8.f] = 0x00;
    }
}
