import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r16, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('SRL (HL)', () => {
        function setup(value: number, carry: boolean): Environment {
            const env = newEnvironment([0xcb, 0x3e]);

            const address = 0x2000;

            env.cpu.state.r16[r16.hl] = address;
            env.bus.write(address, value);

            env.cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | (carry ? flag.c : 0);

            return env;
        }

        it('Shift (HL) right', () => {
            const { bus, cpu } = setup(0xa5, true);

            cpu.step(1);

            expect(bus.read(cpu.state.r16[r16.hl])).toBe(0x52);
        });

        it('sets Z if zero', () => {
            const { cpu } = setup(0x01, true);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
        });

        it('does not set Z if not zero', () => {
            const { cpu } = setup(0xa5, true);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(0);
        });

        it('clears N, H', () => {
            const { cpu } = setup(0xa5, true);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.n & flag.h).toBe(0);
        });

        it('sets C if bit 0', () => {
            const { cpu } = setup(0xa5, true);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.c).toBe(flag.c);
        });

        it('does not set C if bit 0 is zero', () => {
            const { cpu } = setup(0xaa, true);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.c).toBe(0);
        });
    });
});
