import { Cpu, flag, r8 } from '../../../../src/emulator/cpu';

import { newEnvironment } from '../../../support/_helper';

describe('The glorious CPU', () => {
    describe('AND D', () => {
        let cpu: Cpu;
        beforeEach(() => {
            cpu = newEnvironment([0xa2]).cpu;
        });

        it('calculates A & D', () => {
            cpu.state.r8[r8.a] = 0x15;
            cpu.state.r8[r8.d] = 0x32;

            cpu.step(1);

            expect(cpu.state.r8[r8.a]).toBe(0x10);
        });

        it('sets Z if zero', () => {
            cpu.state.r8[r8.a] = 0x00;
            cpu.state.r8[r8.d] = 0x00;

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(flag.z);
        });

        it('does not set Z if zero', () => {
            cpu.state.r8[r8.a] = 0x15;
            cpu.state.r8[r8.d] = 0x32;

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.z).toBe(0);
        });

        it('clears N, C', () => {
            cpu.state.r8[r8.a] = 0x15;
            cpu.state.r8[r8.d] = 0x32;
            cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | flag.c;

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & (flag.n | flag.c)).toBe(0);
        });

        it('sets H', () => {
            cpu.state.r8[r8.a] = 0x15;
            cpu.state.r8[r8.d] = 0x32;
            cpu.state.r8[r8.f] = flag.z | flag.n | flag.h | flag.c;

            cpu.step(1);

            expect(cpu.state.r8[r8.f] & flag.h).toBe(flag.h);
        });
    });
});
