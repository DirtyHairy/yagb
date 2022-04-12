import { Bus, ReadHandler, WriteHandler } from '../../src/emulator/bus';
import { Cpu } from '../../src/emulator/cpu';
import { System } from '../../src/emulator/system';
import { Clock } from '../../src/emulator/clock';
import { Interrupt } from '../../src/emulator/interrupt';
import { Ppu } from '../../src/emulator/ppu';
import { Timer } from '../../src/emulator/timer';
import { Ram } from '../../src/emulator/ram';

export interface Environment {
    bus: Bus;
    cpu: Cpu;
    system: System;
    clock: Clock;
    interrupt: Interrupt;
}

export function newEnvironment(code: ArrayLike<number>): Environment {
    const system = new System((msg) => console.log(msg));
    system.onBreak.addHandler((msg) => {
        throw new Error(msg);
    });

    const ppu = new Ppu(system);
    const interrupt = new Interrupt();
    const timer = new Timer(interrupt);

    const clock = new Clock(ppu, timer);

    const bus = new Bus(system);
    const ram = new Ram();
    const cpu = new Cpu(bus, clock, interrupt, system);
    const cartridge = new Uint8Array(0x8000);

    const read: ReadHandler = (address) => cartridge[address];
    const write: WriteHandler = (address, value) => (cartridge[address] = value);

    for (let i = 0; i < 0x8000; i++) {
        bus.map(i, read, write);
    }

    ram.install(bus);
    interrupt.install(bus);
    timer.install(bus);

    cartridge.subarray(0x100).set(code);
    cpu.reset();
    interrupt.reset();

    return { bus, cpu, system, clock, interrupt };
}
