import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('DAA', () => {
        function setup(value: number): Environment {
            const env = newEnvironment([0x27, 0x00]);

            env.cpu.state.r8[r8.a] = value;

            env.cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | flag.c;

            return env;
        }

        it('calculates BCD of A', () => {
            const { cpu } = setup(0x9f);

            cpu.step(1);

            expect(cpu.state.r8[r8.a]).toBe(0x05);
        });

        it('sets Z if zero', () => {
            const { cpu } = setup(0x9a);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
        });

        it('does not set Z if not zero', () => {
            const { cpu } = setup(0x9f);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(0);
        });

        it('clears H', () => {
            const { cpu } = setup(0x9f);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.h).toBe(0);
        });

        it('sets C if upper nibble > 0x09', () => {
            const { cpu } = setup(0x9f);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.c).toBe(flag.c);
        });

        it('does not set C if upper nibble <= 0x09', () => {
            const { cpu } = setup(0x8f);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.c).toBe(0);
        });
    });
});
