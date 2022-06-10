import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('CP A', () => {
        function setup(lhs: number): Environment {
            const env = newEnvironment([0xbf]);

            env.cpu.state.r8[r8.a] = lhs;

            return env;
        }

        describe('handles Z correctly', () => {
            const { cpu } = setup(0x42);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
        });

        it('it sets N', () => {
            const { cpu } = setup(0x42);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.n).toBe(flag.n);
        });

        describe('handles C correctly', () => {
            const { cpu } = setup(0x42);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.c).toBe(0);
        });

        describe('handles H correctly', () => {
            const { cpu } = setup(0x42);

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.h).toBe(0);
        });
    });
});
