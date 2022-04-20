import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('DAA', () => {
        function setup(value: number, substraction = false, halfcarry = true, carry = true): Environment {
            const env = newEnvironment([0x27, 0x00]);

            env.cpu.state.r8[r8.a] = value;

            // prettier-ignore
            env.cpu.state.r8[r8.f] =
                (value === 0x00 ? flag.z: 0x00) |
                (substraction ? flag.n : 0x00) |
                (halfcarry ? flag.h : 0x00) |
                (carry ? flag.c : 0x00);

            return env;
        }

        describe('calculates BCD of A', () => {
            it('addition', () => {
                const { cpu } = setup(0x19 + 0x28, false, true, false);

                cpu.step(1);

                expect(cpu.state.r8[r8.a]).toBe(0x47);
            });
            it('subtraction', () => {
                const { cpu } = setup(0x47 - 0x28, true, true, false);

                cpu.step(1);

                expect(cpu.state.r8[r8.a]).toBe(0x19);
            });
        });

        describe('sets Z if zero', () => {
            it('addition', () => {
                const { cpu } = setup(-0x19 + 0x19, false, false, false);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
            });
            it('subtraction', () => {
                const { cpu } = setup(0x47 - 0x47, true, false, false);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
            });
        });

        describe('does not set Z if not zero', () => {
            it('addition', () => {
                const { cpu } = setup(0x19 + 0x28, false, true, false);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.z).toBe(0);
            });
            it('subtraction', () => {
                const { cpu } = setup(0x47 - 0x28, true, true, false);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.z).toBe(0);
            });
        });

        describe('clears H', () => {
            it('addition', () => {
                const { cpu } = setup(0x19 + 0x28, false, true, false);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.h).toBe(0);
            });
            it('subtraction', () => {
                const { cpu } = setup(0x47 - 0x28, true, true, false);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.h).toBe(0);
            });
        });

        describe('sets C if upper nibble > 0x09', () => {
            it('addition', () => {
                const { cpu } = setup(0x59 + 0x68, false);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.c).toBe(flag.c);
            });
            it('subtraction', () => {
                const { cpu } = setup(0x99 - 0x01, true);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.c).toBe(flag.c);
            });
        });

        describe('does not set C if upper nibble <= 0x09', () => {
            it('addition', () => {
                const { cpu } = setup(0x19 + 0x28, false, true, false);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.c).toBe(0);
            });
            it('subtraction', () => {
                const { cpu } = setup(0x47 - 0x28, true, true, false);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.c).toBe(0);
            });
        });
    });
});
