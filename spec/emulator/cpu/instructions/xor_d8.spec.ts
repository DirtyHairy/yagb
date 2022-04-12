import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('XOR d8', () => {
        function setup(lhs: number, rhs: number): Environment {
            const env = newEnvironment([0xee, rhs]);

            env.cpu.state.r8[r8.a] = lhs;

            env.cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | flag.c;

            return env;
        }

        it('calculates A | d8', () => {
            const { cpu } = setup(0x15, 0x32);

            cpu.step(1);

            expect(cpu.state.r8[r8.a]).toBe(0x27);
        });

        it('sets Z if zero', () => {
            const { cpu } = setup(0x00, 0x00);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
        });

        it('does not set Z if not zero', () => {
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
});
