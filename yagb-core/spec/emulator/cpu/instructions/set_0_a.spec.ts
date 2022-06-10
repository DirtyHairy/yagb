import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('SET 0, A', () => {
        function setup(value: number): Environment {
            const env = newEnvironment([0xcb, 0xc7]);

            env.cpu.state.r8[r8.a] = value;

            env.cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | flag.c;

            return env;
        }

        it('calculates A & 0x1', () => {
            const { cpu } = setup(0xaa);

            cpu.step(1);

            expect(cpu.state.r8[r8.a]).toBe(0xab);
        });

        it('does not affect any flag', () => {
            const { cpu } = setup(0x55);

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(flag.z | flag.n | flag.h | flag.c);
        });
    });
});
