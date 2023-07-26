import { Bus, WriteHandler } from '../bus';
import { PpuBase, clockPenaltyForSprite } from './ppu-base';

import { PALETTE_CLASSIC } from '../palette';
import { Savestate } from '../savestate';
import { SpriteQueueDmg } from './sprite-queue-dmg';

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

export class PpuDmg extends PpuBase {
    load(savestate: Savestate): void {
        super.load(savestate);

        this.frontBuffer.fill(PALETTE_CLASSIC[4]);
        this.backBuffer.fill(PALETTE_CLASSIC[4]);

        this.updatePalette(this.paletteOB0, this.reg[reg.obp0]);
        this.updatePalette(this.paletteOB1, this.reg[reg.obp1]);
        this.updatePalette(this.paletteBG, this.reg[reg.bgp]);
    }

    install(bus: Bus): void {
        super.install(bus);

        bus.map(reg.base + reg.bgp, this.registerRead, this.bgpWrite);
        bus.map(reg.base + reg.obp0, this.registerRead, this.obp0Write);
        bus.map(reg.base + reg.obp1, this.registerRead, this.obp1Write);

        this.bus = bus;
    }

    reset(): void {
        super.reset();

        this.updatePalette(this.paletteBG, this.reg[reg.bgp]);
        this.updatePalette(this.paletteOB0, this.reg[reg.obp0]);
        this.updatePalette(this.paletteOB1, this.reg[reg.obp1]);

        this.frontBuffer.fill(PALETTE_CLASSIC[4]);
        this.backBuffer.fill(PALETTE_CLASSIC[4]);
    }

    protected oamDmaCyclesTotal(): number {
        return 640;
    }

    protected initializeVram(): [Uint8Array, Uint16Array] {
        const vram = new Uint8Array(0x2000);
        const vram16 = new Uint16Array(vram.buffer);

        return [vram, vram16];
    }

