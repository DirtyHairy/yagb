import { Bus, ReadHandler, WriteHandler } from './bus';

import { Mode } from "./mode";
import { Savestate } from './savestate';

export const enum reg {
    svbk = 0xff70,
}

export const WRAMBankSize = 0x1000;

interface Mapping {
    wramBank0: Uint8Array;
    wramBank1: Uint8Array;

    wramBank0Index: number;
    wramBank1Index: number;
}

const SAVESTATE_VERSION = 0x01;

export class Ram {
    constructor(private mode: Mode) {
        this.configurations = new Array(0x8);
        this.wram = new Uint8Array(this.wramSize());

        if (this.mode === Mode.cgb) {
            this.svbk = 1
        }

        this.initializeConfigurations();
        this.updateBanks()
    }

    install(bus: Bus): void {
        for (let i = 0xc000; i < 0xd000; i++) {
            bus.map(i, this.wramBank0Read, this.wramBank0Write);
        }

        for (let i = 0xd000; i < 0xe000; i++) {
            bus.map(i, this.wramBank1Read, this.wramBank1Write);
        }

        for (let i = 0xe000; i < 0xfe00; i++) {
            bus.map(i, this.echoRamRead, this.echoRamWrite);
        }

        if (this.mode === Mode.cgb) {
            bus.map(reg.svbk, this.svbkRead, this.svbkWrite);
        }

        for (let i = 0xff80; i < 0xffff; i++) {
            bus.map(i, this.hiramRead, this.hiramWrite);
        }

    }

    reset(): void {
        this.svbk = 0;
        this.wram.fill(0);
        this.hiram.fill(0);
    }

    save(savestate: Savestate): void {
        savestate
          .startChunk(SAVESTATE_VERSION)
          .writeBuffer(this.wram)
          .writeBuffer(this.hiram)
          .write16(this.svbk);
    }

    load(savestate: Savestate): void {
        savestate.validateChunk(SAVESTATE_VERSION);

        this.wram.set(savestate.readBuffer(this.wram.length));
        this.hiram.set(savestate.readBuffer(this.hiram.length));
        this.svbk = savestate.read16();

        this.updateBanks()
    }

    private initializeConfigurations() {
        const wramBanks = Math.max((this.wramSize() / WRAMBankSize) | 0, 1);

        const ramSlices = new Array(wramBanks);
        for (let i = 0; i < wramBanks; i++) ramSlices[i] = this.wram.subarray(i * WRAMBankSize, (i + 1) * WRAMBankSize);

        for (let i = 0x01; i < 0x08; i++) {
            const wramBank0Index = 0;
            const wramBank1Index = i;

            this.configurations[i] = {
                wramBank0: ramSlices[wramBank0Index],
                wramBank1: ramSlices[wramBank1Index],
                wramBank0Index: wramBank0Index,
                wramBank1Index: wramBank1Index,
            };
        }
    }

    private updateBanks(): void {
        const configuration = this.configurations[this.svbk];

        this.wramBank0 = configuration.wramBank0;
        this.wramBank1 = configuration.wramBank1;

        this.wramBank0Index = configuration.wramBank0Index;
        this.wramBank1Index = configuration.wramBank1Index;
    }

    private wramSize(): number {
        return (this.mode === Mode.dmg ? 8 : 32) * 1024;
    }

    private svbkRead: ReadHandler = () => this.svbk;
    private svbkWrite: WriteHandler = (_, value) => {
        value = value & 0x07;

        if (value === 0x00) {
            value = 0x01;
        }

        this.svbk = value;

        this.updateBanks();
    };


    private wramBank0Read: ReadHandler = (address) => this.wramBank0[address & 0x1fff];
    private wramBank0Write: WriteHandler = (address, value) => (this.wramBank0[address & 0x1fff] = value);

    private wramBank1Read: ReadHandler = (address) => this.wramBank1[address & 0x1fff];
    private wramBank1Write: WriteHandler = (address, value) => (this.wramBank1[address & 0x1fff] = value);

    private echoRamRead: ReadHandler = (address) => {
        address = address & 0x1fff

        if(0x1000 < address) {
            address = address & 0x0fff
            return this.wramBank1[address];
        }

        return this.wramBank0[address];
    }

    private echoRamWrite: WriteHandler = (address, value) => {
        address = address & 0x1fff

        if(0x1000 < address) {
            address = address & 0x0fff
            this.wramBank1[address] = value;

            return
        }

        this.wramBank0[address] = value;
    }

    private hiramRead: ReadHandler = (address) => this.hiram[address & 0x7f];
    private hiramWrite: WriteHandler = (address, value) => (this.hiram[address & 0x7f] = value);

    private configurations: Array<Mapping>;

    private wramBank0!: Uint8Array;
    private wramBank1!: Uint8Array;

    private wramBank0Index = 0;
    private wramBank1Index = 0;

    private svbk = 1;

    private wram: Uint8Array;
    private hiram = new Uint8Array(0x7f);

}
