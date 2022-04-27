import { Bus, ReadHandler, WriteHandler } from '../bus';

import { CartridgeBase } from './CartridgeBase';
import { System } from '../system';

export class CartridgeRom extends CartridgeBase {
    constructor(image: Uint8Array, system: System) {
        super(image, system);
        this.rom = Uint8Array.from(this.image.slice(0x0000, 0x8000));
    }

    install(bus: Bus): void {
        super.install(bus);

        for (let i = 0; i < 0x8000; i++) {
            bus.map(i, this.romRead, this.stubWrite);
        }

        for (let i = 0xa000; i < 0xc000; i++) bus.map(i, this.ramRead, this.stubWrite);
    }

    printState(): string {
        return `rom only`;
    }

    private romRead: ReadHandler = (address) => this.rom[address];
    private ramRead: ReadHandler = () => 0xff;
    private stubWrite: WriteHandler = () => undefined;

    private rom: Uint8Array;
}
