import { Environment, newEnvironment } from '../../../support/_helper';

import { r16 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('POP BC', () => {
        function setup(r16bc: number): Environment {
            const env = newEnvironment([0xc1]);

            env.bus.write16((env.cpu.state.r16[r16.sp] - 2) & 0xffff, r16bc);
            env.cpu.state.r16[r16.sp] = (env.cpu.state.r16[r16.sp] - 2) & 0xffff;

            return env;
        }

        it('increases stack pointer correctly', () => {
            const { cpu } = setup(0x1532);

            const sp = cpu.state.r16[r16.sp];

            cpu.step(1);

            expect(cpu.state.r16[r16.sp]).toBe(sp + 2);
        });

        it('pops the value from the stack', () => {
            const value = 0x1532;
            const { cpu } = setup(value);

            cpu.step(1);

            expect(cpu.state.r16[r16.bc]).toBe(value);
        });
    });
});