    protected lcdcWrite: WriteHandler = (_, value) => {
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

    protected renderLine(): void {
        const backgroundX = this.reg[reg.scx];
        const backgroundY = this.reg[reg.scy] + this.scanline;
        const bgEnable = (this.reg[reg.lcdc] & lcdc.bgEnable) !== 0;
        const windowEnable = bgEnable && (this.reg[reg.lcdc] & lcdc.windowEnable) !== 0 && this.wx <= 166;
        const windowX = this.wx - 7;
        const windowY = this.wy;

        let bgTileNY = 0;
        let bgTileY = 0;
        let bgTileX = 0;
        let bgTileNX = 0;
        let bgTileData = 0;

        // Increment window line if window is enabled and has been triggered for this frame
        if (windowEnable && this.windowTriggered) this.windowLine++;
        // Trigger window if current scanline matches wy
        if (windowY === this.scanline) this.windowTriggered = true;
        // Start with window active?
        let windowActive = windowEnable && this.windowTriggered && windowX <= 0;

        if (bgEnable) {
            if (windowActive) {
                bgTileNY = this.windowLine >>> 3;
                bgTileY = this.windowLine & 0x07;
                bgTileX = -windowX;
                bgTileData = this.backgroundTileData(true, bgTileNX, bgTileNY, bgTileY) << bgTileX;
            } else {
                bgTileNY = backgroundY >>> 3;
                bgTileY = backgroundY & 0x07;
                bgTileX = backgroundX & 0x07;
                bgTileNX = backgroundX >>> 3;
                bgTileData = this.backgroundTileData(false, bgTileNX, bgTileNY, bgTileY) << bgTileX;
            }
        }

        // see pandocs; penalty from background shift
        this.mode3ExtraClocks = backgroundX % 8;

        let pixelAddress = 160 * this.scanline;

        // The index of the first (if any) sprite that is currently rendered.
        // No sprites are pending if this is equal to nextPendingSprite.
        let firstRenderingSprite = 0;
        // The index of the next sprite that will be rendered we reach it.
        let nextPendingSprite = 0;

        // Are sprites enabled?
        let hasSprites = (this.reg[reg.lcdc] & lcdc.objEnable) > 0;

        if (hasSprites) {
            // Find and preprocess first 10 sprites that are visible in this line.
            //
            // THE SPRITE LIST IS ORDERED BY X COORDINATE. THIS IS ESSENTIAL FOR THE FOLLOWING
            // ALGORITHM.
            this.spriteQueue.initialize(this.scanline, (this.reg[reg.lcdc] & lcdc.objSize) > 0);

            // No sprites on this line? -> Proceed like they were disabled
            hasSprites &&= this.spriteQueue.length > 0;

            // Account for sprites that start early or that are offscreen
            for (let i = 0; i < this.spriteQueue.length; i++) {
                // This sprite starts after pixel 0? -> we can stop scanning
                if (this.spriteQueue.positionX[i] > 0) break;

                if (this.spriteQueue.positionX[i] < -7) {
                    // Offscreen? -> skip it and start with the next sprite
                    firstRenderingSprite = nextPendingSprite = i + 1;
                } else {
                    // Starts early? Account for it and adjust for the pixels that lie off-screen
                    this.spriteCounter[i] = -this.spriteQueue.positionX[i];
                    this.spriteQueue.data[i] <<= this.spriteCounter[i];

                    nextPendingSprite = i + 1;

                    // Add penalty from sprite (see pandocs)
                    this.mode3ExtraClocks += clockPenaltyForSprite(windowActive ? 256 - windowX : backgroundX, this.spriteQueue.positionX[i]);
                }
            }
        }

        for (let x = 0; x < 160; x++) {
            // Window is active and starts this pixel? -> prepare for fetching window pixels
            if (!windowActive && windowEnable && this.windowTriggered && windowX === x) {
                windowActive = true;

                bgTileNY = this.windowLine >>> 3;
                bgTileY = this.windowLine & 0x07;
                bgTileX = 0;
                bgTileNX = 0;
                bgTileData = this.backgroundTileData(true, bgTileNX, bgTileNY, bgTileY);
            }

            // Check whether we have a pending sprite and whether it starts on this pixel
            while (hasSprites && nextPendingSprite < this.spriteQueue.length && this.spriteQueue.positionX[nextPendingSprite] === x) {
                // Reset its counter and add it to the range of rendered sprites
                this.spriteCounter[nextPendingSprite] = 0;

                // Add penalty from sprite (see pandocs)
                this.mode3ExtraClocks += clockPenaltyForSprite(windowActive ? 256 - windowX : backgroundX, this.spriteQueue.positionX[nextPendingSprite]);

                nextPendingSprite++;
            }

            // Are we currently rendering any sprites?
            if (firstRenderingSprite < nextPendingSprite) {
                let spriteIndex = 0; // The index of the topmost non-transparent sprite in the list
                let spriteValue = 0; // The color index of the lucky sprite

                for (let index = firstRenderingSprite; index < nextPendingSprite; index++) {
                    const value = ((this.spriteQueue.data[index] & 0x8000) >>> 14) | ((this.spriteQueue.data[index] & 0x80) >>> 7);

                    // This sprite is the first non-transparent sprite? -> we have a winner
                    if (value > 0 && spriteValue === 0) {
                        spriteIndex = index;
                        spriteValue = value;
                    }

                    // Is this the last pixel?
                    if (this.spriteCounter[index] === 7) {
                        // Remove this sprite from the list
                        firstRenderingSprite++;
                    } else {
                        // Increment its counter and shift bitplane data
                        this.spriteCounter[index]++;
                        this.spriteQueue.data[index] <<= 1;
                    }
                }

                // What is the BG vs OBJ priority of this sprite?
                if (this.spriteQueue.flag[spriteIndex] & 0x80) {
                    // Sprite behind background
                    const bgValue = bgEnable ? ((bgTileData & 0x8000) >>> 14) | ((bgTileData & 0x80) >>> 7) : 0;
                    this.backBuffer[pixelAddress++] =
                        bgValue > 0 || spriteValue === 0 ? this.paletteBG[bgValue] : this.spriteQueue.palette[spriteIndex][spriteValue];
                } else {
                    // Sprite in front of background
                    if (spriteValue > 0) {
                        this.backBuffer[pixelAddress++] = this.spriteQueue.palette[spriteIndex][spriteValue];
                    } else {
                        const bgValue = bgEnable ? ((bgTileData & 0x8000) >>> 14) | ((bgTileData & 0x80) >>> 7) : 0;
                        this.backBuffer[pixelAddress++] = this.paletteBG[bgValue];
                    }
                }
            } else {
                const bgValue = bgEnable ? ((bgTileData & 0x8000) >>> 14) | ((bgTileData & 0x80) >>> 7) : 0;
                this.backBuffer[pixelAddress++] = this.paletteBG[bgValue];
            }

            if (bgEnable) {
                if (bgTileX === 7) {
                    bgTileNX++;
                    bgTileX = 0;

                    bgTileData = this.backgroundTileData(windowActive, bgTileNX, bgTileNY, bgTileY);
                } else {
                    bgTileX++;
                    bgTileData <<= 1;
                }
            }
        }
    }

    private backgroundTileData(window: boolean, nx: number, ny: number, y: number): number {
        const tileMapBase = this.reg[reg.lcdc] & (window ? lcdc.windowTileMapArea : lcdc.bgTileMapArea) ? 0x1c00 : 0x1800;
        const index = this.vram[tileMapBase + (ny % 32) * 32 + (nx % 32)];

        if (index >= 0x80) {
            return this.vram16[0x0400 + 8 * (index - 0x80) + y];
        } else {
            const tildeDataBase = this.reg[reg.lcdc] & lcdc.bgTileDataArea ? 0x0000 : 0x800;

            return this.vram16[tildeDataBase + 8 * index + y];
        }
    }

    private updatePalette(target: Uint32Array, palette: number): void {
        for (let i = 0; i < 4; i++) {
            target[i] = PALETTE_CLASSIC[(palette >> (2 * i)) & 0x03];
        }
    }

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

    private paletteBG = PALETTE_CLASSIC.slice();
    private paletteOB0 = PALETTE_CLASSIC.slice();
    private paletteOB1 = PALETTE_CLASSIC.slice();

    private spriteQueue = new SpriteQueueDmg(this.vram, this.oam, this.paletteOB0, this.paletteOB1);
    private spriteCounter = new Uint8Array(10);
}
