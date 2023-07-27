import { Bus, ReadHandler, WriteHandler } from '../bus';
import { PpuBase, clockPenaltyForSprite, reg } from './ppu-base';

import { COLOR_MAPPING } from './color-mapping';
import { Cram } from './cram';
import { Interrupt } from '../interrupt';
import { REVERSE } from './tables';
import { Savestate } from '../savestate';
import { SpriteQueueCgb } from './sprite-queue-cgb';
import { System } from '../system';
import { cgbRegisters } from '../cgb-registers';
import { hex16 } from '../../helper/format';
import { ppuMode } from '../ppu';

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

const enum HdmaMode {
    off = 0,
    hblank = 1,
    general = 2,
}

export class PpuCgb extends PpuBase {
    constructor(protected system: System, protected interrupt: Interrupt) {
        super(system, interrupt);

        this.spriteQueue = new SpriteQueueCgb(this.vramBanks, this.oam, this.ocram);
    }

    save(savestate: Savestate): void {
        const bank = this.bank;
        this.switchBank(0);

        super.save(savestate);
        savestate.write16(bank).writeBuffer(this.vramBanks[1]).write16(this.bgpi).writeBuffer(this.bcram.data).write16(this.obpi).writeBuffer(this.ocram.data);

        this.switchBank(bank);
    }

    load(savestate: Savestate): void {
        this.switchBank(0);

        super.load(savestate);

        const bank = savestate.read16();
        this.vramBanks[1].set(savestate.readBuffer(this.vram.length));
        this.bgpi = savestate.read16();
        this.bcram.load(savestate.readBuffer(0x40));
        this.obpi = savestate.read16();
        this.ocram.load(savestate.readBuffer(0x40));

        this.switchBank(bank);

        this.frontBuffer.fill(COLOR_MAPPING[0x7fff]);
        this.backBuffer.fill(COLOR_MAPPING[0x7fff]);
    }

    install(bus: Bus): void {
        super.install(bus);

        bus.map(cgbRegisters.vramBank, this.vramBankRead, this.vramBankWrite);

        bus.map(cgbRegisters.hdma1, this.invalidRead, this.hdma1Write);
        bus.map(cgbRegisters.hdma2, this.invalidRead, this.hdma2Write);
        bus.map(cgbRegisters.hdma3, this.invalidRead, this.hdma3Write);
        bus.map(cgbRegisters.hdma4, this.invalidRead, this.hdma4Write);
        bus.map(cgbRegisters.hdma5, this.hdma5Read, this.hdma5Write);

        bus.map(cgbRegisters.bgpi, this.bgpiRead, this.bgpiWrite);
        bus.map(cgbRegisters.bgpd, this.bgpdRead, this.bgpdWrite);
        bus.map(cgbRegisters.obpi, this.obpiRead, this.obpiWrite);
        bus.map(cgbRegisters.obpd, this.obpdRead, this.obpdWrite);

        this.bus = bus;
    }

    reset(): void {
        super.reset();

        this.switchBank(0);

        this.frontBuffer.fill(COLOR_MAPPING[0x7fff]);
        this.backBuffer.fill(COLOR_MAPPING[0x7fff]);

        this.bcram.reset();
        this.ocram.reset();

        this.hdmaMode = HdmaMode.off;
        this.hdmaSource = 0x0000;
        this.hdmaDestination = 0x0000;
        this.hdmaRemaining = 0x00;
    }

    protected oamDmaCyclesTotal(): number {
        return this.clock.isDoubleSpeed() ? 320 : 640;
    }

    protected initializeVram(): [Uint8Array, Uint16Array] {
        this.vramBanks = new Array(2);
        this.vram16Banks = new Array(2);

        this.bank = 0;
        for (let bank = 0; bank <= 1; bank++) {
            this.vramBanks[bank] = new Uint8Array(0x2000);
            this.vram16Banks[bank] = new Uint16Array(this.vramBanks[bank].buffer);
        }

        return [this.vramBanks[0], this.vram16Banks[0]];
    }

    protected lcdcWrite: WriteHandler = (_, value) => {
        const oldValue = this.reg[reg.lcdc];
        this.reg[reg.lcdc] = value;

        if (~oldValue & this.reg[reg.lcdc] & lcdc.enable) {
            this.skipFrame = 1;
        }

        if (oldValue & ~this.reg[reg.lcdc] & lcdc.enable) {
            this.hdmaCopyBlock();

            this.backBuffer.fill(COLOR_MAPPING[0x7fff]);
            this.swapBuffers();
            this.startFrame();
        }
    };

