import { Environment, newEnvironment } from '../../../support/_helper';

import { r16 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('POP BC', () => {
        function setup(r16bc: number): Environment {
            const env = newEnvironment([0xc1]);

            env.cpu.state.r16[r16.sp] = (env.cpu.state.r16[r16.sp] - 1) & 0xffff;
            env.bus.write(env.cpu.state.r16[r16.sp], r16bc >> 8);
            env.cpu.state.r16[r16.sp] = (env.cpu.state.r16[r16.sp] - 1) & 0xffff;
            env.bus.write(env.cpu.state.r16[r16.sp], r16bc & 0xff);

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
