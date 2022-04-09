import { Bus, ReadHandler, WriteHandler } from './bus';

import { SystemInterface } from './system';
import { hex16 } from '../helper/format';

const enum reg {
    ly = 0xff44,
}

export class Ppu {
    constructor(private system: SystemInterface) {}

    install(bus: Bus): void {
        for (let i = 0xff40; i <= 0xff4b; i++) {
            bus.map(i, this.stubRead, this.stubWrite);
        }

        for (let i = 0x8000; i < 0xa000; i++) {
            bus.map(i, this.vramRead, this.vramWrite);
        }

        for (let i = 0xfe00; i < 0xfea0; i++) {
            bus.map(i, this.oamRead, this.oamWrite);
        }

        for (let i = 0xfea0; i < 0xff00; i++) {
            bus.map(i, this.stubRead, this.stubWrite);
        }

        bus.map(reg.ly, this.readLY, this.invalidWrite);
    }

    reset(): void {
        this.cyclesInLine = 0;
        this.currentLine = 0;

        this.vram.fill(0);
    }

    cycle(systemClocks: number): void {
        const pendingCycles = this.cyclesInLine + systemClocks;

        this.currentLine += (pendingCycles / 456) | 0;
        this.cyclesInLine = pendingCycles % 456;

        this.currentLine %= 154;
    }

    private stubRead: ReadHandler = () => 0;
    private stubWrite: WriteHandler = () => undefined;
    private invalidWrite: WriteHandler = (address) => this.system.break(`bad write to PPU at ${hex16(address)}`);

    private vramRead: ReadHandler = (address) => this.vram[address & 0x1fff];
    private vramWrite: WriteHandler = (address, value) => (this.vram[address & 0x1fff] = value);

    private oamRead: ReadHandler = (address) => this.oam[address & 0xff];
    private oamWrite: WriteHandler = (address, value) => (this.oam[address & 0xff] = value);

    private readLY: ReadHandler = () => this.currentLine;

    cyclesInLine = 0;
    currentLine = 0;

    private vram = new Uint8Array(0x2000);
    private oam = new Uint8Array(0xa0);
}
