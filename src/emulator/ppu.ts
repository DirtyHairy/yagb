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

        bus.map(reg.ly, this.readLY, this.invalidWrite);
    }

    reset(): void {
        this.cyclesInLine = 0;
        this.currentLine = 0;
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

    private readLY: ReadHandler = () => this.currentLine;

    cyclesInLine = 0;
    currentLine = 0;
}
