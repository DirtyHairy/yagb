import { Bus, ReadHandler, WriteHandler } from './bus';
import { Cpu, flag, r8 } from './cpu';

import { Clock } from './clock';
import { Ppu } from './ppu';
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

    const ppu = new Ppu(system);

    const clock = new Clock(ppu);

    const bus = new Bus(system);
    const cpu = new Cpu(bus, clock, system);
    const memory = new Uint8Array(0x10000);

    const read: ReadHandler = (address) => memory[address];
    const write: WriteHandler = (address, value) => (memory[address] = value);

    for (let i = 0; i < 0x10000; i++) {
        bus.map(i, read, write);
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

    describe('CP', () => {
        function setup(lhs: number, rhs: number): Environment {
            const env = newEnvironment([0xfe, rhs]);

            env.cpu.state.r8[r8.a] = lhs;

            return env;
        }

        describe('handles Z correctly', () => {
            it('0x42 vs 0x43', () => {
                const { cpu } = setup(0x42, 0x43);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.z).toBe(0);
            });

            it('0x42 vs 0x42', () => {
                const { cpu } = setup(0x42, 0x42);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
            });
        });

        it('it sets N', () => {
            const { cpu } = setup(0x42, 0x42);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.n).toBe(flag.n);
        });

        describe('handles C correctly', () => {
            it('0x42 vs 0x43', () => {
                const { cpu } = setup(0x42, 0x43);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.c).toBe(flag.c);
            });

            it('0x42 vs 0x42', () => {
                const { cpu } = setup(0x42, 0x42);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.c).toBe(0);
            });

            it('0x42 vs 0x41', () => {
                const { cpu } = setup(0x42, 0x41);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.c).toBe(0);
            });
        });

        describe('handles C correctly', () => {
            it('0x02 vs 0x03', () => {
                const { cpu } = setup(0x02, 0x03);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.h).toBe(flag.h);
            });

            it('0xf2 vs 0xe3', () => {
                const { cpu } = setup(0xf2, 0xe3);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.h).toBe(flag.h);
            });

            it('0x42 vs 0x42', () => {
                const { cpu } = setup(0x42, 0x42);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.h).toBe(0);
            });

            it('0x03 vs 0x02', () => {
                const { cpu } = setup(0x03, 0x02);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.h).toBe(0);
            });

            it('0x13 vs 0x22', () => {
                const { cpu } = setup(0x13, 0x22);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.h).toBe(0);
            });
        });
    });

    describe('OR D', () => {
        let cpu: Cpu;
        beforeEach(() => {
            cpu = newEnvironment([0xb2]).cpu;
        });

        it('calculates A | C', () => {
            cpu.state.r8[r8.a] = 0x15;
            cpu.state.r8[r8.d] = 0x32;

            cpu.step(1);

            expect(cpu.state.r8[r8.a]).toBe(0x37);
        });

        it('sets Z if zero', () => {
            cpu.state.r8[r8.a] = 0x00;
            cpu.state.r8[r8.d] = 0x00;

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
        });

        it('does not set Z if zero', () => {
            cpu.state.r8[r8.a] = 0x00;
            cpu.state.r8[r8.d] = 0x10;

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(0);
        });

        it('preserves N, C, and H', () => {
            cpu.state.r8[r8.a] = 0x01;
            cpu.state.r8[r8.d] = 0x10;
            cpu.state.r8[r8.f] = flag.n | flag.c | flag.h;

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & ~flag.z).toBe(flag.n | flag.c | flag.h);
        });
    });
});
