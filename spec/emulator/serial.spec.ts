import { Interrupt, irq } from './../../src/emulator/interrupt';

import { Bus } from './../../src/emulator/bus';
import { Serial } from './../../src/emulator/serial';
import { System } from './../../src/emulator/system';

describe('serial out', () => {
    function setup(): { bus: Bus; serial: Serial; system: System; raiseSpy: jest.SpyInstance<void, [irq]> } {
        const system = new System((msg) => console.log(msg));
        const bus = new Bus(system);
        const interrupt = new Interrupt();
        const serial = new Serial(interrupt);

        serial.install(bus);

        const raiseSpy = jest.spyOn(interrupt, 'raise');

        return { system, bus, raiseSpy, serial };
    }

    it('only bits 0 and 7 of SC can be written', () => {
        const { bus } = setup();

        bus.write(0xff02, 0xff);
        expect(bus.read(0xff02)).toBe(0x81);
    });

    it('transfer does not start if clock is set to internal', () => {
        const { bus, serial } = setup();

        bus.write(0xff01, 0x01);
        bus.write(0xff02, 0x80);

        serial.clock(8 * 128);

        expect(bus.read(0xff01)).toBe(0x01);
        expect(bus.read(0xff02)).toBe(0x80);
    });

    it('transfer shifts 0xff into SB ab 8kHz', () => {
        const { bus, serial } = setup();

        bus.write(0xff01, 0x02);
        bus.write(0xff02, 0x81);

        serial.clock(127);
        expect(bus.read(0xff01)).toBe(0x02);

        serial.clock(1);
        expect(bus.read(0xff01)).toBe(0x05);

        serial.clock(128);
        expect(bus.read(0xff01)).toBe(0x0b);

        serial.clock(5 * 128);
        expect(bus.read(0xff01)).toBe(0x7f);

        serial.clock(128);
        expect(bus.read(0xff01)).toBe(0xff);
    });

    it('transfer start flag clears after transfer has finished', () => {
        const { bus, serial } = setup();

        bus.write(0xff01, 0x02);
        bus.write(0xff02, 0x81);

        serial.clock(128 * 8 - 1);
        expect(bus.read(0xff02)).toBe(0x81);

        serial.clock(1);
        expect(bus.read(0xff02)).toBe(0x01);
    });

    it('transfer raises serial interrupt after transfer has finished', () => {
        const { bus, serial, raiseSpy } = setup();

        bus.write(0xff01, 0x02);
        bus.write(0xff02, 0x81);

        serial.clock(128 * 8 - 1);
        expect(raiseSpy).not.toHaveBeenCalled();

        serial.clock(1);
        expect(raiseSpy).toHaveBeenCalledTimes(1);
        expect(raiseSpy).toHaveBeenCalledWith(irq.serial);
    });
});
