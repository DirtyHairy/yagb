import { Bus, ReadHandler, WriteHandler } from './bus';
import { Interrupt, irq } from './interrupt';

import { Savestate } from './savestate';

export const enum key {
    a,
    b,
    start,
    select,
    up,
    down,
    left,
    right,
    invalid,
}

const SAVESTATE_VERSION = 0x01;

export class Joypad {
    constructor(private interrupt: Interrupt) {}

    save(savestate: Savestate): void {
        savestate.startChunk(SAVESTATE_VERSION).write16(this.joypad);
    }

    load(savestate: Savestate): void {
        if (savestate.bytesRemaining() === 0) {
            this.joypad = 0x00;
            return;
        }

        savestate.validateChunk(SAVESTATE_VERSION);
        this.joypad = savestate.read16();
    }

    install(bus: Bus): void {
        bus.map(0xff00, this.joypadRead, this.joypadWrite);
    }

    reset(): void {
        this.joypad = 0x00;
    }

    down(k: key): void {
        if (this.keys[k]) return;

        const before = this.joypadRead(0xff00) & 0x0f;
        this.keys[k] = 1;
        const after = this.joypadRead(0xff00) & 0x0f;

        if (before & ~after) this.interrupt.raise(irq.joypad);
    }

    up(k: key): void {
        if (!this.keys[k]) return;

        this.keys[k] = 0;
    }

    clearKeys(): void {
        const before = this.joypadRead(0xff00) & 0x0f;
        this.keys.fill(0);
        const after = this.joypadRead(0xff00) & 0x0f;

        if (before & ~after) this.interrupt.raise(irq.joypad);
    }

    private joypadRead: ReadHandler = () => {
        let result = this.joypad | 0xcf;

        if ((this.joypad & 0x20) === 0) {
            if (this.keys[key.start]) result &= ~0x08;
            if (this.keys[key.select]) result &= ~0x04;
            if (this.keys[key.b]) result &= ~0x02;
            if (this.keys[key.a]) result &= ~0x01;
        }

        if ((this.joypad & 0x10) === 0) {
            if (this.keys[key.down]) result &= ~0x08;
            if (this.keys[key.up]) result &= ~0x04;
            if (this.keys[key.left]) result &= ~0x02;
            if (this.keys[key.right]) result &= ~0x01;
        }

        return result;
    };

    private joypadWrite: WriteHandler = (address, value) => {
        const before = this.joypadRead(0xff00) & 0x0f;
        this.joypad = value & 0xff;
        const after = this.joypadRead(0xff00) & 0x0f;

        if (before && ~after) this.interrupt.raise(irq.joypad);
    };

    private joypad = 0x00;
    private keys = new Uint8Array(8);
}
