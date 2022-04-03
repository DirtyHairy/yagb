import { Bus, ReadHandler, WriteHandler } from './bus';

import { SystemInterface } from './system';

export interface Cartridge {
    install(bus: Bus): void;
}

export function createCartridge(image: Uint8Array, system: SystemInterface): Cartridge | undefined {
    if (image.length !== 0x8000) return undefined;

    let checksum = 0;
    for (let i = 0; i < image.length; i++) {
        if (i !== 0x14e && i !== 0x14f) checksum = (checksum + image[i]) & 0xffff;
    }

    const checksumReference = (image[0x14e] << 8) | image[0x14f];

    if (checksum !== checksumReference) {
        system.warning(
            `ROM checksum mismatch: expected 0x${checksumReference.toString(16).padStart(4, '0')}, got 0x${checksum
                .toString(16)
                .padStart(4, '0')}`
        );
    }

    return new CartridgeNoMbc(image, system);
}

class CartridgeNoMbc implements Cartridge {
    constructor(image: Uint8Array, private system: SystemInterface) {
        this.rom.set(image);
    }

    install(bus: Bus): void {
        for (let i = 0; i < 0x8000; i++) {
            bus.readMap[i] = this.readHandler;
            bus.writeMap[i] = this.writeHandler;
        }
    }

    private readHandler: ReadHandler = (address) => this.rom[address];
    private writeHandler: WriteHandler = (address) =>
        this.system.break(`attempt to write ROM at 0x${address.toString(16).padStart(4, '0')}`);

    private rom = new Uint8Array(0x8000);
}
