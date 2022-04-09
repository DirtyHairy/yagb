import { Bus, ReadHandler, WriteHandler } from './bus';
import { hex16, hex8 } from '../helper/format';

import { SystemInterface } from './system';

export interface Cartridge {
    install(bus: Bus): void;
    reset(): void;
}

export function createCartridge(image: Uint8Array, system: SystemInterface): Cartridge | undefined {
    if (image.length !== 0x8000) return undefined;

    let checksum = 0;
    for (let i = 0; i < image.length; i++) {
        if (i !== 0x14e && i !== 0x14f) checksum = (checksum + image[i]) & 0xffff;
    }

    const checksumReference = (image[0x14e] << 8) | image[0x14f];

    if (checksum !== checksumReference) {
        system.warning(`ROM checksum mismatch: expected ${hex16(checksumReference)}, got ${hex16(checksum)}`);
    }

    const mapper = image[0x147];
    if (mapper !== 0) {
        system.warning(`unsupported mapper type ${hex8(mapper)}`);
        return undefined;
    }

    return new CartridgeNoMbc(image, system);
}

class CartridgeNoMbc implements Cartridge {
    constructor(image: Uint8Array, private system: SystemInterface) {
        this.rom.set(image);
    }

    install(bus: Bus): void {
        for (let i = 0; i < 0x8000; i++) {
            bus.map(i, this.readHandler, this.writeHandler);
        }
    }

    reset() {}

    private readHandler: ReadHandler = (address) => this.rom[address];
    private writeHandler: WriteHandler = (address) => this.system.warning(`attempt to write ROM at ${hex16(address)}`);

    private rom = new Uint8Array(0x8000);
}
