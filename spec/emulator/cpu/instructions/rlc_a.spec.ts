import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r16, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('RLC A', () => {
        function setup(value: number): Environment {
            const env = newEnvironment([0xcb, 0x07]);

            env.cpu.state.r8[r8.a] = value;

            env.cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | flag.c;

            return env;
        }

        it('Rotate A left', () => {
            const { cpu } = setup(0xa5);

            cpu.step(1);

            expect(cpu.state.r8[r8.a]).toBe(0x4b);
        });

        it('sets Z if zero', () => {
            const { cpu } = setup(0x00);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
        });

        it('does not set Z if not zero', () => {
            const { cpu } = setup(0xa5);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(0);
        });

        it('clears N, H', () => {
            const { cpu } = setup(0xa5);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.n & flag.h).toBe(0);
        });

        it('sets C if bit 7', () => {
            const { cpu } = setup(0xa5);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.c).toBe(flag.c);
        });

        it('does not set C if bit 7 is zero', () => {
            const { cpu } = setup(0x25);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.c).toBe(0);
        });
    });
});
