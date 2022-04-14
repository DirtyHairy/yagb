import { Bus, ReadHandler, WriteHandler } from './bus';

import { SystemInterface } from './system';

const enum reg {
    base = 0xff40,
    lcdc = 0x00,
    stat = 0x01,
    scy = 0x02,
    scx = 0x03,
    ly = 0x04,
    lyc = 0x05,
    dma = 0x06,
    bgp = 0x07,
    obp0 = 0x08,
    obp1 = 0x09,
    wy = 0x0a,
    wx = 0x0b,
}

export const enum Mode {
    hblank = 0,
    vblank = 1,
    oamScan = 2,
    draw = 3,
}

const enum Lcdc {
    enable = 0x80,
}

export class Ppu {
    constructor(private system: SystemInterface) {}

    install(bus: Bus): void {
        for (let i = 0xff40; i <= 0xff4b; i++) {
            bus.map(i, this.stubRead, this.stubWrite);
        }

        for (let i = 0x8000; i < 0xa000; i++) {
            bus.map(i, this.vramRead, this.vramWrite);
        }

        for (let i = 0xfe00; i < 0xfea0; i++) {
            bus.map(i, this.oamRead, this.oamWrite);
        }

        for (let i = 0xfea0; i < 0xff00; i++) {
            bus.map(i, this.stubRead, this.stubWrite);
        }

        for (let i = 0; i <= reg.wx; i++) {
            bus.map(reg.base + i, this.registerRead, this.registerWrite);
        }

        bus.map(reg.base + reg.ly, this.lyRead, this.stubWrite);
        bus.map(reg.base + reg.stat, this.statRead, this.registerWrite);
    }

    reset(): void {
        this.clockInMode = 0;
        this.mode = Mode.oamScan;
        this.scanline = 0;
        this.frame = 0;

        this.vram.fill(0);
        this.oam.fill(0);
        this.reg.fill(0);
    }

    cycle(systemClocks: number): void {
        while (systemClocks > 0) {
            systemClocks -= this.consumeClocks(systemClocks);
        }
    }

    printState(): string {
        return `scanline=${this.scanline} mode=${this.mode} clockInMode=${this.clockInMode} frame=${this.frame}`;
    }

    getFrame(): number {
        return this.frame;
    }

    getMode(): Mode {
        return this.mode;
    }

    private consumeClocks(clocks: number): number {
        switch (this.mode) {
            case Mode.oamScan:
                if (clocks + this.clockInMode >= 80) {
                    const consumed = 80 - this.clockInMode;

                    this.mode = Mode.draw;
                    this.clockInMode = 0;

                    return consumed;
                } else {
                    this.clockInMode += clocks;
                    return clocks;
                }

            case Mode.draw:
                if (clocks + this.clockInMode >= 172) {
                    const consumed = 172 - this.clockInMode;

                    this.mode = Mode.hblank;
                    this.clockInMode = 0;

                    return consumed;
                } else {
                    this.clockInMode += clocks;
                    return clocks;
                }

            case Mode.hblank:
                if (clocks + this.clockInMode >= 204) {
                    const consumed = 204 - this.clockInMode;

                    this.scanline++;
                    this.mode = this.scanline === 144 ? Mode.vblank : Mode.oamScan;
                    this.clockInMode = 0;

                    return consumed;
                } else {
                    this.clockInMode += clocks;
                    return clocks;
                }

            case Mode.vblank:
                if (clocks + this.clockInMode >= 4560) {
                    const consumed = 4560 - this.clockInMode;

                    this.mode = Mode.oamScan;
                    this.clockInMode = 0;
                    this.scanline = 0;
                    this.frame++;

                    return consumed;
                } else {
                    this.clockInMode += clocks;
                    this.scanline = 144 + ((this.clockInMode / 456) | 0);
                    return clocks;
                }
        }
    }

    private stubRead: ReadHandler = () => 0;
    private stubWrite: WriteHandler = () => undefined;

    private vramRead: ReadHandler = (address) =>
        (this.reg[reg.lcdc] & Lcdc.enable) === 0 || this.mode !== Mode.draw ? this.vram[address & 0x1fff] : 0xff;
    private vramWrite: WriteHandler = (address, value) =>
        ((this.reg[reg.lcdc] & Lcdc.enable) === 0 || this.mode !== Mode.draw) && (this.vram[address & 0x1fff] = value);

    private oamRead: ReadHandler = (address) =>
        (this.reg[reg.lcdc] & Lcdc.enable) === 0 || (this.mode !== Mode.draw && this.mode !== Mode.oamScan)
            ? this.oam[address & 0xff]
            : 0xff;
    private oamWrite: WriteHandler = (address, value) =>
        ((this.reg[reg.lcdc] & Lcdc.enable) === 0 || (this.mode !== Mode.draw && this.mode !== Mode.oamScan)) &&
        (this.oam[address & 0xff] = value);

    private registerRead: ReadHandler = (address) => this.reg[address - reg.base];
    private registerWrite: WriteHandler = (address, value) => (this.reg[address - reg.base] = value);

    private statRead: ReadHandler = () => (this.reg[reg.stat] & 0xf8) | (this.reg[reg.lyc] === this.scanline ? 4 : 0) | this.mode;
    private lyRead: ReadHandler = () => this.scanline;

    private clockInMode = 0;
    private scanline = 0;
    private frame = 0;
    private mode: Mode = Mode.oamScan;

    private vram = new Uint8Array(0x2000);
    private oam = new Uint8Array(0xa0);

    private reg = new Uint8Array(reg.wx + 1);
}
