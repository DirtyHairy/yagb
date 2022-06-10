import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('RES 0, B', () => {
        function setup(value: number): Environment {
            const env = newEnvironment([0xcb, 0x80]);

            env.cpu.state.r8[r8.b] = value;

            env.cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | flag.c;

            return env;
        }

        it('calculates B & 0xfe', () => {
            const { cpu } = setup(0x55);

            cpu.step(1);

            expect(cpu.state.r8[r8.b]).toBe(0x54);
        });

        it('does not affect any flag', () => {
            const { cpu } = setup(0x55);

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(flag.z | flag.n | flag.h | flag.c);
        });
    });
});
