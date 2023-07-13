import { Bus, ReadHandler, WriteHandler } from '../bus';
import { Interrupt, irq } from '../interrupt';
import { Ppu, ppuMode } from '../ppu';

import { PALETTE_CLASSIC } from '../palette';
import { Savestate } from '../savestate';
import { SpriteQueue } from './sprite-queue';
import { System } from '../system';
import { hex8 } from '../../helper/format';

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

const enum lcdc {
    enable = 0x80,
    windowTileMapArea = 0x40,
    windowEnable = 0x20,
    bgTileDataArea = 0x10,
    bgTileMapArea = 0x08,
    objSize = 0x04,
    objEnable = 0x02,
    bgEnable = 0x01,
}

const enum stat {
    sourceLY = 0x40,
    sourceModeOAM = 0x20,
    sourceModeVblank = 0x10,
    sourceModeHblank = 0x08,
}

const SAVESTATE_VERSION = 0x01;

function clockPenaltyForSprite(scx: number, x: number): number {
    let tmp = (x + scx + 8) % 8;
    if (tmp > 5) tmp = 5;

    return 11 - tmp;
}

export abstract class PpuBase implements Ppu {
    constructor(private system: System, private interrupt: Interrupt) {}

    save(savestate: Savestate): void {
        const flag =
            (this.vblankFired ? 0x01 : 0x00) |
            (this.stat ? 0x02 : 0x00) |
            (this.dmaInProgress ? 0x04 : 0x00) |
            (this.lineRendered ? 0x08 : 0x00) |
            (this.windowTriggered ? 0x10 : 0x00);

        savestate
            .startChunk(SAVESTATE_VERSION)
            .write16(this.clockInMode)
            .write16(this.scanline)
            .write16(this.mode)
            .write16(this.wx)
            .write16(this.wy)
            .writeBuffer(this.vram)
            .writeBuffer(this.oam)
            .write16(this.dmaCycle)
            .writeBuffer(this.reg)
            .write16(this.mode3ExtraClocks)
            .write16(this.windowLine)
            .write16(flag)
            .write16(this.vblankLines);
    }

    load(savestate: Savestate): void {
        const version = savestate.validateChunk(SAVESTATE_VERSION);

        this.clockInMode = savestate.read16();
        this.scanline = savestate.read16();
        this.mode = savestate.read16();
        this.wx = savestate.read16();
        this.wy = savestate.read16();
        this.vram.set(savestate.readBuffer(this.vram.length));
        this.oam.set(savestate.readBuffer(this.oam.length));
        this.dmaCycle = savestate.read16();
        this.reg.set(savestate.readBuffer(this.reg.length));
        this.mode3ExtraClocks = savestate.read16();
        this.windowLine = savestate.read16();

        const flag = savestate.read16();
        this.vblankFired = (flag & 0x01) !== 0;
        this.stat = (flag & 0x02) !== 0;
        this.dmaInProgress = (flag & 0x04) !== 0;
        this.lineRendered = (flag & 0x08) !== 0;
        this.windowTriggered = (flag & 0x10) !== 0;

        this.vblankLines = (this.clockInMode / 456) | 0;
        if (version >= 0x01) this.vblankLines = savestate.read16();

        this.frame = 0;
        this.skipFrame = this.mode === ppuMode.vblank ? 0 : 1;

        this.frontBuffer.fill(PALETTE_CLASSIC[4]);
        this.backBuffer.fill(PALETTE_CLASSIC[4]);

        this.updatePalette(this.paletteOB0, this.reg[reg.obp0]);
        this.updatePalette(this.paletteOB1, this.reg[reg.obp1]);
        this.updatePalette(this.paletteBG, this.reg[reg.bgp]);
    }

