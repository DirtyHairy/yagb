import { Bus, ReadHandler, WriteHandler } from './bus';

import { Mode } from './mode';
import { isCgbRegister } from './cgbRegisters';

export class Unmapped {
    constructor(private mode: Mode, private bus: Bus) {}

    install(): void {
        for (let address = 0xfea0; address < 0xff00; address++) this.initializeUnmapped(address);
        for (let address = 0xff4c; address < 0xff80; address++) this.initializeUnmapped(address);
        for (let address = 0xff27; address < 0xff30; address++) this.initializeUnmapped(address);
        for (let address = 0xff08; address < 0xff0f; address++) this.initializeUnmapped(address);

        [0xff03].forEach((address) => this.initializeUnmapped(address));
    }

    private initializeUnmapped(address: number): void {
        if (this.mode === Mode.cgb && isCgbRegister(address)) return;

        this.bus.map(address, this.unmappedRead, this.unmappedWrite);
    }

    private unmappedRead: ReadHandler = () => 0xff;
    private unmappedWrite: WriteHandler = () => undefined;
}
