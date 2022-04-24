import { Bus } from '../bus';
import { Cartridge } from '../cartridge';
import { System } from '../system';
import { hex8 } from '../../helper/format';

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

export abstract class CartridgeBase implements Cartridge {
    constructor(protected image: Uint8Array, protected system: System) {
        if (image.length !== this.size()) {
            throw new Error(`bad cartridge: size mismatch`);
        }
    }

    install(bus: Bus): void {}

    reset(): void {}

    type(): number {
        return this.image[CartridgeAddress.type];
    }

    size(): number {
        switch (this.image[CartridgeAddress.size]) {
            case CartridgeROMType.rom_2banks_256kbit_32kb:
                return 32 * 1024;

            case CartridgeROMType.rom_4banks_512kbit_64kb:
                return 64 * 1024;

            case CartridgeROMType.rom_8banks_1mbit_128kb:
                return 128 * 1024;

            case CartridgeROMType.rom_16banks_2mbit_256kb:
                return 256 * 1024;

            case CartridgeROMType.rom_32banks_4mbit_512kb:
                return 512 * 1024;

            case CartridgeROMType.rom_64banks_8mbit_1mb:
                return 1024 * 1024;

            case CartridgeROMType.rom_128banks_16mbit_2mb:
                return 2 * 1024 * 1024;

            case CartridgeROMType.rom_256banks_32mbit_4mb:
                return 4 * 1024 * 1024;

            case CartridgeROMType.rom_512banks_64mbit_8mb:
                return 8 * 1024 * 1024;

            case CartridgeROMType.rom_72banks_9mbit_1_1mb:
                return 128 * 1024 + 1024 * 1024;

            case CartridgeROMType.rom_80banks_10mbit_1_2mb:
                return 256 * 1024 + 1024 * 1024;

            case CartridgeROMType.rom_96banks_12mbit_1_5mb:
                return 512 * 1024 + 1536 * 1024;

            default:
                throw new Error(`Unknown ROM size ${hex8(this.image[CartridgeAddress.size])}`);
        }
    }

    ramSize(): number {
        switch (this.image[CartridgeAddress.ramType]) {
            case CartridgeRAMType.no_ram:
                return 0;

            case CartridgeRAMType.ram_2kb:
                return 2 * 1024;

            case CartridgeRAMType.ram_8kb:
                return 8 * 1024;

            case CartridgeRAMType.ram_32kb:
                return 32 * 1024;

            case CartridgeRAMType.ram_64kb:
                return 64 * 1024;

            case CartridgeRAMType.ram_128kb:
                return 128 * 1024;

            default:
                throw new Error(`Unknown RAM size ${hex8(this.image[CartridgeAddress.ramType])}`);
        }
    }

    printInfo(): string {
        return `type=${this.printType()}, size=${this.size() / 1024}kb, ram=${this.ramSize() / 1024}kb`;
    }

    private printType(): string {
        switch (this.type()) {
            case CartridgeType.rom:
                return 'ROM ONLY';

            case CartridgeType.mbc1:
                return 'MBC1';

            case CartridgeType.mbc1_ram:
                return 'MBC1+RAM';

            case CartridgeType.mbc1_ram_battery:
                return 'MBC1+RAM+BATTERY';

            case CartridgeType.mbc2:
                return 'MBC2';

            case CartridgeType.mbc2_battery:
                return 'MBC2+BATTERY';

            case CartridgeType.rom_ram:
                return 'ROM+RAM';

            case CartridgeType.rom_ram_battery:
                return 'ROM+RAM+BATTERY';

            case CartridgeType.mmm01:
                return 'MMM01';

            case CartridgeType.mmm01_ram:
                return 'MMM01+RAM';

            case CartridgeType.mmm01_ram_battery:
                return 'MMM01+RAM+BATTERY';

            case CartridgeType.mbc3_timer_battery:
                return 'MBC3+TIMER+BATTERY';

            case CartridgeType.mbc3_timer_ram_battery:
                return 'MBC3+TIMER+RAM+BATTERY';

            case CartridgeType.mbc3:
                return 'MBC3';

            case CartridgeType.mbc3_ram:
                return 'MBC3+RAM';

            case CartridgeType.mbc3_ram_battery:
                return 'MBC3+RAM+BATTERY';

            case CartridgeType.mbc5:
                return 'MBC5';

            case CartridgeType.mbc5_ram:
                return 'MBC5+RAM';

            case CartridgeType.mbc5_ram_battery:
                return 'MBC5+RAM+BATTERY';

            case CartridgeType.mbc5_rumble:
                return 'MBC5+RUMBLE';

            case CartridgeType.mbc5_rumble_ram:
                return 'MBC5+RUMBLE+RAM';

            case CartridgeType.mbc5_rumble_ram_battery:
                return 'MBC5+RUMBLE+RAM+BATTERY';

            case CartridgeType.mbc6:
                return 'MBC6';

            case CartridgeType.mbc7_sensor_rumble_ram_battery:
                return 'MBC7+SENSOR+RUMBLE+RAM+BATTERY';

            case CartridgeType.pocket_camera:
                return 'POCKET CAMERA';

            case CartridgeType.bandai_tama5:
                return 'BANDAI TAMA5';

            case CartridgeType.huc3:
                return 'HuC3';

            case CartridgeType.huc1_ram_battery:
                return 'HuC1+RAM+BATTERY';

            default:
                throw new Error(`unknown cartridge type ${this.type()}`);
        }
    }

    abstract printState(): string;

    protected ramType(): CartridgeRAMType {
        return this.image[CartridgeAddress.ramType];
    }
}
