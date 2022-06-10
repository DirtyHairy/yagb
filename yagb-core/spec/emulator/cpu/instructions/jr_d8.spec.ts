import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('JR d8', () => {
        const instructionLength = 2;
        const baseAddress = 0x100;

        function setup(jumppoint: number): Environment {
            const env = newEnvironment([0x18, jumppoint]);

            env.cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | flag.c;

            return env;
        }

        it('sets correct cycles', () => {
            const jump = 0x16;
            const { cpu } = setup(jump);

            expect(cpu.step(1)).toBe(3);
        });

        it('jumps forward', () => {
            const jump = 0x16;
            const { cpu } = setup(jump);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength + jump);
        });

        it('jumps backward', () => {
            const jump = ~0x16;
            const { cpu } = setup(jump);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength + jump);
        });
    });
});
