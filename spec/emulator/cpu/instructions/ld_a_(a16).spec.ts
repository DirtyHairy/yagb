import { Environment, newEnvironment } from '../../../support/_helper';

import { r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('LD A, (a16)', () => {
        function setup(address: number, value: number): Environment {
            const env = newEnvironment([0xfa, address & 0xff, address >>> 8]);

            env.bus.write(address, value);

            return env;
        }

        it('loads value into A', () => {
            const value = 0x32;
            const { cpu } = setup(0x2000, value);

            cpu.step(1);

            expect(cpu.state.r8[r8.a]).toBe(value);
        });
    });
});
