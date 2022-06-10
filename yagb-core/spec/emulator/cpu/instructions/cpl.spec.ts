import { Cpu, r8 } from '../../../../src/emulator/cpu';

import { newEnvironment } from '../../../support/_helper';

describe('The glorious CPU', () => {
    describe('CPL', () => {
        let cpu: Cpu;
        beforeEach(() => {
            cpu = newEnvironment([0x2f]).cpu;
        });

        it('flips bits in A correctly', () => {
            cpu.state.r8[r8.a] = 0x20;

            cpu.step(1);

            expect(cpu.state.r8[r8.a]).toBe(0xdf);
        });
    });
});
