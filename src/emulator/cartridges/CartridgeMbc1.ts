import { Bus, ReadHandler, WriteHandler } from '../bus';
import { CartridgeBase, CartridgeRAMBankSize, CartridgeRAMType, CartridgeROMBankSize } from './CartridgeBase';

import { System } from '../system';
import { hex16 } from '../../helper/format';

export class CartridgeMbc1 extends CartridgeBase {
    constructor(image: Uint8Array, system: System) {
        super(image, system);

        // prettier-ignore
        this.rom = Array.from(
            { length: image.length / CartridgeROMBankSize },
            (_, i) => Uint8Array.from(this.image.slice(i, i + CartridgeROMBankSize))
        );

        if (this.ramType() !== CartridgeRAMType.no_ram) {
            this.sram = Array.from({ length: this.rom.length }, (_, i) => new Uint8Array(CartridgeRAMBankSize).fill(0));
        } else {
            this.sram = [new Uint8Array(0)];
        }
    }

    install(bus: Bus): void {
        super.install(bus);

        for (let i = 0; i < 0x8000; i++) {
            bus.map(i, this.mbcReadHandler, this.mbcWriteHandler);
        }

        for (let i = 0xa000; i < 0xc000; i++) {
            bus.map(i, this.mbcReadHandler, this.mbcWriteHandler);
        }
    }

    reset(): void {
        this.sramEnabled = false;
        this.bankMode = 0;
        this.romBank = 1;
        this.ramBank = 0;

        this.romBankRegister1 = 1;
        this.romBankRegister2 = 0;
        this.sram.forEach((ram, i) => {
            ram.fill(0);
        });
    }

    protected mbcReadHandler: ReadHandler = (address) => {
        switch (true) {
            // ROM bank 0
            case 0x0000 <= address && address < 0x4000:
                if (this.bankMode === 1) {
                    this.romBank = (this.romBankRegister2 << 5) % this.rom.length;
                } else {
                    this.romBank = 0;
                }

                return this.rom[this.romBank][address];

            // ROM bank 1
            case 0x4000 <= address && address < 0x8000:
                if (this.bankMode === 1) {
                    this.romBank = (this.romBankRegister2 << 5) % this.rom.length;
                } else {
                    this.romBank = 0;
                }

                return this.rom[this.romBank][address - CartridgeROMBankSize];

            // RAM bank
            case 0xa000 <= address && address < 0xc000:
                if (!this.sramEnabled) return 0xff;

                this.ramBank = this.bankMode === 1 ? this.romBankRegister2 : 0;
                return this.sram[this.ramBank & this.sram.length][address - 0xa0000];

            default:
                this.system.warning(`attempt to read ROM at ${hex16(address)}`);
                return 0;
        }
    };
    protected mbcWriteHandler: WriteHandler = (address, value) => {
        switch (true) {
            // enable/disable cartridge ram
            case 0x0000 <= address && address < 0x2000:
                this.sramEnabled = (value & 0x0f) === 0x0a;
                break;

            // select bank 0
            case 0x2000 <= address && address < 0x4000:
                value &= 0x1f;
                // this register can not write zero values
                // attempt to write zero will write one
                if (value === 0x00) value = 0x01;
                this.romBankRegister1 = value;
                break;

            // select bank 1
            case 0x4000 <= address && address < 0x6000:
                this.romBankRegister2 = value & 0x03;
                break;

            // select bank mode
            case 0x6000 <= address && address < 0x8000:
                this.bankMode = value & 0x01;
                break;

            // write to cartridge ram
            case 0xa000 <= address && address < 0xc000:
                if (this.sramEnabled) {
                    this.ramBank = this.bankMode === 1 ? this.romBankRegister2 : 0;
                    this.sram[this.ramBank][address - 0xa0000] = value;
                }
                break;

            default:
                this.system.warning(`attempt to write ROM at ${hex16(address)}`);
                break;
        }
    };

    protected rom: Array<Uint8Array>;

    private bankMode = 0;

    private romBank = 0;

    private romBankRegister1 = 1;
    private romBankRegister2 = 0;

    private sram: Array<Uint8Array>;

    private sramEnabled = false;

    private ramBank = 0;
}
