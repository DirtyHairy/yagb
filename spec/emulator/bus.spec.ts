import { Bus } from '../../src/emulator/bus';
import { System } from './../../src/emulator/system';

describe('Bus', () => {
    function setup(): { bus: Bus } {
        const system = new System((msg) => console.log(msg));
        const bus = new Bus(system);

        return { bus };
    }

    it('forwards read access to the mapped handler', () => {
        const { bus } = setup();

        const readSpy = jest.fn(() => 0x42);
        bus.map(0x0001, readSpy, () => undefined);

        bus.read(0x0000);
        expect(readSpy).not.toHaveBeenCalled();

        expect(bus.read(0x0001)).toBe(0x42);
        expect(readSpy).toHaveBeenCalled();
    });

    it('forwards write access to the mapped handler', () => {
        const { bus } = setup();

        const writeSpy = jest.fn(() => undefined);
        bus.map(0x0001, () => 0, writeSpy);

        bus.write(0x0000, 0x42);
        expect(writeSpy).not.toHaveBeenCalled();

        bus.write(0x0001, 0x42);
        expect(writeSpy).toHaveBeenCalledWith(0x0001, 0x42);
    });

    it('blocks generic read access if locked', () => {
        const { bus } = setup();

        const readSpy = jest.fn(() => 0x42);
        bus.map(0x0001, readSpy, () => undefined);
        bus.lock();

        expect(bus.read(0x0001)).toBe(0xff);
        expect(readSpy).not.toHaveBeenCalled();
    });

    it('blocks generic wrote access if locked', () => {
        const { bus } = setup();

        const writeSpy = jest.fn(() => undefined);
        bus.map(0x0001, () => 0, writeSpy);
        bus.lock();

        bus.write(0x0001, 0x42);
        expect(writeSpy).not.toHaveBeenCalled();
    });

    it('allows read access to HIRAM if locked', () => {
        const { bus } = setup();

        const readSpy = jest.fn(() => 0x42);
        bus.map(0xff80, readSpy, () => undefined);
        bus.map(0xfffe, readSpy, () => undefined);
        bus.lock();

        expect(bus.read(0xff80)).toBe(0x42);
        expect(readSpy).toHaveBeenCalledTimes(1);

        expect(bus.read(0xfffe)).toBe(0x42);
        expect(readSpy).toHaveBeenCalledTimes(2);
    });

    it('allows write access to HIRAM if locked', () => {
        const { bus } = setup();

        const writeSpy = jest.fn(() => undefined);
        bus.map(0xff80, () => 0, writeSpy);
        bus.map(0xfffe, () => 0, writeSpy);
        bus.lock();

        bus.write(0xff80, 0x42);
        expect(writeSpy).toHaveBeenCalledTimes(1);

        bus.write(0xfffe, 0x42);
        expect(writeSpy).toHaveBeenCalledTimes(2);
    });
});
