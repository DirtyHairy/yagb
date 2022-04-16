import { Bus } from '../../src/emulator/bus';
import { Clock } from '../../src/emulator/clock';
import { Cpu } from '../../src/emulator/cpu';
import { Interrupt } from '../../src/emulator/interrupt';
import { System } from '../../src/emulator/system';
import { TestEnvironment } from './test_environment';

export interface Environment {
    bus: Bus;
    cpu: Cpu;
    system: System;
    clock: Clock;
    interrupt: Interrupt;
    cartridge: Uint8Array;
    env: TestEnvironment;
}

export function newEnvironment(code: ArrayLike<number>, address = 0x100): Environment {
    const env = new TestEnvironment(code, address);

    return { bus: env.bus, cpu: env.cpu, system: env.system, clock: env.clock, interrupt: env.interrupt, cartridge: env.cartridge, env: env };
}
