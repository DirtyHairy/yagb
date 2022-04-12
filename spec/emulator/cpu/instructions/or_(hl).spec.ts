import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r16, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
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
