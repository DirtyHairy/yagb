import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r16, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('RET', () => {
        const address = 0x1000;

        function setup(address: number): Environment {
            const env = newEnvironment([0xc9]);

            env.cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | flag.c;

            env.bus.write16((env.cpu.state.r16[r16.sp] - 1) & 0xffff, address);
            env.cpu.state.r16[r16.sp] = (env.cpu.state.r16[r16.sp] - 2) & 0xffff;

            return env;
        }

        it('sets correct cycles', () => {
            const { cpu } = setup(address);

            expect(cpu.step(1)).toBe(4);
        });

        it('increases stack pointer correctly', () => {
            const { cpu } = setup(address);

            const sp = cpu.state.r16[r16.sp];

            cpu.step(1);

            expect(cpu.state.r16[r16.sp]).toBe(sp + 2);
        });

        it('returns to address in stack', () => {
            const { cpu } = setup(address);

            cpu.step(1);

            expect(cpu.state.p).toBe(address);
        });
    });
});
