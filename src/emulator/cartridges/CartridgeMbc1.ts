import { CartridgeBase, CartridgeType } from './CartridgeBase';
import { ReadHandler, WriteHandler } from './../bus';

import { Bus } from '../bus';
import { System } from '../system';
import { hex8 } from '../../helper/format';

interface Mapping {
    romBank0: Uint8Array;
    romBank1: Uint8Array;
    ramBank: Uint8Array;

    bankIndex0: number;
    bankIndex1: number;
    bankIndexRam: number;
}

export class CartridgeMbc1 extends CartridgeBase {
    constructor(image: Uint8Array, system: System) {
        super(image, system);

        if (this.ramSize() > 8 * 1024 && this.size() >= 1024 * 1024) {
            throw new Error('unsupported memory configuration.');
        }

        this.configurations = new Array(0x100);
        this.ram = new Uint8Array(this.ramSize());

        this.initializeConfigurations();
        this.updateBanks();
    }

    install(bus: Bus): void {
        super.install(bus);

        for (let i = 0; i < 0x2000; i++) bus.map(i, this.readBank0, this.writeRamEnable);
        for (let i = 0x2000; i < 0x4000; i++) bus.map(i, this.readBank0, this.writeReg0);
        for (let i = 0x4000; i < 0x6000; i++) bus.map(i, this.readBank1, this.writeReg1);
        for (let i = 0x6000; i < 0x8000; i++) bus.map(i, this.readBank1, this.writeMode);
        for (let i = 0xa000; i < 0xc000; i++) bus.map(i, this.readBankRam, this.writeBankRam);
    }

    reset(savedRam?: Uint8Array): void {
        this.mode = 0;
        this.reg0 = 0;
        this.reg1 = 0;
        this.ramEnable = false;

        this.updateBanks();

        if (this.type() === CartridgeType.mbc1_ram_battery && savedRam && savedRam.length === this.ram.length) {
            this.ram.set(savedRam);
        }

        if (this.type() !== CartridgeType.mbc1_ram_battery) {
            this.ram.fill(0);
        }
    }

    clearRam(): void {
        this.ram.fill(0);
    }

    printState(): string {
        return `rom0=${hex8(this.bankIndex0)} rom1=${hex8(this.bankIndex1)} ram=${this.ramEnable ? hex8(this.bankIndexRam) : 'disabled'} reg0=${hex8(
            this.reg0
        )} reg1=${hex8(this.reg1)} mode=${this.mode}`;
    }

    getRam(): Uint8Array | undefined {
        return this.type() === CartridgeType.mbc1_ram_battery ? this.ram.slice() : undefined;
    }

    private initializeConfigurations(): void {
        const romSize = (this.size() / 1024) | 0;
        const ramSize = (this.ramSize() / 1024) | 0;
        const romBanks = (romSize / 16) | 0;
        const ramBanks = Math.max((ramSize / 8) | 0, 1);

        const romSlices = new Array(romBanks);
        for (let i = 0; i < romBanks; i++) romSlices[i] = this.image.subarray(i * 0x4000, (i + 1) * 0x4000);

        const ramSlices = new Array(ramBanks);
        for (let i = 0; i < ramBanks; i++) ramSlices[i] = this.ram.subarray(i * 0x2000, (i + 1) * 0x2000);

        for (let i = 0; i < 0x100; i++) {
            const mode = i >>> 7;
            const reg1 = (i & 0x60) >>> 5;
            const reg0 = i & 0x1f;

            const bankIndex0 = (mode === 1 && romSize >= 1024 ? reg1 << 5 : 0) % romBanks;
            const bankIndex1 = ((reg0 === 0 ? 1 : reg0) | (mode === 1 && ramSize <= 8 ? reg1 << 5 : 0)) % romBanks;
            const bankIndexRam = (mode === 1 && ramSize > 8 ? reg1 : 0) % ramBanks;

            this.configurations[i] = {
                romBank0: romSlices[bankIndex0],
                romBank1: romSlices[bankIndex1],
                ramBank: ramSlices[bankIndexRam],
                bankIndex0,
                bankIndex1,
                bankIndexRam,
            };
        }
    }

    private updateBanks(): void {
        const configuration = this.configurations[(this.mode << 7) | (this.reg1 << 5) | this.reg0];

        this.romBank0 = configuration.romBank0;
        this.romBank1 = configuration.romBank1;
        this.ramBank = configuration.ramBank;

        this.bankIndex0 = configuration.bankIndex0;
        this.bankIndex1 = configuration.bankIndex1;
        this.bankIndexRam = configuration.bankIndexRam;
    }

    private readBank0: ReadHandler = (address) => this.romBank0[address];
    private readBank1: ReadHandler = (address) => this.romBank1[address & 0x3fff];
    private readBankRam: ReadHandler = (address) => (this.ramEnable ? this.ramBank[address - 0xa000] : 0xff);

    private writeRamEnable: WriteHandler = (_, value) => this.ram.length > 0 && (this.ramEnable = (value & 0x0f) === 0x0a);

    private writeReg0: WriteHandler = (_, value) => {
        this.reg0 = value & 0x1f;
        this.updateBanks();
    };

    private writeReg1: WriteHandler = (_, value) => {
        this.reg1 = value & 0x03;
        this.updateBanks();
    };

    private writeMode: WriteHandler = (_, value) => {
        this.mode = value & 0x01;
        this.updateBanks();
    };

    private writeBankRam: WriteHandler = (address, value) => this.ramEnable && (this.ramBank[address - 0xa000] = value);

    private configurations: Array<Mapping>;

    private romBank0!: Uint8Array;
    private romBank1!: Uint8Array;
    private ramBank!: Uint8Array;

    private bankIndex0 = 0;
    private bankIndex1 = 0;
    private bankIndexRam = 0;

    private mode = 0;
    private reg0 = 0;
    private reg1 = 0;
    private ramEnable = false;

    private ram: Uint8Array;
}
