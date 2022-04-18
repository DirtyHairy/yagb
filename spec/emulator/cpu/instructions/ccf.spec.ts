import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('CCF', () => {
        function setup(carry = true): Environment {
            const env = newEnvironment([0x3f, 0x00]);

            env.cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | (carry ? flag.c : 0x00);

            return env;
        }

        it('sets C if it not set', () => {
            const { cpu } = setup(false);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.c).toBe(flag.c);
        });

        it('unsets C if it set', () => {
            const { cpu } = setup(true);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.c).toBe(0);
        });

        it('clears N', () => {
            const { cpu } = setup(false);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.n).toBe(0);
        });

        it('clears H', () => {
            const { cpu } = setup(false);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.h).toBe(0);
        });

        it('does not affect Z', () => {
            const { cpu } = setup(true);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
        });
    });
});
