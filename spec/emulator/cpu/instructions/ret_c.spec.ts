import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r16, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('RET C', () => {
        const instructionLength = 1;
        const baseAddress = 0x100;
        const address = 0x1000;

        function setup(address: number, flags: number): Environment {
            const env = newEnvironment([0xd8]);

            env.cpu.state.r8[r8.f] = flags;

            env.cpu.state.r16[r16.sp] = (env.cpu.state.r16[r16.sp] - 1) & 0xffff;
            env.bus.write(env.cpu.state.r16[r16.sp], address >>> 8);
            env.cpu.state.r16[r16.sp] = (env.cpu.state.r16[r16.sp] - 1) & 0xffff;
            env.bus.write(env.cpu.state.r16[r16.sp], address & 0xff);

            return env;
        }

        it('sets correct cycles if returning to address in stack', () => {
            const { cpu } = setup(address, flag.c);

            expect(cpu.step(1)).toBe(5);
        });

        it('sets correct cycles if NOT returning to address in stack', () => {
            const { cpu } = setup(address, 0x0);

            expect(cpu.step(1)).toBe(2);
        });

        it('increases stack pointer correctly', () => {
            const { cpu } = setup(address, flag.c);

            const sp = cpu.state.r16[r16.sp];

            cpu.step(1);

            expect(cpu.state.r16[r16.sp]).toBe(sp + 2);
        });

        it('returns to address in stack if C flag is set', () => {
            const { cpu } = setup(address, flag.c);

            cpu.step(1);

            expect(cpu.state.p).toBe(address);
        });

        it('does NOT return to address in stack if C flag is NOT set', () => {
            const { cpu } = setup(address, 0x0);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength);
        });
    });
});
