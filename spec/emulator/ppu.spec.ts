import { Interrupt, irq } from './../../src/emulator/interrupt';
import { Ppu, ppuMode } from '../../src/emulator/ppu';

import { Bus } from '../../src/emulator/bus';
import { Ram } from './../../src/emulator/ram';
import { System } from '../../src/emulator/system';

describe('PPU', () => {
    function setup(): { ppu: Ppu; bus: Bus; raiseSpy: jest.SpyInstance<void, [irq]> } {
        const system = new System((msg) => console.log(msg));
        const bus = new Bus(system);
        const interrupt = new Interrupt();
        const ppu = new Ppu(system, interrupt);
        const ram = new Ram();

        ppu.install(bus);
        ram.install(bus);

        ram.reset();
        ppu.reset();
        bus.reset();

        const raiseSpy = jest.spyOn(interrupt, 'raise');

        return { bus, ppu, raiseSpy };
    }

    describe('state machine', () => {
        function suite(increment: (ppu: Ppu, cycles: number) => void) {
            it('starts in mode 2 (OAM scan)', () => {
                const { ppu } = setup();

                expect(ppu.getMode()).toBe(ppuMode.oamScan);
            });

            it('enters mode 3 (draw) after 80 cyles', () => {
                const { ppu } = setup();

                increment(ppu, 79);

                expect(ppu.getMode()).toBe(ppuMode.oamScan);

                increment(ppu, 1);

                expect(ppu.getMode()).toBe(ppuMode.draw);
            });

            it('enters mode 0 (hblank) after 252 cyles', () => {
                const { ppu } = setup();

                increment(ppu, 251);

                expect(ppu.getMode()).toBe(ppuMode.draw);

                increment(ppu, 1);

                expect(ppu.getMode()).toBe(ppuMode.hblank);
            });

            it('reenters mode 2 (OAM scan) and increments the line counter after 456 cycles', () => {
                const { ppu, bus } = setup();

                increment(ppu, 455);

                expect(ppu.getMode()).toBe(ppuMode.hblank);
                expect(bus.read(0xff44)).toBe(0);

                increment(ppu, 1);

                expect(ppu.getMode()).toBe(ppuMode.oamScan);
                expect(bus.read(0xff44)).toBe(1);
            });

            it('enter mode 1 (vblank) after 144 scanlines', () => {
                const { ppu, bus } = setup();

                increment(ppu, 144 * 456 - 1);

                expect(ppu.getMode()).toBe(ppuMode.hblank);
                expect(bus.read(0xff44)).toBe(143);

                increment(ppu, 1);

                expect(ppu.getMode()).toBe(ppuMode.vblank);
                expect(bus.read(0xff44)).toBe(144);
            });

            it('continues counting scanlines in mode 1 (vblank)', () => {
                const { ppu, bus } = setup();

                increment(ppu, 144 * 456);

                expect(ppu.getMode()).toBe(ppuMode.vblank);
                expect(bus.read(0xff44)).toBe(144);

                increment(ppu, 455);

                expect(ppu.getMode()).toBe(ppuMode.vblank);
                expect(bus.read(0xff44)).toBe(144);

                increment(ppu, 1);

                expect(ppu.getMode()).toBe(ppuMode.vblank);
                expect(bus.read(0xff44)).toBe(145);
            });

            it('starts the next frame after 70224 cycles', () => {
                const { ppu, bus } = setup();

                increment(ppu, 70223);

                expect(ppu.getMode()).toBe(ppuMode.vblank);
                expect(bus.read(0xff44)).toBe(153);
                expect(ppu.getFrame()).toBe(0);

                increment(ppu, 1);

                expect(ppu.getMode()).toBe(ppuMode.oamScan);
                expect(bus.read(0xff44)).toBe(0);
                expect(ppu.getFrame()).toBe(1);
            });
        }

        describe('with full increments', () => {
            suite((ppu, cycles) => ppu.cycle(cycles));
        });

        describe('incrementing by system cycle', () => {
            const increment = (ppu: Ppu, cycles: number): void => {
                for (let i = 0; i < ((cycles / 4) | 0); i++) {
                    ppu.cycle(4);
                }

                ppu.cycle(cycles % 4);
            };

            suite(increment);
        });
    });

    describe('bus locking', () => {
        function describeMode(mode: ppuMode): string {
            switch (mode) {
                case ppuMode.draw:
                    return 'mode 3 (draw)';

                case ppuMode.hblank:
                    return 'mode 0 (hblank)';

                case ppuMode.oamScan:
                    return 'mode 2 (OAM scan)';

                case ppuMode.vblank:
                    return 'mode 1 (vblank)';

                default:
                    throw new Error('invalid mode');
            }
        }

        function enterMode(mode: ppuMode, ppu: Ppu): void {
            switch (mode) {
                case ppuMode.draw:
                    ppu.cycle(80);
                    return;

                case ppuMode.hblank:
                    ppu.cycle(252);
                    return;

                case ppuMode.oamScan:
                    return;

                case ppuMode.vblank:
                    ppu.cycle(144 * 456);
                    return;

                default:
                    throw new Error('invalid mode');
            }
        }

        [ppuMode.draw, ppuMode.oamScan].forEach((mode) => {
            it(`OAM cannot be accessed in ${describeMode(mode)}`, () => {
                const { bus, ppu } = setup();

                enterMode(mode, ppu);
                expect(ppu.getMode()).toBe(mode);

                bus.write(0xfe00, 0x42);
                expect(bus.read(0xfe00)).toBe(0xff);
            });
        });

        [ppuMode.hblank, ppuMode.vblank].forEach((mode) => {
            it(`OAM can be accessed in ${describeMode(mode)}`, () => {
                const { bus, ppu } = setup();

                enterMode(mode, ppu);
                expect(ppu.getMode()).toBe(mode);

                bus.write(0xfe00, 0x42);
                expect(bus.read(0xfe00)).toBe(0x42);
            });
        });

        it('OAM can always be accessed if PPU is disabled', () => {
            const { bus, ppu } = setup();

            bus.write(0xff40, 0x00);
            enterMode(ppuMode.oamScan, ppu);
            expect(ppu.getMode()).toBe(ppuMode.oamScan);

            bus.write(0xfe00, 0x42);
            expect(bus.read(0xfe00)).toBe(0x42);
        });

        [ppuMode.draw].forEach((mode) => {
            it(`VRAM cannot be accessed in ${describeMode(mode)}`, () => {
                const { bus, ppu } = setup();

                enterMode(mode, ppu);
                expect(ppu.getMode()).toBe(mode);

                bus.write(0x8000, 0x42);
                expect(bus.read(0x8000)).toBe(0xff);
            });
        });

        [ppuMode.hblank, ppuMode.vblank, ppuMode.oamScan].forEach((mode) => {
            it(`VRAM can be accessed in ${describeMode(mode)}`, () => {
                const { bus, ppu } = setup();

                enterMode(mode, ppu);
                expect(ppu.getMode()).toBe(mode);

                bus.write(0x8000, 0x42);
                expect(bus.read(0x8000)).toBe(0x42);
            });
        });

        it('VRAM can always be accessed if PPU is disabled', () => {
            const { bus, ppu } = setup();

            enterMode(ppuMode.draw, ppu);
            expect(ppu.getMode()).toBe(ppuMode.draw);

            bus.write(0xff40, 0x00);
            bus.write(0x8000, 0x42);
            expect(bus.read(0x8000)).toBe(0x42);
        });
    });

    describe('Interrupts', () => {
        it('entering vblank triggers vblank irq', () => {
            const { ppu, raiseSpy } = setup();

            ppu.cycle(144 * 456 - 1);

            expect(raiseSpy).not.toHaveBeenCalled();
            expect(ppu.getMode()).not.toBe(ppuMode.vblank);

            ppu.cycle(1);

            expect(ppu.getMode()).toBe(ppuMode.vblank);
            expect(raiseSpy).toBeCalledTimes(1);
            expect(raiseSpy).toBeCalledWith(irq.vblank);
        });

        it('entering mode 2 (OAM scan) triggers STAT interrupt if configured', () => {
            const { bus, ppu, raiseSpy } = setup();

            bus.write(0xff41, 0x20);
            raiseSpy.mockReset();

            ppu.cycle(455);
            expect(ppu.getMode()).not.toBe(ppuMode.oamScan);
            expect(raiseSpy).not.toHaveBeenCalled();

            ppu.cycle(1);
            expect(ppu.getMode()).toBe(ppuMode.oamScan);
            expect(raiseSpy).toBeCalledTimes(1);
            expect(raiseSpy).toBeCalledWith(irq.stat);
        });

        it('entering mode 2 (OAM scan) does not trigger STAT interrupt if not configured', () => {
            const { bus, ppu, raiseSpy } = setup();

            bus.write(0xff41, 0x00);
            raiseSpy.mockReset();

            ppu.cycle(455);
            expect(ppu.getMode()).not.toBe(ppuMode.oamScan);
            expect(raiseSpy).not.toHaveBeenCalled();

            ppu.cycle(1);
            expect(ppu.getMode()).toBe(ppuMode.oamScan);
            expect(raiseSpy).not.toHaveBeenCalled();
        });

        it('entering mode 1 (vblank) triggers STAT interrupt if configured', () => {
            const { bus, ppu, raiseSpy } = setup();

            bus.write(0xff41, 0x10);

            ppu.cycle(144 * 456 - 1);
            expect(ppu.getMode()).not.toBe(ppuMode.vblank);
            expect(raiseSpy).not.toHaveBeenCalled();

            ppu.cycle(1);
            expect(ppu.getMode()).toBe(ppuMode.vblank);
            expect(raiseSpy).toBeCalledTimes(2);
            expect(raiseSpy).toBeCalledWith(irq.stat);
        });

        it('entering mode 1 (vblank) does not trigger STAT interrupt if not configured', () => {
            const { bus, ppu, raiseSpy } = setup();

            bus.write(0xff41, 0x00);
            raiseSpy.mockReset();

            ppu.cycle(144 * 456 - 1);
            expect(ppu.getMode()).not.toBe(ppuMode.vblank);
            expect(raiseSpy).not.toHaveBeenCalled();

            ppu.cycle(1);
            expect(ppu.getMode()).toBe(ppuMode.vblank);
            expect(raiseSpy).toBeCalledTimes(1);
            expect(raiseSpy).not.toHaveBeenCalledWith(irq.stat);
        });

        it('entering mode 0 (hblank) triggers STAT interrupt if configured', () => {
            const { bus, ppu, raiseSpy } = setup();

            bus.write(0xff41, 0x08);
            raiseSpy.mockReset();

            ppu.cycle(251);
            expect(ppu.getMode()).not.toBe(ppuMode.hblank);
            expect(raiseSpy).not.toHaveBeenCalled();

            ppu.cycle(1);
            expect(raiseSpy).toBeCalledTimes(1);
            expect(raiseSpy).toBeCalledWith(irq.stat);
        });

        it('entering mode 0 (hblank) does not trigger STAT interrupt if not configured', () => {
            const { bus, ppu, raiseSpy } = setup();

            bus.write(0xff41, 0x00);
            raiseSpy.mockReset();

            ppu.cycle(251);
            expect(ppu.getMode()).not.toBe(ppuMode.hblank);
            expect(raiseSpy).not.toHaveBeenCalled();

            ppu.cycle(1);
            expect(raiseSpy).not.toHaveBeenCalled();
        });

        it('hitting LYC triggers STAT interrupt if configured', () => {
            const { bus, ppu, raiseSpy } = setup();

            bus.write(0xff41, 0x40);
            bus.write(0xff45, 10);
            raiseSpy.mockReset();

            ppu.cycle(10 * 456 - 1);
            expect(raiseSpy).not.toHaveBeenCalledWith(irq.stat);

            ppu.cycle(1);
            expect(raiseSpy).toHaveBeenCalledWith(irq.stat);
        });

        it('hitting LYC does not trigger STAT interrupt if not configured', () => {
            const { bus, ppu, raiseSpy } = setup();

            bus.write(0xff41, 0x00);
            bus.write(0xff45, 10);
            raiseSpy.mockReset();

            ppu.cycle(10 * 456 - 1);
            expect(raiseSpy).not.toHaveBeenCalledWith(irq.stat);

            ppu.cycle(1);
            expect(raiseSpy).not.toHaveBeenCalledWith(irq.stat);
        });

        it('STAT does not trigger multiple times trough consecutive conditions', () => {
            const { bus, ppu, raiseSpy } = setup();

            bus.write(0xff41, 0x48);
            bus.write(0xff45, 10);
            ppu.cycle(9 * 456);
            raiseSpy.mockReset();

            expect(raiseSpy).not.toHaveBeenCalled();

            ppu.cycle(456);
            expect(raiseSpy).toHaveBeenCalledTimes(1);
        });

        it('STAT can be triggered by writing a register', () => {
            const { bus, ppu, raiseSpy } = setup();

            bus.write(0xff41, 0x40);
            bus.write(0xff45, 11);
            raiseSpy.mockReset();

            ppu.cycle(10 * 456);
            expect(raiseSpy).not.toHaveBeenCalledWith(irq.stat);

            bus.write(0xff45, 10);
            expect(raiseSpy).toHaveBeenCalledWith(irq.stat);
        });

        it('STAT cannot be triggered by writing a register if the PPU is disabled', () => {
            const { bus, ppu, raiseSpy } = setup();

            bus.write(0xff41, 0x40);
            bus.write(0xff45, 11);
            raiseSpy.mockReset();

            ppu.cycle(10 * 456);
            expect(raiseSpy).not.toHaveBeenCalledWith(irq.stat);

            bus.write(0xff40, 0x00);
            bus.write(0xff45, 10);
            expect(raiseSpy).not.toHaveBeenCalledWith(irq.stat);
        });
    });

    describe('STAT flags', () => {
        it('LYC = LY triggers appropiately', () => {
            const { bus, ppu } = setup();

            bus.write(0xff45, 10);

            ppu.cycle(10 * 456 - 1);
            expect(bus.read(0xff41) & 0x04).toBe(0);

            ppu.cycle(1);
            bus.write(0xff45, 10);
            expect(bus.read(0xff41) & 0x04).toBe(0x04);
        });

        it('flags mode 2 (OAM scan)', () => {
            const { bus } = setup();

            expect(bus.read(0xff41) & 0x043).toBe(0x02);
        });

        it('flags mode 3 (draw)', () => {
            const { bus, ppu } = setup();

            ppu.cycle(80);

            expect(bus.read(0xff41) & 0x043).toBe(0x03);
        });

        it('flags mode 0 (hblank)', () => {
            const { bus, ppu } = setup();

            ppu.cycle(252);

            expect(bus.read(0xff41) & 0x043).toBe(0x00);
        });

        it('flags mode 1 (vblank)', () => {
            const { bus, ppu } = setup();

            ppu.cycle(144 * 456);

            expect(bus.read(0xff41) & 0x043).toBe(0x01);
        });
    });

    describe('PPU enable', () => {
        it('PPU is enabled on reset', () => {
            const { bus } = setup();

            expect(bus.read(0xff40) & 0x80).toBe(0x80);
        });

        it('state machine does not advance if the PPU is disabled', () => {
            const { bus, ppu } = setup();

            bus.write(0xff40, 0x00);
            ppu.cycle(80);
            expect(ppu.getMode()).toBe(ppuMode.oamScan);

            bus.write(0xff40, 0x80);
            ppu.cycle(79);
            expect(ppu.getMode()).toBe(ppuMode.oamScan);

            ppu.cycle(1);
            expect(ppu.getMode()).toBe(ppuMode.draw);
        });

        it('state machine continues once PPU is reenabled', () => {
            const { bus, ppu } = setup();

            ppu.cycle(79);
            expect(ppu.getMode()).toBe(ppuMode.oamScan);

            bus.write(0xff40, 0x00);
            ppu.cycle(1);
            expect(ppu.getMode()).toBe(ppuMode.oamScan);

            bus.write(0xff40, 0x80);
            ppu.cycle(1);
            expect(ppu.getMode()).toBe(ppuMode.draw);
        });
    });

    describe('OAM DMA', () => {
        it('starting a DMA transfer locks the bus', () => {
            const { bus } = setup();

            const lockSpy = jest.spyOn(bus, 'lock');
            const unlockSpy = jest.spyOn(bus, 'unlock');

            bus.write(0xff46, 0xc0);
            expect(lockSpy).toHaveBeenCalled();
            expect(unlockSpy).not.toHaveBeenCalled();
        });

        it('finishes and unlocks the bus after 160 * 4 = 640 cycles', () => {
            const { bus, ppu } = setup();

            const unlockSpy = jest.spyOn(bus, 'unlock');

            bus.write(0xff46, 0xc0);
            ppu.cycle(640);
            expect(unlockSpy).not.toHaveBeenCalled();

            ppu.cycle(1);
            expect(unlockSpy).toHaveBeenCalled();
        });

        it('copies 160 bytes to OAM RAM', () => {
            const { bus, ppu } = setup();

            for (let i = 0; i < 160; i++) {
                bus.write(0xc000 + i, i + 1);
            }

            bus.write(0xff46, 0xc0);
            ppu.cycle(641);
            bus.write(0xff40, 0x00);

            for (let i = 0; i << 160; i++) {
                expect(bus.read(0xfe00 + i)).toBe(i + 1);
            }
        });
    });
});
