import { Bus, ReadHandler, WriteHandler } from './bus';

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

export class Interrupt {
    install(bus: Bus): void {
        bus.map(reg.if, this.readIF, this.writeIF);
        bus.map(reg.ie, this.readIE, this.writeIE);
    }

    reset(): void {
        this.ie = 0;
        this.if = 0;
    }

    raise(irq: irq): void {
        this.if |= irq;
    }

    clear(irq: irq): void {
        this.if &= ~irq;
    }

    getNext(): irq {
        const flags = this.if & this.ie;

        if (!(flags & 0x1f)) return 0;

        for (let i = 0x01; i <= irq.joypad; i <<= 1) {
            if (flags & i) return i;
        }

        return 0;
    }

    printState(): string {
        return `ie=${hex8(this.ie)} if=${hex8(this.if)}`;
    }

    private ie = 0;
    private if = 0;

    private readIE: ReadHandler = () => this.ie;
    private writeIE: WriteHandler = (_, value) => (this.ie = value & 0xff);

    private readIF: ReadHandler = () => this.if;
    private writeIF: WriteHandler = (_, value) => (this.if = value & 0xff);
}
