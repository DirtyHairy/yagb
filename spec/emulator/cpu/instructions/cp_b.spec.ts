import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('CP B', () => {
        function setup(lhs: number, rhs: number): Environment {
            const env = newEnvironment([0xb8]);

            env.cpu.state.r8[r8.a] = lhs;
            env.cpu.state.r8[r8.b] = rhs;

            return env;
        }

        describe('handles Z correctly', () => {
            it('0x42 vs 0x43', () => {
                const { cpu } = setup(0x42, 0x43);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.z).toBe(0);
            });

            it('0x42 vs 0x42', () => {
                const { cpu } = setup(0x42, 0x42);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
            });
        });

        it('it sets N', () => {
            const { cpu } = setup(0x42, 0x42);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.n).toBe(flag.n);
        });

        describe('handles C correctly', () => {
            it('0x42 vs 0x43', () => {
                const { cpu } = setup(0x42, 0x43);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.c).toBe(flag.c);
            });

            it('0x42 vs 0x42', () => {
                const { cpu } = setup(0x42, 0x42);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.c).toBe(0);
            });

            it('0x42 vs 0x41', () => {
                const { cpu } = setup(0x42, 0x41);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.c).toBe(0);
            });
        });

        describe('handles H correctly', () => {
            it('0x02 vs 0x03', () => {
                const { cpu } = setup(0x02, 0x03);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.h).toBe(flag.h);
            });

            it('0xf2 vs 0xe3', () => {
                const { cpu } = setup(0xf2, 0xe3);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.h).toBe(flag.h);
            });

            it('0x42 vs 0x42', () => {
                const { cpu } = setup(0x42, 0x42);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.h).toBe(0);
            });

            it('0x03 vs 0x02', () => {
                const { cpu } = setup(0x03, 0x02);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.h).toBe(0);
            });

            it('0x13 vs 0x22', () => {
                const { cpu } = setup(0x13, 0x22);

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.h).toBe(0);
            });
        });
    });
});