    install(bus: Bus): void {
        for (let i = 0x8000; i < 0xa000; i++) {
            bus.map(i, this.vramRead, this.vramWrite);
        }

        for (let i = 0xfe00; i < 0xfea0; i++) {
            bus.map(i, this.oamRead, this.oamWrite);
        }

        for (let i = 0; i <= reg.wx; i++) {
            bus.map(reg.base + i, this.registerRead, this.registerWrite);
        }

        bus.map(reg.base + reg.lcdc, this.registerRead, this.lcdcWrite);
        bus.map(reg.base + reg.ly, this.lyRead, this.stubWrite);
        bus.map(reg.base + reg.stat, this.statRead, this.registerWrite);
        bus.map(reg.base + reg.dma, this.registerRead, this.dmaWrite);
        bus.map(reg.base + reg.bgp, this.registerRead, this.bgpWrite);
        bus.map(reg.base + reg.obp0, this.registerRead, this.obp0Write);
        bus.map(reg.base + reg.obp1, this.registerRead, this.obp1Write);

        this.bus = bus;
    }

    reset(): void {
        this.clockInMode = 0;
        this.mode = ppuMode.oamScan;
        this.scanline = 0;
        this.frame = 0;
        this.stat = false;
        this.dmaInProgress = false;
        this.dmaCycle = 0;
        this.skipFrame = 0;
        this.vblankLines = 0;

        this.vram.fill(0);
        this.oam.fill(0);
        this.reg.fill(0);

        this.reg[reg.lcdc] = 0x91;
        this.reg[reg.stat] = 0x80;

        this.reg[reg.bgp] = 0xfc;
        this.reg[reg.obp0] = 0x00;
        this.reg[reg.obp1] = 0x00;

        this.updatePalette(this.paletteBG, this.reg[reg.bgp]);
        this.updatePalette(this.paletteOB0, this.reg[reg.obp0]);
        this.updatePalette(this.paletteOB1, this.reg[reg.obp1]);

        this.frontBuffer.fill(PALETTE_CLASSIC[4]);
        this.backBuffer.fill(PALETTE_CLASSIC[4]);

        this.lineRendered = false;
        this.mode3ExtraClocks = 0;

        this.windowTriggered = false;
        this.windowLine = 0;
    }

    cycle(systemClocks: number): void {
        const lcdEnabled = (this.reg[reg.lcdc] & lcdc.enable) !== 0;

        while (this.dmaInProgress && systemClocks > 0) {
            const maxCyclesForConsumation = systemClocks > 640 - this.dmaCycle ? 640 - this.dmaCycle : systemClocks;
            const consumed = lcdEnabled ? this.consumeClocks(maxCyclesForConsumation) : maxCyclesForConsumation;

            this.dmaCycle += consumed;
            systemClocks -= consumed;

            // DMA takes 640 cycles -> execute DMA in cycle 640. Cycles are incremented after memory accesses are
            // executed, so this implies that the bus is available again in cycle 641.
            if (this.dmaCycle >= 640) this.executeDma();
        }

        if (!lcdEnabled) return;

        while (systemClocks > 0) {
            systemClocks -= this.consumeClocks(systemClocks);
        }
    }

    printState(): string {
        return `scanline=${this.scanline} mode=${this.mode} clockInMode=${this.clockInMode} frame=${this.frame} lcdc=${hex8(this.reg[reg.lcdc])} dma=${
            this.dmaInProgress ? 1 : 0
        } dmaCycle=${this.dmaCycle}`;
    }

    getFrameIndex(): number {
        return this.frame;
    }

    getFrameData(): ArrayBuffer {
        return this.frontBuffer.buffer;
    }

    getMode(): ppuMode {
        return this.mode;
    }

