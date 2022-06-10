import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r16, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('ADD SP, s8', () => {
        function setup(address: number, value: number, flags = 0): Environment {
            const env = newEnvironment([0xe8, value]);

            env.cpu.state.r16[r16.sp] = address;

            env.cpu.state.r8[r8.f] = flags;

            return env;
        }

        it('calculates SP + s8 (s8 > 0)', () => {
            const { cpu } = setup(0x2000, 0x10);

            cpu.step(1);

            expect(cpu.state.r16[r16.sp]).toBe(0x2010);
        });

        it('calculates SP + s8 (s8 < 0)', () => {
            const { cpu } = setup(0x2000, 0xf0);

            cpu.step(1);

            expect(cpu.state.r16[r16.sp]).toBe(0x1ff0);
        });

        it('clears Z', () => {
            const { cpu } = setup(0x2000, 0x10, flag.z);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(0);
        });

        it('clears N', () => {
            const { cpu } = setup(0x2000, 0x10, flag.n);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.n).toBe(0);
        });

        it('sets H correctly', () => {
            const { cpu } = setup(0x20ff, 0x01);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.h).toBe(flag.h);
        });

        it('sets C correctly', () => {
            const { cpu } = setup(0x2fff, 0x01);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.c).toBe(flag.c);
        });
    });
});
