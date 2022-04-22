import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r16, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('ADD HL, BC', () => {
        function setup(lhs: number, rhs: number, flags = 0): Environment {
            const env = newEnvironment([0x09, 0x00]);

            env.cpu.state.r16[r16.bc] = rhs;
            env.cpu.state.r16[r16.hl] = lhs;

            env.cpu.state.r8[r8.f] = flags;

            return env;
        }

        it('add value of BC to HL', () => {
            const { cpu } = setup(0x42, 0x10);

            cpu.step(1);

            expect(cpu.state.r16[r16.hl]).toBe(0x52);
        });

        it('does not affect Z', () => {
            const { cpu } = setup(0x42, 0x10, flag.z);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
        });

        it('clears N', () => {
            const { cpu } = setup(0x42, 0x10, flag.n);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.n).toBe(0);
        });

        it('sets H correctly', () => {
            const { cpu } = setup(0xfff, 0x01);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.h).toBe(flag.h);
        });

        it('sets C correctly', () => {
            const { cpu } = setup(0xffff, 0x01);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.c).toBe(flag.c);
        });
    });
});
