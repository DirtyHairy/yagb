import { Bus, ReadHandler, WriteHandler } from './bus';
import { Interrupt, irq } from './interrupt';

import { Savestate } from './savestate';

const enum reg {
    base = 0xff01,
    sb = 0x00,
    sc = 0x01,
}

const SAVESTATE_VERSION = 0x00;

export class Serial {
    constructor(private interrupt: Interrupt) {}

    save(savestate: Savestate): void {
        savestate.startChunk(SAVESTATE_VERSION).writeBuffer(this.reg).write16(this.nextBit).write16(this.transferClock).writeBool(this.transferInProgress);
    }

    load(savestate: Savestate): void {
        savestate.validateChunk(SAVESTATE_VERSION);

        this.reg.set(savestate.readBuffer(this.reg.length));
        this.nextBit = savestate.read16();
        this.transferClock = savestate.read16();
        this.transferInProgress = savestate.readBool();
    }

    install(bus: Bus): void {
        bus.map(reg.base + reg.sb, this.read, this.sbWrite);
        bus.map(reg.base + reg.sc, this.read, this.scWrite);
    }

    reset(): void {
        this.reg[reg.sb] = 0x00;
        this.reg[reg.sc] = 0x7e;

        this.transferInProgress = false;
        this.transferClock = 0;
        this.nextBit = 0;
    }

    cycle(cpuClocks: number) {
        if (!this.transferInProgress) return;

        this.transferClock += cpuClocks;

        // 1MHz / 128 = 8kHZ
        let bits = (this.transferClock / 128) | 0;
        this.transferClock %= 128;

        while (bits > 0 && this.nextBit < 8) {
            this.reg[reg.sb] <<= 1;
            this.reg[reg.sb] |= 0x01;

            bits--;
            this.nextBit++;
        }

        if (this.nextBit > 7) {
            this.interrupt.raise(irq.serial);
            this.transferInProgress = false;
            this.reg[reg.sc] &= 0x7f;
        }
    }

    private read: ReadHandler = (address) => this.reg[address - reg.base];

    private sbWrite: WriteHandler = (_, value) => !this.transferInProgress && (this.reg[reg.sb] = value);
    private scWrite: WriteHandler = (_, value) => {
        if (this.transferInProgress) return;
        this.reg[reg.sc] = value | 0x7e;

        if ((this.reg[reg.sc] & 0x81) === 0x81) {
            this.transferInProgress = true;
            this.transferClock = 0;
            this.nextBit = 0;
        }
    };

    private reg = new Uint8Array(2);

    private transferInProgress = false;
    private nextBit = 0;
    private transferClock = 0;
}
