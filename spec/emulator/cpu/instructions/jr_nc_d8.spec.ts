import { Environment, newEnvironment } from '../../../support/_helper';
import { Cpu, flag, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('JR NC, d8', () => {
        const instructionLength = 2;
        const baseAddress = 0x100;

        function setup(jumppoint: number, flags: number): Environment {
            const env = newEnvironment([0x30, jumppoint]);

            env.cpu.state.r8[r8.f] = flags;

            return env;
        }

        it('sets correct cycles if jumping', () => {
            const jump = 0x16;
            const { cpu } = setup(jump, 0x0);

            expect(cpu.step(1)).toBe(3);
        });

        it('sets correct cycles if NOT jumping', () => {
            const jump = 0x16;
            const { cpu } = setup(jump, flag.c);

            expect(cpu.step(1)).toBe(2);
        });

        it('jumps forward if C flag is NOT set', () => {
            const jump = 0x16;
            const { cpu } = setup(jump, 0x0);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength + jump);
        });

        it('jumps backward if C flag is NOT set', () => {
            const jump = ~0x16;
            const { cpu } = setup(jump, 0x0);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength + jump);
        });

        it('does NOT jump if C flag is set', () => {
            const { cpu } = setup(0x08, flag.c);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength);
        });
    });
});
