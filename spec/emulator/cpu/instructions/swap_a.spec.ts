import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r16, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('SWAP A', () => {
        function setup(value: number): Environment {
            const env = newEnvironment([0xcb, 0x37]);

            env.cpu.state.r8[r8.a] = value;

            env.cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | flag.c;

            return env;
        }

        it('Swap upper & lower nibbles of A', () => {
            const { cpu } = setup(0xf0);

            cpu.step(1);

            expect(cpu.state.r8[r8.a]).toBe(0x0f);
        });

        it('sets Z if zero', () => {
            const { cpu } = setup(0x00);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
        });

        it('does not set Z if not zero', () => {
            const { cpu } = setup(0xf0);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(0);
        });

        it('clears N, H, C', () => {
            const { cpu } = setup(0xf0);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.n & flag.h & flag.c).toBe(0);
        });
    });
});
