import { Mode, Ppu } from '../../src/emulator/ppu';

import { Bus } from '../../src/emulator/bus';
import { System } from '../../src/emulator/system';

describe('PPU', () => {
    function setup(): { ppu: Ppu; bus: Bus } {
        const system = new System((msg) => console.log(msg));
        const bus = new Bus(system);
        const ppu = new Ppu(system);

        ppu.install(bus);

        ppu.reset();

        return { bus, ppu };
    }

    describe('state machine', () => {
        function suite(increment: (ppu: Ppu, cycles: number) => void) {
            it('starts in mode 2 (OAM scan)', () => {
                const { ppu } = setup();

                expect(ppu.getMode()).toBe(Mode.oamScan);
            });

            it('enters mode 3 (draw) after 80 cyles', () => {
                const { ppu } = setup();

                increment(ppu, 79);

                expect(ppu.getMode()).toBe(Mode.oamScan);

                increment(ppu, 1);

                expect(ppu.getMode()).toBe(Mode.draw);
            });

            it('enters mode 3 (hblank) after 252 cyles', () => {
                const { ppu } = setup();

                increment(ppu, 251);

                expect(ppu.getMode()).toBe(Mode.draw);

                increment(ppu, 1);

                expect(ppu.getMode()).toBe(Mode.hblank);
            });

            it('enters mode 0 (hblank) after 252 cyles', () => {
                const { ppu } = setup();

                increment(ppu, 251);

                expect(ppu.getMode()).toBe(Mode.draw);

                increment(ppu, 1);

                expect(ppu.getMode()).toBe(Mode.hblank);
            });

            it('reenters mode 2 (OAM scan) and increments the line counter after 456 cycles', () => {
                const { ppu, bus } = setup();

                increment(ppu, 455);

                expect(ppu.getMode()).toBe(Mode.hblank);
                expect(bus.read(0xff44)).toBe(0);

                increment(ppu, 1);

                expect(ppu.getMode()).toBe(Mode.oamScan);
                expect(bus.read(0xff44)).toBe(1);
            });

            it('enter mode 1 (vblank) after 143 scanlines', () => {
                const { ppu, bus } = setup();

                increment(ppu, 144 * 456 - 1);

                expect(ppu.getMode()).toBe(Mode.hblank);
                expect(bus.read(0xff44)).toBe(143);

                increment(ppu, 1);

                expect(ppu.getMode()).toBe(Mode.vblank);
                expect(bus.read(0xff44)).toBe(144);
            });

            it('continues counting scanlines in mode 1 (vblank)', () => {
                const { ppu, bus } = setup();

                increment(ppu, 144 * 456);

                expect(ppu.getMode()).toBe(Mode.vblank);
                expect(bus.read(0xff44)).toBe(144);

                increment(ppu, 455);

                expect(ppu.getMode()).toBe(Mode.vblank);
                expect(bus.read(0xff44)).toBe(144);

                increment(ppu, 1);

                expect(ppu.getMode()).toBe(Mode.vblank);
                expect(bus.read(0xff44)).toBe(145);
            });

            it('starts the next frame after 70224 cycles', () => {
                const { ppu, bus } = setup();

                increment(ppu, 70223);

                expect(ppu.getMode()).toBe(Mode.vblank);
                expect(bus.read(0xff44)).toBe(153);
                expect(ppu.getFrame()).toBe(0);

                increment(ppu, 1);

                expect(ppu.getMode()).toBe(Mode.oamScan);
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
        function describeMode(mode: Mode): string {
            switch (mode) {
                case Mode.draw:
                    return 'mode 3 (draw)';

                case Mode.hblank:
                    return 'mode 0 (hblank)';

                case Mode.oamScan:
                    return 'mode 2 (OAM scan)';

                case Mode.vblank:
                    return 'mode 1 (vblank)';

                default:
                    throw new Error('invalid mode');
            }
        }

        function enterMode(mode: Mode, ppu: Ppu): void {
            switch (mode) {
                case Mode.draw:
                    ppu.cycle(80);
                    return;

                case Mode.hblank:
                    ppu.cycle(252);
                    return;

                case Mode.oamScan:
                    return;

                case Mode.vblank:
                    ppu.cycle(144 * 456);
                    return;

                default:
                    throw new Error('invalid mode');
            }
        }

        [Mode.draw, Mode.oamScan].forEach((mode) => {
            it(`OAM cannot be accessed in ${describeMode(mode)}`, () => {
                const { bus, ppu } = setup();

                bus.write(0xff40, 0x80);
                enterMode(mode, ppu);
                expect(ppu.getMode()).toBe(mode);

                bus.write(0xfe00, 0x42);
                expect(bus.read(0xfe00)).toBe(0xff);
            });
        });

        [Mode.hblank, Mode.vblank].forEach((mode) => {
            it(`OAM can be accessed in ${describeMode(mode)}`, () => {
                const { bus, ppu } = setup();

                bus.write(0xff40, 0x80);
                enterMode(mode, ppu);
                expect(ppu.getMode()).toBe(mode);

                bus.write(0xfe00, 0x42);
                expect(bus.read(0xfe00)).toBe(0x42);
            });
        });

        it('OAM can always be accessed if PPU is disabled', () => {
            const { bus, ppu } = setup();

            bus.write(0xff40, 0x00);
            enterMode(Mode.oamScan, ppu);
            expect(ppu.getMode()).toBe(Mode.oamScan);

            bus.write(0xfe00, 0x42);
            expect(bus.read(0xfe00)).toBe(0x42);
        });

        [Mode.draw].forEach((mode) => {
            it(`VRAM cannot be accessed in ${describeMode(mode)}`, () => {
                const { bus, ppu } = setup();

                bus.write(0xff40, 0x80);
                enterMode(mode, ppu);
                expect(ppu.getMode()).toBe(mode);

                bus.write(0x8000, 0x42);
                expect(bus.read(0x8000)).toBe(0xff);
            });
        });

        [Mode.hblank, Mode.vblank, Mode.oamScan].forEach((mode) => {
            it(`VRAM can be accessed in ${describeMode(mode)}`, () => {
                const { bus, ppu } = setup();

                bus.write(0xff40, 0x80);
                enterMode(mode, ppu);
                expect(ppu.getMode()).toBe(mode);

                bus.write(0x8000, 0x42);
                expect(bus.read(0x8000)).toBe(0x42);
            });
        });

        it('VRAM can always be accessed if PPU is disabled', () => {
            const { bus, ppu } = setup();

            bus.write(0xff40, 0x00);
            enterMode(Mode.draw, ppu);
            expect(ppu.getMode()).toBe(Mode.draw);

            bus.write(0x8000, 0x42);
            expect(bus.read(0x8000)).toBe(0x42);
        });
    });
});
