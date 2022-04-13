import { newEnvironment } from '../../../support/_helper';
import { Cpu, flag, r8 } from '../../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('INC B', () => {
        let cpu: Cpu;
        beforeEach(() => {
            cpu = newEnvironment([0x04]).cpu;
        });

        it('increments', () => {
            cpu.state.r8[r8.b] = 0x42;

            cpu.step(1);

            expect(cpu.state.r8[r8.b]).toBe(0x43);
        });

        it('handles overflow', () => {
            cpu.state.r8[r8.b] = 0xff;

            cpu.step(1);

            expect(cpu.state.r8[r8.b]).toBe(0x00);
        });

        it('sets z correctly', () => {
            cpu.state.r8[r8.b] = 0xff;

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(flag.z | flag.h);
        });

        it('clears n', () => {
            cpu.state.r8[r8.b] = 0x02;

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(0);
        });

        it('sets half-carry correctly, case 0x0f', () => {
            cpu.state.r8[r8.b] = 0x0f;

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(flag.h);
        });

        it('sets half-carry correctly, case 0xff', () => {
            cpu.state.r8[r8.b] = 0xff;

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(flag.h | flag.z);
        });

        it('preserves carry', () => {
            cpu.state.r8[r8.b] = 0x02;
            cpu.state.r8[r8.f] = flag.c;

            cpu.step(1);

            expect(cpu.state.r8[r8.f]).toBe(flag.c);
        });
    });
});
