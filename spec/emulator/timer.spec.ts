import { Interrupt, irq } from '../../src/emulator/interrupt';

import { Bus } from '../../src/emulator/bus';
import { System } from '../../src/emulator/system';
import { Timer } from '../../src/emulator/timer';

describe('Timer', () => {
    function setup(): { bus: Bus; timer: Timer; raiseSpy: jest.SpyInstance<void, [irq]> } {
        const system = new System((msg) => console.log(msg));
        const bus = new Bus(system);
        const interrupt = new Interrupt();
        const timer = new Timer(interrupt);

        const raiseSpy = jest.spyOn(interrupt, 'raise');

        interrupt.install(bus);
        timer.install(bus);

        return { bus, timer, raiseSpy };
    }

    describe('div', () => {
        it('counts at 16 kHz', () => {
            const { bus, timer } = setup();

            timer.cycle(63);
            expect(bus.read(0xff04)).toBe(0);

            timer.cycle(1);
            expect(bus.read(0xff04)).toBe(1);
        });

        it('handles increments of more than 64 clocks properly', () => {
            const { bus, timer } = setup();

            timer.cycle(3 * 64 - 1);
            expect(bus.read(0xff04)).toBe(2);

            timer.cycle(1);
            expect(bus.read(0xff04)).toBe(3);
        });

        it('resets to zero if written', () => {
            const { bus, timer } = setup();

            timer.cycle(10 * 64);
            bus.write(0xff04, 0x20);

            expect(bus.read(0xff04)).toBe(0);
        });
    });

    describe('tima', () => {
        it('counts according to tac', () => {
            const { bus, timer } = setup();
            bus.write(0xff07, 0x05);

            timer.cycle(16);

            expect(bus.read(0xff05)).toBe(1);
        });

        it('does not count if timers are disabled', () => {
            const { bus, timer } = setup();
            bus.write(0xff07, 0x01);

            timer.cycle(16);

            expect(bus.read(0xff05)).toBe(0);
        });

        it('handles increments of multiple clocks correclty', () => {
            const { bus, timer } = setup();
            bus.write(0xff07, 0x05);

            timer.cycle(4 * 16 - 1);
            expect(bus.read(0xff05)).toBe(3);

            timer.cycle(1);
            expect(bus.read(0xff05)).toBe(4);
        });

        it('wraps to tma', () => {
            const { bus, timer } = setup();
            bus.write(0xff07, 0x05);
            bus.write(0xff06, 0xe0);

            timer.cycle(256 * 16 + 1);

            expect(bus.read(0xff05)).toBe(0xe0);
        });

        it('handles increments with multiple wraps correctly', () => {
            const { bus, timer } = setup();
            bus.write(0xff07, 0x05);
            bus.write(0xff06, 0xe0);

            timer.cycle((256 + 0x40 + 2) * 16);

            expect(bus.read(0xff05)).toBe(0xe2);

            timer.cycle(19);

            expect(bus.read(0xff05)).toBe(0xe3);
        });

        it('dispatches an interrupt on wrap', () => {
            const { bus, timer, raiseSpy } = setup();
            bus.write(0xff07, 0x05);
            bus.write(0xff06, 0xe0);

            timer.cycle(256 * 16 + 1);

            expect(raiseSpy).toHaveBeenCalledTimes(1);
            expect(raiseSpy).toBeCalledWith(irq.timer);
        });

        it('dispatches the interrupt only once', () => {
            const { bus, timer, raiseSpy } = setup();
            bus.write(0xff07, 0x05);
            bus.write(0xff06, 0xe0);

            timer.cycle((256 + 0x40) * 16 + 1);

            expect(raiseSpy).toHaveBeenCalledTimes(1);
            expect(raiseSpy).toBeCalledWith(irq.timer);
        });

        it('takes one cycle to dispatch the interrupt', () => {
            const { bus, timer, raiseSpy } = setup();
            bus.write(0xff07, 0x05);
            bus.write(0xff06, 0xe0);

            timer.cycle(256 * 16);

            expect(raiseSpy).not.toHaveBeenCalled();

            timer.cycle(1);

            expect(raiseSpy).toHaveBeenCalledTimes(1);
            expect(raiseSpy).toBeCalledWith(irq.timer);
        });

        it('does not take one cycle to dispatch the interrupt if the timer wrapped multiple times', () => {
            const { bus, timer, raiseSpy } = setup();
            bus.write(0xff07, 0x05);
            bus.write(0xff06, 0xe0);

            timer.cycle((256 + 0x20) * 16);

            expect(raiseSpy).toHaveBeenCalledTimes(1);
            expect(raiseSpy).toBeCalledWith(irq.timer);
        });

        it('reads 0 for one cycle after wrapping', () => {
            const { bus, timer } = setup();
            bus.write(0xff07, 0x05);
            bus.write(0xff06, 0xe0);

            timer.cycle(256 * 16);

            expect(bus.read(0xff05)).toBe(0);

            timer.cycle(1);

            expect(bus.read(0xff05)).toBe(0xe0);
        });

        it('reads 0 for one cycle after wrapping, even if the timer wrapped multiple times', () => {
            const { bus, timer } = setup();
            bus.write(0xff07, 0x05);
            bus.write(0xff06, 0xe0);

            timer.cycle((256 + 0x20) * 16);

            expect(bus.read(0xff05)).toBe(0);

            timer.cycle(1);

            expect(bus.read(0xff05)).toBe(0xe0);
        });
    });
});
