import { CartridgeAddress, CartridgeROMBankSize, CartridgeType } from './cartridges/CartridgeBase';
import { hex16, hex8 } from '../helper/format';

import { Bus } from './bus';
import { CartridgeMbc1 } from './cartridges/CartridgeMbc1';
import { CartridgeMbc2 } from './cartridges/CartridgeMbc2';
import { CartridgeMbc3 } from './cartridges/CartridgeMbc3';
import { CartridgeRom } from './cartridges/CartridgeRom';
import { System } from './system';

export interface Cartridge {
    install(bus: Bus): void;
    reset(savedRam?: Uint8Array | undefined): void;
    getRam(): Uint8Array | undefined;
    clearRam(): void;
    type(): number;
    size(): number;
    printInfo(): string;
    printState(): string;
}

export function createCartridge(image: Uint8Array, system: System): Cartridge | undefined {
    if (image.length === 0) {
        system.error(`ROM file is empty!`);
        throw new Error('Bad ROM file size');
    }

    if (image.length % CartridgeROMBankSize !== 0) {
        system.error(`Unexpected ROM file length`);
        throw new Error('Bad ROM file size');
    }

    const lengthReference = 0x8000 << image[CartridgeAddress.size];
    if (image.length !== lengthReference) {
        system.error(`ROM size mismatch: expected ${hex16(lengthReference)}, got ${hex16(image.length)}`);
        throw new Error('Bad ROM file size');
    }

    let headerChecksum = 0;
    for (let m = 0x134; m < 0x14d; m++) headerChecksum = headerChecksum - image[m] - 1;
    headerChecksum &= 0xff;

    const headerChecksumReference = image[CartridgeAddress.headerChecksum];

    if (headerChecksum !== headerChecksumReference) {
        system.warning(`ROM header checksum mismatch: expected ${hex8(headerChecksumReference)}, got ${hex8(headerChecksum)}`);
    }

    let checksum = 0;
    for (let i = 0; i < image.length; i++) {
        if (i !== CartridgeAddress.globalChecksumHigh && i !== CartridgeAddress.globalChecksumLow) checksum = (checksum + image[i]) & 0xffff;
    }

    const checksumReference = (image[CartridgeAddress.globalChecksumHigh] << 8) | image[CartridgeAddress.globalChecksumLow];

    if (checksum !== checksumReference) {
        system.warning(`ROM checksum mismatch: expected ${hex16(checksumReference)}, got ${hex16(checksum)}`);
    }

    const mapper = image[CartridgeAddress.type];
    switch (mapper) {
        case CartridgeType.rom:
        case CartridgeType.rom_ram:
        case CartridgeType.rom_ram_battery:
            return new CartridgeRom(image, system);

        case CartridgeType.mbc1:
        case CartridgeType.mbc1_ram:
        case CartridgeType.mbc1_ram_battery:
            return new CartridgeMbc1(image, system);

        case CartridgeType.mbc2:
        case CartridgeType.mbc2_battery:
            return new CartridgeMbc2(image, system);

        case CartridgeType.mbc3:
        case CartridgeType.mbc3_ram:
        case CartridgeType.mbc3_ram_battery:
        case CartridgeType.mbc3_timer_battery:
        case CartridgeType.mbc3_timer_ram_battery:
            return new CartridgeMbc3(image, system);

        default:
            system.warning(`unsupported mapper type ${hex8(mapper)}`);
            return undefined;
    }
}
