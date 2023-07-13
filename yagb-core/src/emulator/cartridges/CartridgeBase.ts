import { Cartridge, CartridgeAddress, CartridgeRAMType, CartridgeROMType, CartridgeType, CgbSupportLevel, describeCgbSupportLevel } from '../cartridge';

import { Bus } from '../bus';
import { Savestate } from '../savestate';
import { System } from '../system';
import { hex8 } from '../../helper/format';

export abstract class CartridgeBase implements Cartridge {
    constructor(protected image: Uint8Array, protected system: System, public readonly cgbSupportLevel: CgbSupportLevel) {
        if (image.length !== this.size()) {
            throw new Error(`bad cartridge: size mismatch`);
        }
    }

    save(savestate: Savestate): void {}

    load(savestate: Savestate): void {}

    getNvData(): Uint8Array | undefined {
        return undefined;
    }

    clearNvData(): void {}

    install(bus: Bus): void {}

    reset(savedRam?: Uint8Array): void {}

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

    describe(): string {
        return `${this.describeType()}, ${describeCgbSupportLevel(this.cgbSupportLevel)}, ${this.size() / 1024}kb ROM${
            this.ramSize() > 0 ? `, ${this.ramSize() / 1024}kb RAM` : ''
        }`;
    }

    private describeType(): string {
        switch (this.type()) {
            case CartridgeType.rom:
                return 'ROM ONLY';

            case CartridgeType.mbc1:
                return 'MBC1';

            case CartridgeType.mbc1_ram:
                return 'MBC1 with RAM';

            case CartridgeType.mbc1_ram_battery:
                return 'MBC1 with RAM and battery';

            case CartridgeType.mbc2:
                return 'MBC2';

            case CartridgeType.mbc2_battery:
                return 'MBC2 with battery';

            case CartridgeType.rom_ram:
                return 'plain ROM with RAM';

            case CartridgeType.rom_ram_battery:
                return 'plain ROM with RAM and battery';

            case CartridgeType.mmm01:
                return 'MMM01';

            case CartridgeType.mmm01_ram:
                return 'MMM01 with RAM';

            case CartridgeType.mmm01_ram_battery:
                return 'MMM01 with RAM and battery';

            case CartridgeType.mbc3_timer_battery:
                return 'MBC3 with timer and battery';

            case CartridgeType.mbc3_timer_ram_battery:
                return 'MBC3 with timer, RAM and battery';

            case CartridgeType.mbc3:
                return 'MBC3';

            case CartridgeType.mbc3_ram:
                return 'MBC3 with RAM';

            case CartridgeType.mbc3_ram_battery:
                return 'MBC3 with RAM and battery';

            case CartridgeType.mbc5:
                return 'MBC5';

            case CartridgeType.mbc5_ram:
                return 'MBC5 with RAM';

            case CartridgeType.mbc5_ram_battery:
                return 'MBC5 with RAM and battery';

            case CartridgeType.mbc5_rumble:
                return 'MBC5 with Rumble pack';

            case CartridgeType.mbc5_rumble_ram:
                return 'MBC5 with Rumble pack RUMBLE and RAM';

            case CartridgeType.mbc5_rumble_ram_battery:
                return 'MBC5 with Rumble pack, RAM and battery';

            case CartridgeType.mbc6:
                return 'MBC6';

            case CartridgeType.mbc7_sensor_rumble_ram_battery:
                return 'MBC7 with Sensor, Rumble pack, RAM and battery';

            case CartridgeType.pocket_camera:
                return 'Pocket camera';

            case CartridgeType.bandai_tama5:
                return 'Bandai Tama5';

            case CartridgeType.huc3:
                return 'HuC3';

            case CartridgeType.huc1_ram_battery:
                return 'HuC1 with RAM and battery';

            default:
                throw new Error(`unknown cartridge type ${this.type()}`);
        }
    }

    abstract printState(): string;

    protected ramType(): CartridgeRAMType {
        return this.image[CartridgeAddress.ramType];
    }
}
