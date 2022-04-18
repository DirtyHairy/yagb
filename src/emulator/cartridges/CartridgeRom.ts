import { Bus, ReadHandler, WriteHandler } from '../bus';

import { CartridgeBase } from './CartridgeBase';
import { System } from '../system';
import { hex16 } from '../../helper/format';

export class CartridgeRom extends CartridgeBase {
    constructor(image: Uint8Array, system: System) {
        super(image, system);
        this.rom = Uint8Array.from(this.image.slice(0x0000, 0x8000));
    }

    install(bus: Bus): void {
        super.install(bus);
        for (let i = 0; i < 0x8000; i++) {
            bus.map(i, this.romReadHandler, this.romWriteHandler);
        }
    }

    printState(): string {
        return `rom only`;
    }

    protected romReadHandler: ReadHandler = (address) => this.rom[address];
    protected romWriteHandler: WriteHandler = (address) => this.system.warning(`attempt to write ROM at ${hex16(address)}`);

    protected rom: Uint8Array;
}
