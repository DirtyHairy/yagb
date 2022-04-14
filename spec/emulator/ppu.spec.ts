import { Mode, Ppu } from '../../src/emulator/ppu';

import { Bus } from '../../src/emulator/bus';
import { System } from '../../src/emulator/system';

describe('PPU', () => {
    describe('state machine', () => {
        function setup(): { ppu: Ppu; bus: Bus } {
            const system = new System((msg) => console.log(msg));
            const bus = new Bus(system);
            const ppu = new Ppu(system);

            ppu.install(bus);

            ppu.reset();

            return { bus, ppu };
        }

        function suite(increment: (ppu: Ppu, cycles: number) => void) {
            it('starts in mode 2 (OAM scan)', () => {
                const { ppu } = setup();

                expect(ppu.mode).toBe(Mode.oamScan);
            });

            it('enters mode 3 (draw) after 80 cyles', () => {
                const { ppu } = setup();

                increment(ppu, 79);

                expect(ppu.mode).toBe(Mode.oamScan);

                increment(ppu, 1);

                expect(ppu.mode).toBe(Mode.draw);
            });

            it('enters mode 3 (hblank) after 252 cyles', () => {
                const { ppu } = setup();

                increment(ppu, 251);

                expect(ppu.mode).toBe(Mode.draw);

                increment(ppu, 1);

                expect(ppu.mode).toBe(Mode.hblank);
            });

            it('enters mode 0 (hblank) after 252 cyles', () => {
                const { ppu } = setup();

                increment(ppu, 251);

                expect(ppu.mode).toBe(Mode.draw);

                increment(ppu, 1);

                expect(ppu.mode).toBe(Mode.hblank);
            });

            it('reenters mode 2 (OAM scan) and increments the line counter after 456 cycles', () => {
                const { ppu, bus } = setup();

                increment(ppu, 455);

                expect(ppu.mode).toBe(Mode.hblank);
                expect(bus.read(0xff44)).toBe(0);

                increment(ppu, 1);

                expect(ppu.mode).toBe(Mode.oamScan);
                expect(bus.read(0xff44)).toBe(1);
            });

            it('enter mode 1 (vblank) after 143 scanlines', () => {
                const { ppu, bus } = setup();

                increment(ppu, 144 * 456 - 1);

                expect(ppu.mode).toBe(Mode.hblank);
                expect(bus.read(0xff44)).toBe(143);

                increment(ppu, 1);

                expect(ppu.mode).toBe(Mode.vblank);
                expect(bus.read(0xff44)).toBe(144);
            });

            it('continues counting scanlines in mode 1 (vblank)', () => {
                const { ppu, bus } = setup();

                increment(ppu, 144 * 456);

                expect(ppu.mode).toBe(Mode.vblank);
                expect(bus.read(0xff44)).toBe(144);

                increment(ppu, 455);

                expect(ppu.mode).toBe(Mode.vblank);
                expect(bus.read(0xff44)).toBe(144);

                increment(ppu, 1);

                expect(ppu.mode).toBe(Mode.vblank);
                expect(bus.read(0xff44)).toBe(145);
            });

            it('starts the next frame after 70224 cycles', () => {
                const { ppu, bus } = setup();

                increment(ppu, 70223);

                expect(ppu.mode).toBe(Mode.vblank);
                expect(bus.read(0xff44)).toBe(153);
                expect(ppu.getFrame()).toBe(0);

                increment(ppu, 1);

                expect(ppu.mode).toBe(Mode.oamScan);
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
});
