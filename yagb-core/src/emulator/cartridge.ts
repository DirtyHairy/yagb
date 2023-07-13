import { hex16, hex8 } from '../helper/format';

import { Bus } from './bus';
import { CartridgeMbc1 } from './cartridges/CartridgeMbc1';
import { CartridgeMbc2 } from './cartridges/CartridgeMbc2';
import { CartridgeMbc3 } from './cartridges/CartridgeMbc3';
import { CartridgeMbc5 } from './cartridges/CartridgeMbc5';
import { CartridgeRom } from './cartridges/CartridgeRom';
import { Savestate } from './savestate';
import { System } from './system';

export const enum CgbSupportLevel {
    none = 0,
    cgbCompatible = 1,
    cgbOnly = 2,
}

export const enum CartridgeAddress {
    nintendoLogoStart = 0x104,
    nintendoLogoEnd = 0x133,
    titleStart = 0x134,
    manufacturerCodeStart = 0x13f,
    manufacturerCodeEnd = 0x142,
    cgbFlag = 0x143,
    titleEnd = 0x143,
    newLicenseeCodeHigh = 0x144,
    newLicenseeCodeLow = 0x145,
    sgbFlag = 0x146,
    type = 0x147,
    size = 0x148,
    ramType = 0x149,
    destinationCode = 0x14b,
    oldLicenseeCode = 0x14b,
    maskRomVersionNumber = 0x14c,
    headerChecksum = 0x14d,
    globalChecksumHigh = 0x14e,
    globalChecksumLow = 0x14f,
}

export const enum CartridgeType {
    rom = 0x00,
    mbc1 = 0x01,
    mbc1_ram = 0x02,
    mbc1_ram_battery = 0x03,
    mbc2 = 0x05,
    mbc2_battery = 0x06,
    rom_ram = 0x08,
    rom_ram_battery = 0x09,
    mmm01 = 0x0b,
    mmm01_ram = 0x0c,
    mmm01_ram_battery = 0x0d,
    mbc3_timer_battery = 0x0f,
    mbc3_timer_ram_battery = 0x10,
    mbc3 = 0x11,
    mbc3_ram = 0x12,
    mbc3_ram_battery = 0x13,
    mbc5 = 0x19,
    mbc5_ram = 0x1a,
    mbc5_ram_battery = 0x1b,
    mbc5_rumble = 0x1c,
    mbc5_rumble_ram = 0x1d,
    mbc5_rumble_ram_battery = 0x1e,
    mbc6 = 0x20,
    mbc7_sensor_rumble_ram_battery = 0x22,
    pocket_camera = 0xfc,
    bandai_tama5 = 0xfd,
    huc3 = 0xfe,
    huc1_ram_battery = 0xff,
}

export const enum CartridgeROMType {
    rom_2banks_256kbit_32kb = 0x00,
    rom_4banks_512kbit_64kb = 0x01,
    rom_8banks_1mbit_128kb = 0x02,
    rom_16banks_2mbit_256kb = 0x03,
    rom_32banks_4mbit_512kb = 0x04,
    rom_64banks_8mbit_1mb = 0x05,
    rom_128banks_16mbit_2mb = 0x06,
    rom_256banks_32mbit_4mb = 0x07,
    rom_512banks_64mbit_8mb = 0x08,
    rom_72banks_9mbit_1_1mb = 0x52,
    rom_80banks_10mbit_1_2mb = 0x53,
    rom_96banks_12mbit_1_5mb = 0x54,
}

export const enum CartridgeRAMType {
    no_ram = 0x00,
    ram_2kb = 0x01,
    ram_8kb = 0x02,
    ram_32kb = 0x03,
    ram_128kb = 0x04,
    ram_64kb = 0x05,
}

export const CartridgeROMBankSize = 0x4000;
export const CartridgeRAMBankSize = 0x2000;

function getCgbSupportLevel(flag: number) {
    if ((flag & 0x80) === 0) return CgbSupportLevel.none;
    if ((flag & 0x40) === 0) return CgbSupportLevel.cgbCompatible;

    return CgbSupportLevel.cgbOnly;
}

function validateCgbSupportLevel(supportLevel: CgbSupportLevel, flag: number) {
    switch (supportLevel) {
        case CgbSupportLevel.none:
            if (flag === 0) return;
            break;

        case CgbSupportLevel.cgbCompatible:
            if (flag === 0x80) return;
            break;

        case CgbSupportLevel.cgbOnly:
            if (flag === 0xc0) return;
            break;
    }

    console.error(`weird cgb support flag ${hex8(flag)}, assuming ${describeCgbSupportLevel(supportLevel)}`);
}