    protected renderLine(): void {
        const backgroundX = this.reg[reg.scx];
        const backgroundY = this.reg[reg.scy] + this.scanline;
        const windowEnable = (this.reg[reg.lcdc] & lcdc.windowEnable) !== 0 && this.wx <= 166;
        const windowX = this.wx - 7;
        const windowY = this.wy;

        let bgTileNY = 0;
        let bgTileY = 0;
        let bgTileX = 0;
        let bgTileNX = 0;
        let bgTileData = 0;
        let bgTileAttr = 0;

        // Trigger window if current scanline matches wy
        if (windowY === this.scanline) this.windowTriggered = true;
        // Start with window active?
        let windowActive = windowEnable && this.windowTriggered && windowX <= 0;

        if (windowActive) {
            bgTileNY = this.windowLine >>> 3;
            bgTileY = this.windowLine & 0x07;
            bgTileX = -windowX;
            bgTileData = this.backgroundTileData(true, bgTileNX, bgTileNY, bgTileY);
        } else {
            bgTileNY = backgroundY >>> 3;
            bgTileY = backgroundY & 0x07;
            bgTileX = backgroundX & 0x07;
            bgTileNX = backgroundX >>> 3;
            bgTileData = this.backgroundTileData(false, bgTileNX, bgTileNY, bgTileY);
        }

        bgTileAttr = bgTileData >>> 16;
        bgTileData <<= bgTileX;

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
                bgTileAttr = bgTileData >>> 16;
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
                let selectedOamIndex = 0xff;

                for (let index = firstRenderingSprite; index < nextPendingSprite; index++) {
                    const value = ((this.spriteQueue.data[index] & 0x8000) >>> 14) | ((this.spriteQueue.data[index] & 0x80) >>> 7);
                    const oamIndex = this.spriteQueue.oamIndex[index];

                    // This sprite is the first non-transparent sprite? -> we have a winner
                    if (value > 0 && oamIndex < selectedOamIndex) {
                        spriteIndex = index;
                        spriteValue = value;
                        selectedOamIndex = oamIndex;
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
                if ((this.reg[reg.lcdc] & lcdc.bgEnable) === 0x00 || ((this.spriteQueue.flag[spriteIndex] & 0x80) === 0x00 && (bgTileAttr & 0x80) === 0x00)) {
                    // Sprite in front of background
                    if (spriteValue > 0) {
                        this.backBuffer[pixelAddress++] = this.spriteQueue.palette[spriteIndex][spriteValue];
                    } else {
                        const bgValue = ((bgTileData & 0x8000) >>> 14) | ((bgTileData & 0x80) >>> 7);
                        this.backBuffer[pixelAddress++] = this.bcram.getPalette(bgTileAttr & 0x07)[bgValue];
                    }
                } else {
                    // Sprite behind background
                    const bgValue = ((bgTileData & 0x8000) >>> 14) | ((bgTileData & 0x80) >>> 7);
                    this.backBuffer[pixelAddress++] =
                        bgValue > 0 || spriteValue === 0
                            ? this.bcram.getPalette(bgTileAttr & 0x07)[bgValue]
                            : this.spriteQueue.palette[spriteIndex][spriteValue];
                }
            } else {
                const bgValue = ((bgTileData & 0x8000) >>> 14) | ((bgTileData & 0x80) >>> 7);
                this.backBuffer[pixelAddress++] = this.bcram.getPalette(bgTileAttr & 0x07)[bgValue];
            }

            if (bgTileX === 7) {
                bgTileNX++;
                bgTileX = 0;

                bgTileData = this.backgroundTileData(windowActive, bgTileNX, bgTileNY, bgTileY);
                bgTileAttr = bgTileData >>> 16;
            } else {
                bgTileX++;
                bgTileData <<= 1;
            }
        }

        // Increment window line if window is enabled and has been triggered for this frame
        if (windowEnable && this.windowTriggered) this.windowLine++;
    }

    protected onHblankStart() {
        this.hdmaCopyBlock();
    }

    private switchBank(bank: number): void {
        this.bank = bank;

        this.vram = this.vramBanks[bank];
        this.vram16 = this.vram16Banks[bank];
    }

    private vramBankRead: ReadHandler = (_) => 0xfe | this.bank;
    private vramBankWrite: WriteHandler = (_, value) => this.switchBank(value & 0x01);

    private backgroundTileData(window: boolean, nx: number, ny: number, y: number): number {
        const tileMapBase = this.reg[reg.lcdc] & (window ? lcdc.windowTileMapArea : lcdc.bgTileMapArea) ? 0x1c00 : 0x1800;
        const index = this.vramBanks[0][tileMapBase + (ny % 32) * 32 + (nx % 32)];
        const attr = this.vramBanks[1][tileMapBase + (ny % 32) * 32 + (nx % 32)];
        const bank = this.vram16Banks[(attr >>> 3) & 0x01];

        if (attr & 0x40) y = 7 - y;
        let data: number;

        if (index >= 0x80) {
            data = bank[0x0400 + 8 * (index - 0x80) + y];
        } else {
            const tileDataBase = this.reg[reg.lcdc] & lcdc.bgTileDataArea ? 0x0000 : 0x800;
            data = bank[tileDataBase + 8 * index + y];
        }

        if (attr & 0x20) data = (REVERSE[data >>> 8] << 8) | REVERSE[data & 0xff];

        return data | (attr << 16);
    }