    protected consumeClocks(clocks: number): number {
        switch (this.mode) {
            case ppuMode.oamScan:
                if (clocks + this.clockInMode >= 80) {
                    const consumed = 80 - this.clockInMode;

                    this.mode = ppuMode.draw;
                    this.clockInMode = 0;
                    this.lineRendered = false;
                    this.mode3ExtraClocks = 0;
                    this.updateStat();

                    // Save wx and wy at the beginning and draw and use them later. This helps games
                    // like Popeye 2 that disable the window by moving it off screen during the last
                    // scanline where it should be visible.
                    this.wx = this.reg[reg.wx];
                    this.wy = this.reg[reg.wy];

                    return consumed;
                } else {
                    this.clockInMode += clocks;
                    return clocks;
                }

            case ppuMode.draw:
                if (clocks + this.clockInMode >= 172 + this.mode3ExtraClocks) {
                    const consumed = 172 + this.mode3ExtraClocks - this.clockInMode;
                    this.clockInMode += consumed;

                    if (!this.lineRendered) {
                        this.renderLine();
                        this.lineRendered = true;
                    }

                    // renderLine may have determined a penalty for this line, so recheck whether
                    // we are really ready to switch mode
                    if (this.clockInMode === 172 + this.mode3ExtraClocks) {
                        this.mode = ppuMode.hblank;
                        this.clockInMode = 0;
                        this.updateStat();
                    }

                    return consumed;
                } else {
                    this.clockInMode += clocks;
                    return clocks;
                }

            case ppuMode.hblank:
                if (clocks + this.clockInMode >= 204 - this.mode3ExtraClocks) {
                    const consumed = 204 - this.mode3ExtraClocks - this.clockInMode;

                    this.scanline++;

                    if (this.scanline === 144) {
                        this.mode = ppuMode.vblank;
                        this.vblankFired = false;
                        this.vblankLines = 0;
                    } else {
                        this.mode = ppuMode.oamScan;
                    }

                    this.clockInMode = 0;
                    this.updateStat();

                    return consumed;
                } else {
                    this.clockInMode += clocks;
                    return clocks;
                }

            case ppuMode.vblank:
                if (clocks + this.clockInMode >= 4560) {
                    const consumed = 4560 - this.clockInMode;

                    this.startFrame();

                    if (this.skipFrame <= 0) {
                        this.swapBuffers();
                    } else {
                        this.skipFrame--;
                    }

                    this.updateStat();

                    return consumed;
                } else {
                    this.clockInMode += clocks;

                    if (!this.vblankFired && this.clockInMode >= 4) {
                        this.interrupt.raise(irq.vblank);
                        this.vblankFired = true;
                    }

                    if (this.clockInMode - this.vblankLines * 456 >= 456) this.vblankLines++;
                    let scanline = 144 + this.vblankLines;

                    // Emulate short line 153. It is unclear how long this should be.
                    // The no$gb docs say ~56 cycles, the cycle-exact docs say 4, the SameBoy source
                    // says 12. 4 Kills Prehistorik Man, 12 makes it flicker, so we go with 56 until
                    // we find reason to change it.
                    if (scanline === 153 && this.clockInMode >= 9 * 456 + 56) scanline = 0;

                    if (scanline !== this.scanline) {
                        this.scanline = scanline;
                        this.updateStat();
                    }

                    return clocks;
                }
        }
    }

    protected updateStat(): void {
        const oldStat = this.stat;
        const statval = this.reg[reg.stat];

        this.stat =
            !!(this.reg[reg.lcdc] & lcdc.enable) &&
            ((!!(statval & stat.sourceLY) && this.scanline === this.reg[reg.lyc]) ||
                (!!(statval & stat.sourceModeOAM) && this.mode === ppuMode.oamScan) ||
                (!!(statval & stat.sourceModeVblank) && this.mode === ppuMode.vblank) ||
                (!!(statval & stat.sourceModeHblank) && this.mode === ppuMode.hblank));

        if (this.stat && !oldStat) this.interrupt.raise(irq.stat);
    }

    protected executeDma(): void {
        this.bus.unlock();
        this.dmaInProgress = false;
        this.dmaCycle = 0;

        const base = this.reg[reg.dma] % 0xe0 << 8;

        for (let i = 0; i < 160; i++) {
            this.oam[i] = this.bus.read(base + i);
        }
    }

    protected swapBuffers(): void {
        const frontBuffer = this.frontBuffer;

        this.frontBuffer = this.backBuffer;
        this.backBuffer = frontBuffer;
        this.frame = (this.frame + 1) | 0;
    }

    protected abstract renderLine(): void;

    protected startFrame(): void {
        this.mode = ppuMode.oamScan;
        this.clockInMode = 0;
        this.scanline = 0;
        this.windowTriggered = false;
        this.windowLine = 0;
    }

    protected stubWrite: WriteHandler = () => undefined;

