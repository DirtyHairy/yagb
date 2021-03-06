import { Environment, newEnvironment } from '../../../support/_helper';

import { r16 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('POP AF', () => {
        function setup(r16af: number): Environment {
            const env = newEnvironment([0xf1]);

            env.bus.write16((env.cpu.state.r16[r16.sp] - 2) & 0xffff, r16af);
            env.cpu.state.r16[r16.sp] = (env.cpu.state.r16[r16.sp] - 2) & 0xffff;

            return env;
        }

        it('ignores low nibble of F on pop', () => {
            const value = 0x1532;
            const { cpu } = setup(value);

            cpu.step(1);

            expect(cpu.state.r16[r16.af]).toBe(value & 0xfff0);
        });
    });
});