export function describeCgbSupportLevel(supportLevel: CgbSupportLevel): string {
    switch (supportLevel) {
        case CgbSupportLevel.none:
            return 'no cgb support';

        case CgbSupportLevel.cgbCompatible:
            return 'cgb compatible';

        case CgbSupportLevel.cgbOnly:
            return 'cgb only';

        default:
            throw new Error('unreachable');
    }
}

export interface Cartridge {
    readonly cgbSupportLevel: CgbSupportLevel;

    save(savestate: Savestate): void;
    load(savestate: Savestate): void;

    install(bus: Bus): void;
    reset(savedRam?: Uint8Array | undefined): void;

    getNvData(): Uint8Array | undefined;
    clearNvData(): void;

    type(): number;
    size(): number;

    describe(): string;
    printState(): string;
}

export function identifyCartridge(image: Uint8Array, system: System): [CartridgeType, CgbSupportLevel] | undefined {
    if (image.length === 0) {
        system.error(`ROM file is empty!`);
        return undefined;
    }

    if (image.length % CartridgeROMBankSize !== 0) {
        system.error(`Unexpected ROM file length`);
        return undefined;
    }

    const lengthReference = 0x8000 << image[CartridgeAddress.size];
    if (image.length !== lengthReference) {
        system.error(`ROM size mismatch: expected ${hex16(lengthReference)}, got ${hex16(image.length)}`);
        return undefined;
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

    const cgbFlag = image[0x0143];
    const cgbSupportLevel = getCgbSupportLevel(cgbFlag);
    validateCgbSupportLevel(cgbSupportLevel, cgbFlag);

    const cartridgeType = image[CartridgeAddress.type];
    switch (cartridgeType) {
        case CartridgeType.rom:
        case CartridgeType.rom_ram:
        case CartridgeType.rom_ram_battery:
        case CartridgeType.mbc1:
        case CartridgeType.mbc1_ram:
        case CartridgeType.mbc1_ram_battery:
        case CartridgeType.mbc2:
        case CartridgeType.mbc2_battery:
        case CartridgeType.mbc3:
        case CartridgeType.mbc3_ram:
        case CartridgeType.mbc3_ram_battery:
        case CartridgeType.mbc3_timer_battery:
        case CartridgeType.mbc3_timer_ram_battery:
        case CartridgeType.mbc5:
        case CartridgeType.mbc5_ram:
        case CartridgeType.mbc5_ram_battery:
        case CartridgeType.mbc5_rumble:
        case CartridgeType.mbc5_rumble_ram:
        case CartridgeType.mbc5_rumble_ram_battery:
            return [cartridgeType, cgbSupportLevel];

        default:
            system.warning(`unsupported mapper type ${hex8(cartridgeType)}`);
            return undefined;
    }
}

export function createCartridge(image: Uint8Array, system: System): Cartridge | undefined {
    const [cartridgeType, cgbSupportLevel] = identifyCartridge(image, system) ?? [undefined, CgbSupportLevel.none];
    if (cartridgeType === undefined) return undefined;

    switch (cartridgeType) {
        case CartridgeType.rom:
        case CartridgeType.rom_ram:
        case CartridgeType.rom_ram_battery:
            return new CartridgeRom(image, system, cgbSupportLevel);

        case CartridgeType.mbc1:
        case CartridgeType.mbc1_ram:
        case CartridgeType.mbc1_ram_battery:
            return new CartridgeMbc1(image, system, cgbSupportLevel);

        case CartridgeType.mbc2:
        case CartridgeType.mbc2_battery:
            return new CartridgeMbc2(image, system, cgbSupportLevel);

        case CartridgeType.mbc3:
        case CartridgeType.mbc3_ram:
        case CartridgeType.mbc3_ram_battery:
        case CartridgeType.mbc3_timer_battery:
        case CartridgeType.mbc3_timer_ram_battery:
            return new CartridgeMbc3(image, system, cgbSupportLevel);

        case CartridgeType.mbc5:
        case CartridgeType.mbc5_ram:
        case CartridgeType.mbc5_ram_battery:
        case CartridgeType.mbc5_rumble:
        case CartridgeType.mbc5_rumble_ram:
        case CartridgeType.mbc5_rumble_ram_battery:
            return new CartridgeMbc5(image, system, cgbSupportLevel);

        default:
            system.warning(`unsupported mapper type ${hex8(cartridgeType as number)}`);
            return undefined;
    }
}
