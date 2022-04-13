import { Interrupt, irq } from '../../src/emulator/interrupt';

import { Bus } from '../../src/emulator/bus';
import { System } from '../../src/emulator/system';

describe('interrupts', () => {
    function setup(iflag: number, imask: number): Interrupt {
        const system = new System((msg) => console.log(msg));
        const bus = new Bus(system);
        const interrupt = new Interrupt();

        interrupt.install(bus);
        interrupt.reset();

        bus.write(0xff0f, iflag);
        bus.write(0xffff, imask);

        return interrupt;
    }

    describe('#getNext()', () => {
        it('returns 0 if there are no pending interrupts', () => {
            const interrupt = setup(0, 0x1f);

            expect(interrupt.getNext()).toBe(0);
        });

        it('returns 0 if interrupts are masked', () => {
            const interrupt = setup(0x1f, 0);

            expect(interrupt.getNext()).toBe(0);
        });

        it('vblank has priority 0', () => {
            const interrupt = setup(irq.vblank | irq.stat | irq.timer | irq.serial | irq.joypad, 0x1f);

            expect(interrupt.getNext()).toBe(irq.vblank);
        });

        it('stat has priority 0', () => {
            const interrupt = setup(irq.stat | irq.timer | irq.serial | irq.joypad, 0x1f);

            expect(interrupt.getNext()).toBe(irq.stat);
        });

        it('timer has priority 0', () => {
            const interrupt = setup(irq.timer | irq.serial | irq.joypad, 0x1f);

            expect(interrupt.getNext()).toBe(irq.timer);
        });

        it('serial has priority 0', () => {
            const interrupt = setup(irq.serial | irq.joypad, 0x1f);

            expect(interrupt.getNext()).toBe(irq.serial);
        });

        it('joypad has priority 0', () => {
            const interrupt = setup(irq.joypad, 0x1f);

            expect(interrupt.getNext()).toBe(irq.joypad);
        });

        it('ignores masked interrupts', () => {
            const interrupt = setup(irq.vblank | irq.stat | irq.timer | irq.serial | irq.joypad, 0x1f ^ irq.vblank);

            expect(interrupt.getNext()).toBe(irq.stat);
        });
    });
});
