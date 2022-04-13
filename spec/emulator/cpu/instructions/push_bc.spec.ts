import { Environment, newEnvironment } from '../../../support/_helper';
import { r16, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('PUSH BC', () => {
        function setup(r16bc: number): Environment {
            const env = newEnvironment([0xc5]);

            env.cpu.state.r8[r8.b] = (r16bc >> 8) & 0xff;
            env.cpu.state.r8[r8.c] = r16bc & 0xff;

            return env;
        }

        it('decreases stack pointer correctly', () => {
            const { cpu } = setup(0x1532);

            const sp = cpu.state.r16[r16.sp];

            cpu.step(1);

            expect(cpu.state.r16[r16.sp]).toBe(sp - 2);
        });

        it('pushes the value to the stack', () => {
            const value = 0x1532;
            const { bus, cpu } = setup(value);

            cpu.step(1);

            expect(bus.read16(cpu.state.r16[r16.sp])).toBe(value);
        });
    });
});
