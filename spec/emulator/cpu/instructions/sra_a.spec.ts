import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('SRA A', () => {
        function setup(value: number, carry: boolean): Environment {
            const env = newEnvironment([0xcb, 0x2f]);

            env.cpu.state.r8[r8.a] = value;

            env.cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | (carry ? flag.c : 0);

            return env;
        }

        it('Shift A right', () => {
            const { cpu } = setup(0xa5, true);

            cpu.step(1);

            expect(cpu.state.r8[r8.a]).toBe(0xd2);
        });

        describe('unaffected Bit 7', () => {
            it('Bit 7 set', () => {
                const { cpu } = setup(0xa5, true);

                cpu.step(1);

                expect(cpu.state.r8[r8.a] & 0x80).toBe(0x80);
            });
            it('Bit 7 not set', () => {
                const { cpu } = setup(0x25, true);

                cpu.step(1);

                expect(cpu.state.r8[r8.a] & 0x80).toBe(0x0);
            });
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
