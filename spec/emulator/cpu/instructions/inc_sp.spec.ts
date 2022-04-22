import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r16, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('INC SP', () => {
        function setup(value: number, flags = 0): Environment {
            const env = newEnvironment([0x33]);

            env.cpu.state.r16[r16.sp] = value;

            env.cpu.state.r8[r8.f] = flags;

            return env;
        }

        it('increments', () => {
            const { cpu } = setup(0x42);

            cpu.step(1);

            expect(cpu.state.r16[r16.sp]).toBe(0x43);
        });

        it('does not affect any flag', () => {
            const { cpu } = setup(0x42, flag.z | flag.c | flag.h);

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(flag.z | flag.c | flag.h);
        });
    });
});