    private bgpiRead: ReadHandler = (_) => this.bgpi;
    private bgpiWrite: WriteHandler = (_, value) => {
        this.bgpi = value | 0x40;
    };

    private bgpdRead: ReadHandler = (_) => ((this.reg[reg.lcdc] & lcdc.enable) === 0 || this.mode !== ppuMode.draw ? this.bcram.read(this.bgpi & 0x3f) : 0xff);
    private bgpdWrite: WriteHandler = (_, value) => {
        const address = this.bgpi & 0x3f;

        if ((this.reg[reg.lcdc] & lcdc.enable) === 0 || this.mode !== ppuMode.draw) this.bcram.write(address, value);

        if (this.bgpi & 0x80) {
            this.bgpi = 0x80 | ((address + 1) & 0x3f);
        }
    };

    private obpiRead: ReadHandler = (_) => this.obpi;
    private obpiWrite: WriteHandler = (_, value) => {
        this.obpi = value | 0x40;
    };

    private obpdRead: ReadHandler = (_) => ((this.reg[reg.lcdc] & lcdc.enable) === 0 || this.mode !== ppuMode.draw ? this.ocram.read(this.obpi & 0x3f) : 0xff);
    private obpdWrite: WriteHandler = (_, value) => {
        const address = this.obpi & 0x3f;

        if ((this.reg[reg.lcdc] & lcdc.enable) === 0 || this.mode !== ppuMode.draw) this.ocram.write(address, value);

        if (this.obpi & 0x80) {
            this.obpi = 0x80 | ((address + 1) & 0x3f);
        }
    };

    private invalidRead: ReadHandler = (address) => {
        this.system.log(`Invalid read from HDMA register ${hex16(address)}`);

        return 0x00;
    };

    private hdma1Write: WriteHandler = (_, value) => {
        this.hdmaSource = (this.hdmaSource & 0xff) | (value << 8);
    };

    private hdma2Write: WriteHandler = (_, value) => {
        this.hdmaSource = (this.hdmaSource & 0xff00) | (value & 0xf0);
    };

    private hdma3Write: WriteHandler = (_, value) => {
        this.hdmaDestination = (this.hdmaDestination & 0xff) | (value << 8);
        this.hdmaDestination &= 0x1ff0;
    };

    private hdma4Write: WriteHandler = (_, value) => {
        this.hdmaDestination = (this.hdmaDestination & 0xff00) | (value & 0xf0);
    };

    private hdma5Read: ReadHandler = () => {
        return (this.hdmaMode === HdmaMode.off ? 0x80 : 0x00) | this.hdmaRemaining;
    };

    private hdma5Write: WriteHandler = (_, value) => {
        if (this.hdmaMode === HdmaMode.hblank && (value & 0x80) === 0) {
            this.hdmaMode = HdmaMode.off;
            return;
        }

        this.hdmaRemaining = value & 0x7f;

        if (value & 0x80) {
            this.hdmaMode = HdmaMode.hblank;

            if ((this.reg[reg.lcdc] & lcdc.enable) === 0) {
                this.hdmaCopyBlock();
            }
        } else {
            this.hdmaMode = HdmaMode.general;

            this.clock.pauseCpu(1);
            while ((this.hdmaMode as HdmaMode) !== HdmaMode.off) this.hdmaCopyBlock();
        }
    };

    private hdmaCopyBlock() {
        if (this.hdmaMode === HdmaMode.off || this.cpu.state.halt || this.clock.isSpeedSwitchInProgress()) return;

        for (let index = 0; index < 0x10; index++) {
            this.vram[this.hdmaDestination + index] = this.bus.read(this.hdmaSource + index);
        }

        this.hdmaSource = (this.hdmaSource + 0x10) & 0xfff0;
        this.hdmaDestination = (this.hdmaDestination + 0x10) & 0x1ff0;
        this.hdmaRemaining = (this.hdmaRemaining - 1) & 0x7f;

        if (this.hdmaRemaining === 0x7f || this.hdmaDestination === 0x0000) this.hdmaMode = HdmaMode.off;

        this.clock.pauseCpu(this.hdmaMode === HdmaMode.hblank ? 9 : 8);
    }

    private spriteQueue: SpriteQueueCgb;
    private spriteCounter = new Uint8Array(10);

    private vramBanks!: Array<Uint8Array>;
    private vram16Banks!: Array<Uint16Array>;

    private bank = 0;

    private bgpi = 0;
    private bcram = new Cram(0xff);

    private obpi = 0;
    private ocram = new Cram(0x00);

    private hdmaMode: HdmaMode = HdmaMode.off;
    private hdmaRemaining = 0;
    private hdmaSource = 0x0000;
    private hdmaDestination = 0x0000;
}
