import { Bus, ReadHandler, WriteHandler } from '../bus';
import { CartridgeBase, CartridgeRAMBankSize, CartridgeRAMType, CartridgeROMBankSize } from './CartridgeBase';

import { System } from '../system';
import { hex16 } from '../../helper/format';

const enum MemoryModel {
    mode_16mbit_8kb = 0x00,
    mode_4mbit_32kb = 0x01,
}

export class CartridgeMbc1 extends CartridgeBase {
    constructor(image: Uint8Array, system: System) {
        super(image, system);

        // prettier-ignore
        this.rom = Array.from(
            { length: Math.ceil(this.size() / CartridgeROMBankSize) },
            (_, i) => Uint8Array.from(this.image.slice(i, i + CartridgeROMBankSize))
        );

        if (this.ramType() !== CartridgeRAMType.no_ram) {
            this.sram = Array.from({ length: Math.ceil(this.ramSize() /  CartridgeRAMBankSize)}, (_, i) => new Uint8Array(CartridgeRAMBankSize).fill(0));
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
        this.memoryModel = MemoryModel.mode_16mbit_8kb;
        this.romBank = 1;
        this.ramBank = 0;

        this.romBankRegister1 = 1;
        this.romBankRegister2 = 0;
        this.sram.forEach((ram, i) => {
            ram.fill(0);
        });
    }

    printState(): string {
        return `memory.model=${this.printMemoryModel()},ram.enabled=${this.sramEnabled ? 'on' : 'off'},rom.banks.count=${this.rom.length}, rom.bank=${this.romBank}, ram.banks.count=${this.sram.length} ram.bank=${this.ramBank}`;
    }

    private printMemoryModel(): string {
        switch (this.memoryModel) {
            case MemoryModel.mode_16mbit_8kb:
                return '16Mbit/8kb';

            case MemoryModel.mode_4mbit_32kb:
                return '4Mbit/32kb';

            default:
                throw new Error(`unknown memory model ${this.memoryModel}`);
        }
    }

    private mbcReadHandler: ReadHandler = (address) => {
        switch (true) {
            // ROM bank 0
            case 0x0000 <= address && address < 0x4000: {
                let selectedBank = 0;

                if(this.memoryModel === MemoryModel.mode_4mbit_32kb)
                    selectedBank = this.romBank;

                return this.rom[selectedBank][address];
            }

            // ROM bank 1
            case 0x4000 <= address && address < 0x8000: {
                let selectedBank = this.romBank;

                if ((selectedBank & 0x01) === 0x00) selectedBank += 0x01;

                return this.rom[selectedBank][address - CartridgeROMBankSize];
            }

            // RAM bank
            case 0xa000 <= address && address < 0xc000:
                if (!this.sramEnabled) return 0xff;

                return this.sram[this.ramBank][address - 0xa0000];

            default:
                this.system.warning(`attempt to read ROM at ${hex16(address)}`);
                return 0;
        }
    };

    private mbcWriteHandler: WriteHandler = (address, value) => {
        switch (true) {
            // enable/disable cartridge ram
            case 0x0000 <= address && address < 0x2000:
                this.sramEnabled = (value & 0x0f) === 0x0a;
                break;

            // select rom bank
            case 0x2000 <= address && address < 0x4000:
                // lower 5 bits
                value &= 0x1f;

                // this register can not write zero values
                // attempt to write zero will write one
                if (value === 0x00) value += 0x01;

                // If the ROM Bank Number is set to a higher value than the number of banks in the cartridge,
                // the bank number is masked to the required number of bits.
                if(value > this.rom.length) {
                    const bitMask = parseInt('1'.repeat((this.rom.length).toString(2).length), 2)
                    value &= bitMask;
                }

                this.romBank &= 0xe0;
                this.romBank |= value;
                break;

            // select ram bank
            case 0x4000 <= address && address < 0x6000:
                switch(this.memoryModel) {
                    case MemoryModel.mode_16mbit_8kb: {
                        const selectedBank = (this.romBank & 0xf1) | (value & 0xe0);
                        if (selectedBank < this.rom.length) {
                            // higher bits
                            value &= 0xe0;
                            this.romBank &= 0x1f
                            this.romBank |= value;
                        }
                        break;
                    }

                    case MemoryModel.mode_4mbit_32kb:
                        if((value & 0x03) < this.sram.length)
                            this.ramBank = value & 0x03;
                        break;

                    default:
                        throw new Error(`unknown memory model ${this.memoryModel}`);
                }
                break;

            // select memory model
            case 0x6000 <= address && address < 0x8000:
                switch(value & 0x01) {
                    case MemoryModel.mode_16mbit_8kb:
                        value = MemoryModel.mode_16mbit_8kb;
                        break;

                    case MemoryModel.mode_4mbit_32kb:
                        value = MemoryModel.mode_4mbit_32kb;
                        break;

                    default:
                        throw new Error(`unknown memory model ${this.memoryModel}`);
                }

                this.memoryModel = value;
                break;

            // write to cartridge ram
            case 0xa000 <= address && address < 0xc000:
                if (this.sramEnabled)
                    this.sram[this.ramBank][address - 0xa0000] = value;
                break;

            default:
                this.system.warning(`attempt to write ROM at ${hex16(address)}`);
                break;
        }
    };

    protected rom: Array<Uint8Array>;

    private memoryModel = MemoryModel.mode_16mbit_8kb;

    private romBank = 0;

    private romBankRegister1 = 1;
    private romBankRegister2 = 0;

    private sram: Array<Uint8Array>;

    private sramEnabled = false;

    private ramBank = 0;
}