    // It seems that VRAM access is only blocked after the first cycle of mode 3. This fixes the Stunt Racer tech prototype.
    private vramRead: ReadHandler = (address) => ((this.reg[reg.lcdc] & lcdc.enable) === 0 || this.mode !== ppuMode.draw ? this.vram[address & 0x1fff] : 0xff);
    private vramWrite: WriteHandler = (address, value) =>
        ((this.reg[reg.lcdc] & lcdc.enable) === 0 || this.mode !== ppuMode.draw) && (this.vram[address & 0x1fff] = value);

    private oamRead: ReadHandler = (address) =>
        (this.reg[reg.lcdc] & lcdc.enable) === 0 || (this.mode !== ppuMode.draw && this.mode !== ppuMode.oamScan) ? this.oam[address & 0xff] : 0xff;
    private oamWrite: WriteHandler = (address, value) =>
        ((this.reg[reg.lcdc] & lcdc.enable) === 0 || (this.mode !== ppuMode.draw && this.mode !== ppuMode.oamScan)) && (this.oam[address & 0xff] = value);

    private registerRead: ReadHandler = (address) => this.reg[address - reg.base];
    private registerWrite: WriteHandler = (address, value) => {
        this.reg[address - reg.base] = value;
        this.updateStat();
    };

    private statRead: ReadHandler = () =>
        (this.reg[reg.stat] & 0xf8) | (this.reg[reg.lyc] === this.scanline ? 0x04 : 0) | (this.reg[reg.lcdc] & lcdc.enable ? this.mode : 0);

    private lyRead: ReadHandler = () => this.scanline;

    private dmaWrite: WriteHandler = (_, value) => {
        this.reg[reg.dma] = value;

        this.dmaCycle = 0;
        this.dmaInProgress = true;
        this.bus.lock();
    };

    private bgpWrite: WriteHandler = (_, value) => {
        value &= 0xff;
        this.reg[reg.bgp] = value;

        this.updatePalette(this.paletteBG, value);
    };

    private obp0Write: WriteHandler = (_, value) => {
        value &= 0xff;
        this.reg[reg.obp0] = value;

        this.updatePalette(this.paletteOB0, value);
    };

    private obp1Write: WriteHandler = (_, value) => {
        value &= 0xff;
        this.reg[reg.obp1] = value;

        this.updatePalette(this.paletteOB1, value);
    };

    private lcdcWrite: WriteHandler = (_, value) => {
        const oldValue = this.reg[reg.lcdc];
        this.reg[reg.lcdc] = value;

        if (~oldValue & this.reg[reg.lcdc] & lcdc.enable) {
            this.skipFrame = 1;
        }

        if (oldValue & ~this.reg[reg.lcdc] & lcdc.enable) {
            this.backBuffer.fill(PALETTE_CLASSIC[4]);
            this.swapBuffers();
            this.startFrame();
        }
    };

    private clockInMode = 0;
    private scanline = 0;
    private frame = 0;
    private mode: ppuMode = ppuMode.oamScan;
    private skipFrame = 0;
    private vblankFired = false;
    private vblankLines = 0;

    private wx = 0;
    private wy = 0;

    private vram = new Uint8Array(0x2000);
    private oam = new Uint8Array(0xa0);
    private stat = false;

    private vram16 = new Uint16Array(this.vram.buffer);

    private dmaInProgress = false;
    private dmaCycle = 0;

    private reg = new Uint8Array(reg.wx + 1);
    private bus!: Bus;

    private paletteBG = PALETTE_CLASSIC.slice();
    private paletteOB0 = PALETTE_CLASSIC.slice();
    private paletteOB1 = PALETTE_CLASSIC.slice();

    private frontBuffer = new Uint32Array(160 * 144);
    private backBuffer = new Uint32Array(160 * 144);

    private spriteQueue = new SpriteQueue(this.vram, this.oam, this.paletteOB0, this.paletteOB1);
    private spriteCounter = new Uint8Array(10);

    private lineRendered = false;
    private mode3ExtraClocks = 0;

    private windowTriggered = false;
    private windowLine = 0;
}
