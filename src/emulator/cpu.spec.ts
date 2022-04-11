import { Bus, ReadHandler, WriteHandler } from './bus';
import { Cpu, flag, r16, r8 } from './cpu';
import { Interrupt, irq } from './interrupt';

import { Clock } from './clock';
import { Ppu } from './ppu';
import { Ram } from './ram';
import { System } from './system';
import { Timer } from './timer';

interface Environment {
    bus: Bus;
    cpu: Cpu;
    system: System;
    clock: Clock;
    interrupt: Interrupt;
}

function newEnvironment(code: ArrayLike<number>): Environment {
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

        it('calculates A | D', () => {
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

        it('clears N, C, and H', () => {
            cpu.state.r8[r8.a] = 0x01;
            cpu.state.r8[r8.d] = 0x10;
            cpu.state.r8[r8.f] = flag.n | flag.c | flag.h;

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & ~flag.z).toBe(0);
        });
    });

    describe('interrupt dispatch', () => {
        function setup(enableInterrupts: boolean, iflag: number, iena = 0x1f): Environment {
            const environment = newEnvironment([0x00]);

            environment.bus.write(0xff0f, iflag);
            environment.bus.write(0xffff, iena);

            environment.cpu.state.interruptsEnabled = enableInterrupts;
            environment.cpu.state.r16[r16.sp] = 0x1000;

            return environment;
        }

        it('transfers control to 0x40 on vblank', () => {
            const { cpu } = setup(true, irq.vblank);

            cpu.step(1);

            expect(cpu.state.p).toBe(0x40);
        });

        it('transfers control to 0x48 on stat', () => {
            const { cpu } = setup(true, irq.stat);

            cpu.step(1);

            expect(cpu.state.p).toBe(0x48);
        });

        it('transfers control to 0x50 on timer', () => {
            const { cpu } = setup(true, irq.timer);

            cpu.step(1);

            expect(cpu.state.p).toBe(0x50);
        });

        it('transfers control to 0x58 on vblank', () => {
            const { cpu } = setup(true, irq.serial);

            cpu.step(1);

            expect(cpu.state.p).toBe(0x58);
        });

        it('transfers control to 0x60 on joypad', () => {
            const { cpu } = setup(true, irq.joypad);

            cpu.step(1);

            expect(cpu.state.p).toBe(0x60);
        });

        it('pushes P to the stack', () => {
            const { cpu, bus } = setup(true, irq.vblank);
            const sp = cpu.state.r16[r16.sp];

            cpu.step(1);

            expect(cpu.state.r16[r16.sp]).toBe(sp - 2);
            expect(bus.read16(cpu.state.r16[r16.sp])).toBe(0x0100);
        });

        it('disables interrupts', () => {
            const { cpu } = setup(true, irq.vblank);

            cpu.step(1);

            expect(cpu.state.interruptsEnabled).toBe(false);
        });

        it('clears the interrupt flag', () => {
            const { cpu, bus } = setup(true, irq.vblank | irq.stat);

            cpu.step(1);

            expect(bus.read(0xff0f)).toBe(irq.stat);
        });

        it('does not execute if interrupts are disabled', () => {
            const { cpu } = setup(false, irq.vblank);

            cpu.step(1);

            expect(cpu.state.p).toBe(0x101);
        });

        it('does not execute if interrupts are masked', () => {
            const { cpu } = setup(false, irq.vblank, 0);

            cpu.step(1);

            expect(cpu.state.p).toBe(0x101);
        });

        it('ignores masked interrupts', () => {
            const { cpu, bus } = setup(true, irq.timer | irq.vblank, 0x1f ^ irq.vblank);

            cpu.step(1);

            expect(cpu.state.p).toBe(0x50);
            expect(bus.read(0xff0f)).toBe(irq.vblank);
        });
    });

    describe('CPL', () => {
        let cpu: Cpu;
        beforeEach(() => {
            cpu = newEnvironment([0x2f]).cpu;
        });

        it('flips bits in A correctly', () => {
            cpu.state.r8[r8.a] = 0x20;

            cpu.step(1);

            expect(cpu.state.r8[r8.a]).toBe(0xdf);
        });
    });

    describe('PUSH BC', () => {
        function setup(r16bc: number): Environment {
            const env = newEnvironment([0xc5]);

            env.cpu.state.r8[r8.b] = (r16bc >> 8) & 0xff;
            env.cpu.state.r8[r8.c] = r16bc & 0xff;

            return env;
        }

        it('decreases stack pointer correctly', () => {
            const { cpu } = setup(0x1532);

            const sp = cpu.state.r16[r16.sp];

            cpu.step(1);

            expect(cpu.state.r16[r16.sp]).toBe(sp - 2);
        });

        it('pushes the value to the stack', () => {
            const value = 0x1532;
            const { bus, cpu } = setup(value);

            cpu.step(1);

            expect(bus.read16(cpu.state.r16[r16.sp])).toBe(value);
        });
    });

    describe('POP BC', () => {
        function setup(r16bc: number): Environment {
            const env = newEnvironment([0xc1]);

            env.cpu.state.r16[r16.sp] = (env.cpu.state.r16[r16.sp] - 1) & 0xffff;
            env.bus.write(env.cpu.state.r16[r16.sp], r16bc >> 8);
            env.cpu.state.r16[r16.sp] = (env.cpu.state.r16[r16.sp] - 1) & 0xffff;
            env.bus.write(env.cpu.state.r16[r16.sp], r16bc & 0xff);

            return env;
        }

        it('increases stack pointer correctly', () => {
            const { cpu } = setup(0x1532);

            const sp = cpu.state.r16[r16.sp];

            cpu.step(1);

            expect(cpu.state.r16[r16.sp]).toBe(sp + 2);
        });

        it('pops the value from the stack', () => {
            const value = 0x1532;
            const { cpu } = setup(value);

            cpu.step(1);

            expect(cpu.state.r16[r16.bc]).toBe(value);
        });
    });

    describe('POP AF', () => {
        function setup(r16af: number): Environment {
            const env = newEnvironment([0xf1]);

            env.cpu.state.r16[r16.sp] = (env.cpu.state.r16[r16.sp] - 1) & 0xffff;
            env.bus.write(env.cpu.state.r16[r16.sp], r16af >> 8);
            env.cpu.state.r16[r16.sp] = (env.cpu.state.r16[r16.sp] - 1) & 0xffff;
            env.bus.write(env.cpu.state.r16[r16.sp], r16af & 0xff);

            return env;
        }

        it('ignores low nibble of F on pop', () => {
            const value = 0x1532;
            const { cpu } = setup(value);

            cpu.step(1);

            expect(cpu.state.r16[r16.af]).toBe(value & 0xfff0);
        });
    });

    describe('AND D', () => {
        let cpu: Cpu;
        beforeEach(() => {
            cpu = newEnvironment([0xa2]).cpu;
        });

        it('calculates A & D', () => {
            cpu.state.r8[r8.a] = 0x15;
            cpu.state.r8[r8.d] = 0x32;

            cpu.step(1);

            expect(cpu.state.r8[r8.a]).toBe(0x10);
        });

        it('sets Z if zero', () => {
            cpu.state.r8[r8.a] = 0x00;
            cpu.state.r8[r8.d] = 0x00;

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
        });

        it('does not set Z if zero', () => {
            cpu.state.r8[r8.a] = 0x15;
            cpu.state.r8[r8.d] = 0x32;

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(0);
        });

        it('clears N, C', () => {
            cpu.state.r8[r8.a] = 0x15;
            cpu.state.r8[r8.d] = 0x32;
            cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | flag.c;

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & (flag.n | flag.c)).toBe(0);
        });

        it('sets H', () => {
            cpu.state.r8[r8.a] = 0x15;
            cpu.state.r8[r8.d] = 0x32;
            cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | flag.c;

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.h).toBe(flag.h);
        });
    });

    describe('AND (HL)', () => {
        function setup(lhs: number, rhs: number): Environment {
            const env = newEnvironment([0xa6]);

            const address = 0x2000;

            env.cpu.state.r8[r8.a] = lhs;
            env.cpu.state.r16[r16.hl] = address;
            env.bus.write(address, rhs);

            env.cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | flag.c;

            return env;
        }

        it('calculates A & (HL)', () => {
            const { cpu } = setup(0x15, 0x32);

            cpu.step(1);

            expect(cpu.state.r8[r8.a]).toBe(0x10);
        });

        it('sets Z if zero', () => {
            const { cpu } = setup(0x00, 0x00);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
        });

        it('does not set Z if zero', () => {
            const { cpu } = setup(0x15, 0x32);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(0);
        });

        it('clears N, C', () => {
            const { cpu } = setup(0x15, 0x32);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & (flag.n | flag.c)).toBe(0);
        });

        it('sets H', () => {
            const { cpu } = setup(0x15, 0x32);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.h).toBe(flag.h);
        });
    });

    describe('OR (HL)', () => {
        function setup(lhs: number, rhs: number): Environment {
            const env = newEnvironment([0xb6]);

            const address = 0x2000;

            env.cpu.state.r8[r8.a] = lhs;
            env.cpu.state.r16[r16.hl] = address;
            env.bus.write(address, rhs);

            env.cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | flag.c;

            return env;
        }

        it('calculates A & (HL)', () => {
            const { cpu } = setup(0x15, 0x32);

            cpu.step(1);

            expect(cpu.state.r8[r8.a]).toBe(0x37);
        });

        it('sets Z if zero', () => {
            const { cpu } = setup(0x00, 0x00);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
        });

        it('does not set Z if zero', () => {
            const { cpu } = setup(0x15, 0x32);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(0);
        });

        it('clears N, H, C', () => {
            const { cpu } = setup(0x15, 0x32);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & (flag.n | flag.h | flag.c)).toBe(0);
        });
    });

    describe('XOR D', () => {
        let cpu: Cpu;
        beforeEach(() => {
            cpu = newEnvironment([0xaa]).cpu;
        });

        it('calculates A ^ D', () => {
            cpu.state.r8[r8.a] = 0x15;
            cpu.state.r8[r8.d] = 0x32;

            cpu.step(1);

            expect(cpu.state.r8[r8.a]).toBe(0x27);
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

        it('clears N, C, and H', () => {
            cpu.state.r8[r8.a] = 0x01;
            cpu.state.r8[r8.d] = 0x10;
            cpu.state.r8[r8.f] = flag.n | flag.c | flag.h;

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & ~flag.z).toBe(0);
        });
    });

    describe('XOR (HL)', () => {
        function setup(lhs: number, rhs: number): Environment {
            const env = newEnvironment([0xae]);

            const address = 0x2000;

            env.cpu.state.r8[r8.a] = lhs;
            env.cpu.state.r16[r16.hl] = address;
            env.bus.write(address, rhs);

            env.cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | flag.c;

            return env;
        }

        it('calculates A ^ (HL)', () => {
            const { cpu } = setup(0x15, 0x32);

            cpu.step(1);

            expect(cpu.state.r8[r8.a]).toBe(0x27);
        });

        it('sets Z if zero', () => {
            const { cpu } = setup(0x00, 0x00);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
        });

        it('does not set Z if zero', () => {
            const { cpu } = setup(0x15, 0x32);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(0);
        });

        it('clears N, H, C', () => {
            const { cpu } = setup(0x15, 0x32);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & (flag.n | flag.h | flag.c)).toBe(0);
        });
    });

    describe('JR NZ, d8', () => {
        const instructionLength = 2;
        const baseAddress = 0x100;

        function setup(jumppoint: number, flags: number): Environment {
            const env = newEnvironment([0x20, jumppoint]);

            env.cpu.state.r8[r8.f] = flags;

            return env;
        }

        it('sets correct cycles if jumping', () => {
            const jump = 0x16;
            const { cpu } = setup(jump, 0x0);

            expect(cpu.step(1)).toBe(3);
        });

        it('sets correct cycles if NOT jumping', () => {
            const jump = 0x16;
            const { cpu } = setup(jump, 0x0);

            expect(cpu.step(1)).toBe(2);
        });

        it('jumps forward if Z flag is NOT set', () => {
            const jump = 0x16;
            const { cpu } = setup(jump, 0x0);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength + jump);
        });

        it('jumps backward if Z flag is NOT set', () => {
            const jump = ~0x16;
            const { cpu } = setup(jump, 0x0);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength + jump);
        });

        it('does NOT jump if Z flag is set', () => {
            const { cpu } = setup(0x08, flag.z);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength);
        });
    });

    describe('JR d8', () => {
        const instructionLength = 2;
        const baseAddress = 0x100;

        function setup(jumppoint: number): Environment {
            const env = newEnvironment([0x18, jumppoint]);

            env.cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | flag.c;

            return env;
        }

        it('sets correct cycles if jumping', () => {
            const jump = 0x16;
            const { cpu } = setup(jump);

            expect(cpu.step(1)).toBe(3);
        });

        it('jumps forward', () => {
            const jump = 0x16;
            const { cpu } = setup(jump);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength + jump);
        });

        it('jumps backward', () => {
            const jump = ~0x16;
            const { cpu } = setup(jump);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength + jump);
        });
    });

    describe('JR Z, d8', () => {
        const instructionLength = 2;
        const baseAddress = 0x100;

        function setup(jumppoint: number, flags: number): Environment {
            const env = newEnvironment([0x28, jumppoint]);

            env.cpu.state.r8[r8.f] = flags;

            return env;
        }

        it('sets correct cycles if jumping', () => {
            const jump = 0x16;
            const { cpu } = setup(jump, 0x0);

            expect(cpu.step(1)).toBe(3);
        });

        it('sets correct cycles if NOT jumping', () => {
            const jump = 0x16;
            const { cpu } = setup(jump, 0x0);

            expect(cpu.step(1)).toBe(2);
        });

        it('jumps forward if Z flag is set', () => {
            const jump = 0x16;
            const { cpu } = setup(jump, flag.z);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength + jump);
        });

        it('jumps backward if Z flag is set', () => {
            const jump = ~0x16;
            const { cpu } = setup(jump, flag.z);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength + jump);
        });

        it('does NOT jump if Z flag is NOT set', () => {
            const { cpu } = setup(0x08, 0x0);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength);
        });
    });

    describe('JR NC, d8', () => {
        const instructionLength = 2;
        const baseAddress = 0x100;

        function setup(jumppoint: number, flags: number): Environment {
            const env = newEnvironment([0x30, jumppoint]);

            env.cpu.state.r8[r8.f] = flags;

            return env;
        }

        it('sets correct cycles if jumping', () => {
            const jump = 0x16;
            const { cpu } = setup(jump, 0x0);

            expect(cpu.step(1)).toBe(3);
        });

        it('sets correct cycles if NOT jumping', () => {
            const jump = 0x16;
            const { cpu } = setup(jump, 0x0);

            expect(cpu.step(1)).toBe(2);
        });

        it('jumps forward if C flag is NOT set', () => {
            const jump = 0x16;
            const { cpu } = setup(jump, 0x0);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength + jump);
        });

        it('jumps backward if C flag is NOT set', () => {
            const jump = ~0x16;
            const { cpu } = setup(jump, 0x0);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength + jump);
        });

        it('does NOT jump if C flag is set', () => {
            const { cpu } = setup(0x08, flag.c);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength);
        });
    });

    describe('JR C, d8', () => {
        const instructionLength = 2;
        const baseAddress = 0x100;

        function setup(jumppoint: number, flags: number): Environment {
            const env = newEnvironment([0x38, jumppoint]);

            env.cpu.state.r8[r8.f] = flags;

            return env;
        }

        it('sets correct cycles if jumping', () => {
            const jump = 0x16;
            const { cpu } = setup(jump, 0x0);

            expect(cpu.step(1)).toBe(3);
        });

        it('sets correct cycles if NOT jumping', () => {
            const jump = 0x16;
            const { cpu } = setup(jump, 0x0);

            expect(cpu.step(1)).toBe(2);
        });

        it('jumps forward if C flag is set', () => {
            const jump = 0x16;
            const { cpu } = setup(jump, flag.c);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength + jump);
        });

        it('jumps backward if C flag is set', () => {
            const jump = ~0x16;
            const { cpu } = setup(jump, flag.c);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength + jump);
        });

        it('does NOT jump if C flag is NOT set', () => {
            const { cpu } = setup(0x08, 0x0);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength);
        });
    });
});
