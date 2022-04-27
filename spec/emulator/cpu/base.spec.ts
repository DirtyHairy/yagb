import { Environment, newEnvironment } from '../../support/_helper';

import { irq } from '../../../src/emulator/interrupt';
import { r16 } from '../../../src/emulator/cpu';

describe('The glorious CPU', () => {
    describe('interrupt dispatch', () => {
        function setup(enableInterrupts: boolean, iflag: number, iena = 0x1f): Environment {
            const environment = newEnvironment([0x00]);

            environment.bus.write(0xff0f, iflag);
            environment.bus.write(0xffff, iena);

            environment.cpu.state.interruptsEnabled = enableInterrupts;
            environment.cpu.state.r16[r16.sp] = 0x1000;

            return environment;
        }

        it('transfers control to 0x40 on vblank', () => {
            const { cpu } = setup(true, irq.vblank);

            cpu.step(1);

            expect(cpu.state.p).toBe(0x40);
        });

        it('transfers control to 0x48 on stat', () => {
            const { cpu } = setup(true, irq.stat);

            cpu.step(1);

            expect(cpu.state.p).toBe(0x48);
        });

        it('transfers control to 0x50 on timer', () => {
            const { cpu } = setup(true, irq.timer);

            cpu.step(1);

            expect(cpu.state.p).toBe(0x50);
        });

        it('transfers control to 0x58 on vblank', () => {
            const { cpu } = setup(true, irq.serial);

            cpu.step(1);

            expect(cpu.state.p).toBe(0x58);
        });

        it('transfers control to 0x60 on joypad', () => {
            const { cpu } = setup(true, irq.joypad);

            cpu.step(1);

            expect(cpu.state.p).toBe(0x60);
        });

        it('pushes P to the stack', () => {
            const { cpu, bus } = setup(true, irq.vblank);
            const sp = cpu.state.r16[r16.sp];

            cpu.step(1);

            expect(cpu.state.r16[r16.sp]).toBe(sp - 2);
            expect(bus.read16(cpu.state.r16[r16.sp])).toBe(0x0100);
        });

        it('disables interrupts', () => {
            const { cpu } = setup(true, irq.vblank);

            cpu.step(1);

            expect(cpu.state.interruptsEnabled).toBe(false);
        });

        it('clears the interrupt flag', () => {
            const { cpu, bus } = setup(true, irq.vblank | irq.stat);

            cpu.step(1);

            expect(bus.read(0xff0f)).toBe(0xe0 | irq.stat);
        });

        it('does not execute if interrupts are disabled', () => {
            const { cpu } = setup(false, irq.vblank);

            cpu.step(1);

            expect(cpu.state.p).toBe(0x101);
        });

        it('does not execute if interrupts are masked', () => {
            const { cpu } = setup(false, irq.vblank, 0);

            cpu.step(1);

            expect(cpu.state.p).toBe(0x101);
        });

        it('ignores masked interrupts', () => {
            const { cpu, bus } = setup(true, irq.timer | irq.vblank, 0x1f ^ irq.vblank);

            cpu.step(1);

            expect(cpu.state.p).toBe(0x50);
            expect(bus.read(0xff0f)).toBe(0xe0 | irq.vblank);
        });
    });
});
