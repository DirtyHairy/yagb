import { Environment, newEnvironment } from '../../../support/_helper';
import { Cpu, flag, r16, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('INC (HL)', () => {
        function setup(value: number): Environment {
            const env = newEnvironment([0x35]);

            const address = 0x2000;

            env.cpu.state.r16[r16.hl] = address;
            env.bus.write(address, value);

            env.cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | flag.c;

            return env;
        }

        it('calculates INC (HL)', () => {
            const value = 0x32;
            const { bus, cpu } = setup(value);

            cpu.step(1);

            expect(bus.read16(cpu.state.r16[r16.hl])).toBe(value - 1);
        });

        it('sets Z if zero', () => {
            const { cpu } = setup(0x01);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
        });

        it('does not set Z if not zero', () => {
            const { cpu } = setup(0x32);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(0);
        });

        it('sets N', () => {
            const { cpu } = setup(0x32);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & (flag.n)).toBe(flag.n);
        });

        it('sets H if half carry', () => {
            const { cpu } = setup(0x10);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.h).toBe(flag.h);
        });

        it('does not set H if not half carry', () => {
            const { cpu } = setup(0x08);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.h).toBe(0);
        });

        it('does not affect C', () => {
            const { cpu } = setup(0xf0);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.c).toBe(flag.c);
        });
    });
});
