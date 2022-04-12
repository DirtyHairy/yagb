import { Environment, newEnvironment } from '../../../support/_helper';
import { Cpu, flag, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('JR Z, d8', () => {
        const instructionLength = 2;
        const baseAddress = 0x100;

        function setup(jumppoint: number, flags: number): Environment {
            const env = newEnvironment([0x28, jumppoint]);

            env.cpu.state.r8[r8.f] = flags;

            return env;
        }

        it('sets correct cycles if jumping', () => {
            const jump = 0x16;
            const { cpu } = setup(jump, flag.z);

            expect(cpu.step(1)).toBe(3);
        });

        it('sets correct cycles if NOT jumping', () => {
            const jump = 0x16;
            const { cpu } = setup(jump, 0x0);

            expect(cpu.step(1)).toBe(2);
        });

        it('jumps forward if Z flag is set', () => {
            const jump = 0x16;
            const { cpu } = setup(jump, flag.z);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength + jump);
        });

        it('jumps backward if Z flag is set', () => {
            const jump = ~0x16;
            const { cpu } = setup(jump, flag.z);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength + jump);
        });

        it('does NOT jump if Z flag is NOT set', () => {
            const { cpu } = setup(0x08, 0x0);

            cpu.step(1);

            expect(cpu.state.p).toBe(baseAddress + instructionLength);
        });
    });
});
