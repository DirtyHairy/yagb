import { Bus, ReadHandler, WriteHandler } from './bus';
import { Interrupt, irq } from './interrupt';

import { Savestate } from './savestate';
import { hex8 } from '../helper/format';

export const enum reg {
    base = 0xff04,
    div = 0x00,
    tima = 0x01,
    tma = 0x02,
    tac = 0x03,
}

const SAVESTATE_VERSION = 0x00;

function divider(tac: number): number {
    // We are clocked with the 1MHz cpu clock, so there is a factor of 4 relative
    // to pandoc
    switch (tac & 0x03) {
        case 0x00:
            return 256;

        case 0x01:
            return 4;

        case 0x02:
            return 16;

        case 0x03:
            return 64;
    }

    return 0;
}

export class Timer {
    constructor(private interrupt: Interrupt) {}

    save(savestate: Savestate): void {
        const flag = (this.irqPending ? 0x01 : 0x00) | (this.overflowCycle ? 0x02 : 0x00);

        savestate.startChunk(SAVESTATE_VERSION).writeBuffer(this.reg).write16(this.divider).write16(this.accDiv).write16(this.accTima).write16(flag);
    }

    load(savestate: Savestate): void {
        savestate.validateChunk(SAVESTATE_VERSION);

        this.reg.set(savestate.readBuffer(this.reg.length));
        this.divider = savestate.read16();
        this.accDiv = savestate.read16();
        this.accTima = savestate.read16();

        const flag = savestate.read16();
        this.irqPending = (flag & 0x01) !== 0;
        this.overflowCycle = (flag & 0x02) !== 0;
    }

    install(bus: Bus): void {
        for (let i = reg.base; i <= reg.base + 0x03; i++) {
            bus.map(i, this.regRead, this.regWrite);
        }

        bus.map(reg.base + reg.tima, this.timeRead, this.regWrite);
        bus.map(reg.base + reg.div, this.regRead, this.divWrite);
        bus.map(reg.base + reg.tac, this.regRead, this.tacWrite);
    }

    reset(): void {
        this.reg.fill(0);
        this.reg[reg.div] = 0xac;
        this.reg[reg.tac] = 0xf8;

        this.divider = divider(this.reg[reg.tac]);
        this.accDiv = this.accTima = 0;
        this.irqPending = false;
        this.overflowCycle = false;
    }

    cycle(cpuClocks: number): void {
        if (cpuClocks === 0) return;

        if (this.irqPending) this.interrupt.raise(irq.timer);
        this.irqPending = false;
        this.overflowCycle = false;

        this.accDiv += cpuClocks;
        // 1MHz / 64 = 16kHz
        this.reg[reg.div] = (this.reg[reg.div] + ((this.accDiv / 64) | 0)) & 0xff;
        this.accDiv %= 64;

        let tima = this.reg[reg.tima];
        const tma = this.reg[reg.tma];

        this.accTima += cpuClocks;
        if (this.reg[reg.tac] & 0x04) tima += (this.accTima / this.divider) | 0;
        this.accTima %= this.divider;

        if (tima > 0xff) {
            if (this.accTima === 0 && tima === 0x100) {
                // Pandoc / timer obscure behaviour: interrupt takes one cycle to fire
                this.irqPending = true;
            } else {
                this.interrupt.raise(irq.timer);
            }

            tima = tma + ((tima - 0x100) % (0x100 - tma));

            if (this.accTima === 0 && tima === tma) this.overflowCycle = true;
        }

        this.reg[reg.tima] = tima;
    }

    printState(): string {
        return `div=${hex8(this.reg[reg.div])} tima=${hex8(this.reg[reg.tima])} tma=${hex8(this.reg[reg.tma])} tac=${hex8(this.reg[reg.tac])}`;
    }

    private read: ReadHandler = (address) => {
        // Pandoc / timer obscure behaviour: tima reads 0 for one cycle after overflow.
        if (this.overflowCycle) return 0x00;

        return this.reg[address - 0xff04];
    };

    private regRead: ReadHandler = (address) => this.reg[address - reg.base];
    private regWrite: WriteHandler = (address, value) => (this.reg[address - reg.base] = value);

    private timeRead: ReadHandler = () => (this.overflowCycle ? 0x00 : this.reg[reg.tima]);

    private tacWrite: WriteHandler = (_, value) => {
        this.reg[reg.tac] = value;
        this.divider = divider(this.reg[reg.tac]);
    };

    private divWrite: WriteHandler = () => {
        this.reg[reg.div] = 0;
        this.accDiv = 0;
        this.accTima = 0;
    };

    private reg = new Uint8Array(0x04);
    private divider = 1024;
    private accDiv = 0;
    private accTima = 0;
    private irqPending = false;
    private overflowCycle = false;
}
