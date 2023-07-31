import { Bus, ReadHandler, WriteHandler } from './bus';

import { Mode } from './mode';
import { Savestate } from './savestate';
import { cgbRegisters } from './cgb-registers';

const WRAM_BANK_SIZE = 0x1000;
const SAVESTATE_VERSION = 0x01;

export class Ram {
    constructor(private mode: Mode) {
        this.wram = new Uint8Array(this.wramSize());

        if (this.mode === Mode.cgb) {
            this.svbk = 1;
        }

        this.initializeWramBanks();
        this.updateBanks();
    }

    install(bus: Bus): void {
        for (let i = 0xc000; i < 0xd000; i++) {
            bus.map(i, this.wramBank0Read, this.wramBank0Write);
        }

        for (let i = 0xd000; i < 0xe000; i++) {
            bus.map(i, this.wramBank1Read, this.wramBank1Write);
        }

        for (let i = 0xe000; i < 0xf000; i++) {
            bus.map(i, this.wramBank0Read, this.wramBank0Write);
        }

        for (let i = 0xf000; i < 0xfe00; i++) {
            bus.map(i, this.wramBank1Read, this.wramBank1Write);
        }

        for (let i = 0xff80; i < 0xffff; i++) {
            bus.map(i, this.hiramRead, this.hiramWrite);
        }

        if (this.mode === Mode.cgb) {
            bus.map(cgbRegisters.svbk, this.svbkRead, this.svbkWrite);

            for (let i = cgbRegisters.undocumented_FF72; i <= cgbRegisters.undocumented_FF75; i++) {
                bus.map(i, this.cgbUndocumentedScratchRead, this.cgbUndocumentedScratchWrite);
            }
        }
    }

    reset(): void {
        this.svbk = 1;

        this.cgbUndocumentedScratch.fill(0x00);
        this.wram.fill(0);
        this.hiram.fill(0);

        this.updateBanks();
    }

    save(savestate: Savestate): void {
        savestate.startChunk(SAVESTATE_VERSION).writeBuffer(this.wram).writeBuffer(this.hiram).write16(this.svbk).writeBuffer(this.cgbUndocumentedScratch);
    }

    load(savestate: Savestate): void {
        const version = savestate.validateChunk(SAVESTATE_VERSION);

        this.wram.set(savestate.readBuffer(this.wram.length));
        this.hiram.set(savestate.readBuffer(this.hiram.length));

        this.svbk = 1;
        this.cgbUndocumentedScratch.fill(0x00);
        if (version > 0x00) {
            this.svbk = version > 0 ? savestate.read16() : 1;
            this.cgbUndocumentedScratch.set(savestate.readBuffer(this.cgbUndocumentedScratch.length));
        }

        this.updateBanks();
    }

    private initializeWramBanks() {
        const wramBankCount = (this.wramSize() / WRAM_BANK_SIZE) | 0;
        this.wramBanks = new Array(wramBankCount);

        for (let i = 0; i < wramBankCount; i++) this.wramBanks[i] = this.wram.subarray(i * WRAM_BANK_SIZE, (i + 1) * WRAM_BANK_SIZE);

        this.wramBank0 = this.wramBanks[0];
        this.updateBanks();
    }

    private updateBanks(): void {
        const bankIndex = this.svbk & 0x07;

        this.wramBank1 = this.wramBanks[bankIndex === 0 ? 1 : bankIndex];
    }

    private wramSize(): number {
        return (this.mode === Mode.dmg ? 8 : 32) * 1024;
    }

    private svbkRead: ReadHandler = () => this.svbk | 0xf8;
    private svbkWrite: WriteHandler = (_, value) => {
        this.svbk = value;
        this.updateBanks();
    };

    private wramBank0Read: ReadHandler = (address) => this.wramBank0[address & 0x0fff];
    private wramBank0Write: WriteHandler = (address, value) => (this.wramBank0[address & 0x0fff] = value);

    private wramBank1Read: ReadHandler = (address) => this.wramBank1[address & 0x0fff];
    private wramBank1Write: WriteHandler = (address, value) => (this.wramBank1[address & 0x0fff] = value);

    private hiramRead: ReadHandler = (address) => this.hiram[address & 0x7f];
    private hiramWrite: WriteHandler = (address, value) => (this.hiram[address & 0x7f] = value);

    private cgbUndocumentedScratchRead: ReadHandler = (address) =>
        address === cgbRegisters.undocumented_FF75
            ? this.cgbUndocumentedScratch[address - cgbRegisters.undocumented_FF72]
            : this.cgbUndocumentedScratch[address - cgbRegisters.undocumented_FF72] | 0x8f;

    private cgbUndocumentedScratchWrite: WriteHandler = (address, value) => (this.cgbUndocumentedScratch[address - cgbRegisters.undocumented_FF72] = value);

    private wramBanks!: Array<Uint8Array>;

    private wramBank0!: Uint8Array;
    private wramBank1!: Uint8Array;

    private svbk = 1;

    private wram: Uint8Array;
    private hiram = new Uint8Array(0x7f);

    private cgbUndocumentedScratch = new Uint8Array(0x05);
}
