import { Bus, ReadHandler, WriteHandler } from './bus';

import { Savestate } from './savestate';

const SAVESTATE_VERSION = 0x00;

export class Ram {
    install(bus: Bus): void {
        for (let i = 0xc000; i < 0xfe00; i++) {
            bus.map(i, this.wramRead, this.wramWrite);
        }

        for (let i = 0xff80; i < 0xffff; i++) {
            bus.map(i, this.hiramRead, this.hiramWrite);
        }
    }

    reset(): void {
        this.wram.fill(0);
        this.hiram.fill(0);
    }

    save(savestate: Savestate): void {
        savestate.startChunk(SAVESTATE_VERSION).writeBuffer(this.wram).writeBuffer(this.hiram);
    }

    load(savestate: Savestate): void {
        savestate.validateChunk(SAVESTATE_VERSION);

        this.wram.set(savestate.readBuffer(this.wram.length));
        this.hiram.set(savestate.readBuffer(this.hiram.length));
    }

    private wramRead: ReadHandler = (address) => this.wram[address & 0x1fff];
    private wramWrite: WriteHandler = (address, value) => (this.wram[address & 0x1fff] = value);

    private hiramRead: ReadHandler = (address) => this.hiram[address & 0x7f];
    private hiramWrite: WriteHandler = (address, value) => (this.hiram[address & 0x7f] = value);

    private wram = new Uint8Array(0x2000);
    private hiram = new Uint8Array(0x7f);
}
