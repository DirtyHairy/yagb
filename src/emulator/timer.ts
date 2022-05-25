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

const SAVESTATE_VERSION = 0x01;

function shift(tac: number): number {
    switch (tac & 0x03) {
        case 0x00:
            return 8;

        case 0x03:
            return 6;

        case 0x02:
            return 4;

        case 0x01:
            return 2;
    }

    return 0;
}

function mask(tac: number): number {
    switch (tac & 0x03) {
        case 0x00:
            return 0xff;

        case 0x03:
            return 0x3f;

        case 0x02:
            return 0x0f;

        case 0x01:
            return 0x03;
    }

    return 0;
}

export class Timer {
    constructor(private interrupt: Interrupt) {
        this.updateDivider();
    }

    save(savestate: Savestate): void {
        const flag = (this.irqPending ? 0x01 : 0x00) | (this.overflowCycle ? 0x02 : 0x00) | (this.latchCycle ? 0x04 : 0x00);

        savestate.startChunk(SAVESTATE_VERSION).writeBuffer(this.reg).write16(this.accDiv).write16(this.accTima).write16(flag);
    }

    load(savestate: Savestate): void {
        const version = savestate.validateChunk(SAVESTATE_VERSION);

        this.reg.set(savestate.readBuffer(this.reg.length));

        // We used to store the divider
        if (version === 0x00) savestate.read16();

        this.accDiv = savestate.read16();
        this.accTima = savestate.read16();

        const flag = savestate.read16();
        this.irqPending = (flag & 0x01) !== 0;
        this.overflowCycle = (flag & 0x02) !== 0;
        this.latchCycle = (flag & 0x04) !== 0;
    }

    install(bus: Bus): void {
        for (let i = reg.base; i <= reg.base + 0x03; i++) {
            bus.map(i, this.regRead, this.regWrite);
        }

        bus.map(reg.base + reg.tima, this.timaRead, this.timaWrite);
        bus.map(reg.base + reg.tma, this.regRead, this.tmaWrite);
        bus.map(reg.base + reg.div, this.regRead, this.divWrite);
        bus.map(reg.base + reg.tac, this.regRead, this.tacWrite);
    }

    reset(): void {
        this.reg.fill(0);
        this.reg[reg.div] = 0xac;
        this.reg[reg.tac] = 0xf8;

        this.updateDivider();
        this.accDiv = this.accTima = 0;
        this.irqPending = false;
        this.overflowCycle = false;
        this.latchCycle = false;
    }

    cycle(cpuClocks: number): void {
        if (cpuClocks === 0) return;

        if (this.irqPending) this.interrupt.raise(irq.timer);

        this.irqPending = false;
        this.latchCycle = cpuClocks === 1 && this.overflowCycle;
        this.overflowCycle = false;

        this.accDiv += cpuClocks;
        // 1MHz / 64 = 16kHz
        this.reg[reg.div] = (this.reg[reg.div] + ((this.accDiv / 64) | 0)) & 0xff;
        this.accDiv %= 64;

        let tima = this.reg[reg.tima];
        const tma = this.reg[reg.tma];

        const accumulatedIncrementsOld = this.accTima >>> this.accShift;
        this.accTima += cpuClocks;

        if (this.reg[reg.tac] & 0x04) tima += (this.accTima >>> this.accShift) - accumulatedIncrementsOld;
        this.accTima &= 0xff;

        if (tima > 0xff) {
            const accMasked = this.accTima & this.accMask;

            if (accMasked === 0 && tima === 0x100) {
                // Pandoc / timer obscure behaviour: interrupt takes one cycle to fire
                this.irqPending = true;
            } else {
                this.interrupt.raise(irq.timer);
            }

            tima = tma + ((tima - 0x100) % (0x100 - tma));

            if (accMasked === 0 && tima === tma) this.overflowCycle = true;
            if (accMasked === 1 && tima === tma) this.latchCycle = true;
        }

        this.reg[reg.tima] = tima;
    }

    printState(): string {
        return `div=${hex8(this.reg[reg.div])} tima=${hex8(this.reg[reg.tima])} tma=${hex8(this.reg[reg.tma])} tac=${hex8(this.reg[reg.tac])}`;
    }

    private multiplexerOut(): number {
        return (this.reg[reg.tac] >>> 2) & (this.accTima >>> (this.accShift - 1)) & 0x01;
    }

    private incrementOnce(): void {
        if (++this.reg[reg.tima] > 0xff) {
            this.reg[reg.tima] = this.reg[reg.tma];
            this.irqPending = true;
            this.overflowCycle = true;
        }
    }

    private updateDivider(): void {
        this.accShift = shift(this.reg[reg.tac]);
        this.accMask = mask(this.reg[reg.tac]);
    }

    private regRead: ReadHandler = (address) => this.reg[address - reg.base];
    private regWrite: WriteHandler = (address, value) => (this.reg[address - reg.base] = value);

    private timaRead: ReadHandler = () => (this.overflowCycle ? 0x00 : this.reg[reg.tima]);
    private timaWrite: WriteHandler = (_, value) => {
        if (this.overflowCycle) {
            this.irqPending = false;
        }

        if (!this.latchCycle) {
            this.reg[reg.tima] = value;
        }
    };

    private tmaWrite: WriteHandler = (_, value) => {
        const oldValue = this.reg[reg.tma];
        this.reg[reg.tma] = value;

        if (this.overflowCycle) this.reg[reg.tima] = value;
        if (this.latchCycle) this.reg[reg.tima] = value;
    };

    private tacWrite: WriteHandler = (_, value) => {
        const multiplexerOld = this.multiplexerOut();
        this.reg[reg.tac] = value;

        this.updateDivider();

        if (multiplexerOld & ~this.multiplexerOut()) this.incrementOnce();
    };

    private divWrite: WriteHandler = () => {
        const multiplexerOld = this.multiplexerOut();
        this.reg[reg.div] = 0;

        this.accDiv = 0;
        this.accTima = 0;

        if (multiplexerOld & ~this.multiplexerOut()) this.incrementOnce();
    };

    private reg = new Uint8Array(0x04);
    private accDiv = 0;

    private accShift = 8;
    private accMask = 0xff;
    private accTima = 0;
    private irqPending = false;
    private overflowCycle = false;
    private latchCycle = false;
}
