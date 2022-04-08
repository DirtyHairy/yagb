import { Bus, ReadHandler, WriteHandler } from './bus';
import { Cpu, flag, r8 } from './cpu';

import { Clock } from './clock';
import { System } from './system';

interface Environment {
    bus: Bus;
    cpu: Cpu;
    system: System;
    clock: Clock;
}

function newEnvironment(code: ArrayLike<number>): Environment {
    const system = new System((msg) => console.log(msg));
    system.onBreak.addHandler((msg) => {
        throw new Error(msg);
    });

    const clock = new Clock();

    const bus = new Bus(system);
    const cpu = new Cpu(bus, clock, system);
    const memory = new Uint8Array(0x10000);

    const read: ReadHandler = (address) => memory[address];
    const write: WriteHandler = (address, value) => (memory[address] = value);

    for (let i = 0; i < 0x10000; i++) {
        bus.readMap[i] = read;
        bus.writeMap[i] = write;
    }

    memory.subarray(0x100).set(code);
    cpu.reset();

    return { bus, cpu, system, clock };
}

describe('The glorious CPU', () => {
    describe('DEC B', () => {
        let cpu: Cpu;
        beforeEach(() => {
            cpu = newEnvironment([0x05]).cpu;
        });

        it('decrements', () => {
            cpu.state.r8[r8.b] = 0x42;

            cpu.step(1);

            expect(cpu.state.r8[r8.b]).toBe(0x41);
        });

        it('handles underflow', () => {
            cpu.state.r8[r8.b] = 0x00;

            cpu.step(1);

            expect(cpu.state.r8[r8.b]).toBe(0xff);
        });

        it('sets z correctly', () => {
            cpu.state.r8[r8.b] = 0x01;

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(flag.z | flag.n);
        });

        it('sets n', () => {
            cpu.state.r8[r8.b] = 0x02;

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(flag.n);
        });

        it('sets half-carry correctly, case 0x10', () => {
            cpu.state.r8[r8.b] = 0x10;

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(flag.h | flag.n);
        });

        it('sets half-carry correctly, case 0x00', () => {
            cpu.state.r8[r8.b] = 0x00;

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(flag.h | flag.n);
        });

        it('preserves carry', () => {
            cpu.state.r8[r8.b] = 0x02;
            cpu.state.r8[r8.f] = flag.c;

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(flag.c | flag.n);
        });
    });

    describe('INC B', () => {
        let cpu: Cpu;
        beforeEach(() => {
            cpu = newEnvironment([0x04]).cpu;
        });

        it('increments', () => {
            cpu.state.r8[r8.b] = 0x42;

            cpu.step(1);

            expect(cpu.state.r8[r8.b]).toBe(0x43);
        });

        it('handles overflow', () => {
            cpu.state.r8[r8.b] = 0xff;

            cpu.step(1);

            expect(cpu.state.r8[r8.b]).toBe(0x00);
        });

        it('sets z correctly', () => {
            cpu.state.r8[r8.b] = 0xff;

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(flag.z | flag.h);
        });

        it('clears n', () => {
            cpu.state.r8[r8.b] = 0x02;

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(0);
        });

        it('sets half-carry correctly, case 0x0f', () => {
            cpu.state.r8[r8.b] = 0x0f;

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(flag.h);
        });

        it('sets half-carry correctly, case 0xff', () => {
            cpu.state.r8[r8.b] = 0xff;

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(flag.h | flag.z);
        });

        it('preserves carry', () => {
            cpu.state.r8[r8.b] = 0x02;
            cpu.state.r8[r8.f] = flag.c;

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(flag.c);
        });
    });
});
