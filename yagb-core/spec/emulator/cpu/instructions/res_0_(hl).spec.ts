import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r16, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('RES 0, (HL)', () => {
        function setup(value: number): Environment {
            const env = newEnvironment([0xcb, 0x86]);

            const address = 0x2000;

            env.cpu.state.r16[r16.hl] = address;
            env.bus.write(address, value);

            env.cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | flag.c;

            return env;
        }

        it('calculates (HL)) & 0fe', () => {
            const { bus, cpu } = setup(0x55);

            cpu.step(1);

            expect(bus.read(cpu.state.r16[r16.hl])).toBe(0x54);
        });

        it('does not affect any flag', () => {
            const { cpu } = setup(0x55);

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(flag.z | flag.n | flag.h | flag.c);
        });
    });
});
