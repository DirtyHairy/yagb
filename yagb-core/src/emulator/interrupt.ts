import { Bus, ReadHandler, WriteHandler } from './bus';

import { Savestate } from './savestate';
import { hex8 } from '../helper/format';

const enum reg {
    if = 0xff0f,
    ie = 0xffff,
}

export const enum irq {
    vblank = 0x01,
    stat = 0x02,
    timer = 0x04,
    serial = 0x08,
    joypad = 0x10,
}

const SAVESTATE_VERSION = 0x00;

export class Interrupt {
    save(savestate: Savestate): void {
        savestate.startChunk(SAVESTATE_VERSION).write16(this.ie).write16(this.if);
    }

    load(savestate: Savestate): void {
        savestate.validateChunk(SAVESTATE_VERSION);

        this.ie = savestate.read16();
        this.if = savestate.read16();
    }

    install(bus: Bus): void {
        bus.map(reg.if, this.readIF, this.writeIF);
        bus.map(reg.ie, this.readIE, this.writeIE);
    }

    reset(): void {
        this.ie = 0x00;
        this.if = 0xe1;
    }

    raise(irq: irq): void {
        this.if |= irq;
    }

    clear(irq: irq): void {
        this.if &= ~irq;
    }

    getNext(): irq {
        const flags = this.if & this.ie;

        if (!(flags & 0x1f)) return 0 as irq;

        for (let i = 0x01; i <= irq.joypad; i <<= 1) {
            if (flags & i) return i;
        }

        return 0 as irq;
    }

    printState(): string {
        return `ie=${hex8(this.ie)} if=${hex8(this.if)}`;
    }

    isPending(): boolean {
        return (this.if & this.ie & 0x1f) !== 0;
    }

    private ie = 0;
    private if = 0;

    private readIE: ReadHandler = () => this.ie;
    private writeIE: WriteHandler = (_, value) => (this.ie = value & 0xff);

    private readIF: ReadHandler = () => this.if;
    private writeIF: WriteHandler = (_, value) => (this.if = (value & 0xff) | 0xe0);
}
