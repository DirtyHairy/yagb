import { CartridgeBase, CartridgeType } from './CartridgeBase';
import { ReadHandler, WriteHandler } from '../bus';

import { Bus } from '../bus';
import { Savestate } from './../savestate';
import { System } from '../system';
import { hex8 } from '../../helper/format';

const SAVESTATE_VERSION = 0x00;

export class CartridgeMbc5 extends CartridgeBase {
    constructor(image: Uint8Array, system: System) {
        super(image, system);

        const romSize = this.size();
        const ramSize = this.ramSize();

        if (romSize % 0x4000 !== 0 || romSize > 8 * 1024 * 1024 || romSize < 2 * 0x4000) {
            throw new Error('invalid ROM size; not a MBC5 image');
        }

        if (ramSize % 0x2000 !== 0 || ramSize > 128 * 1024) {
            throw new Error('invalid RAM size; not a MBC5 image');
        }

        this.ram = new Uint8Array(ramSize);
        this.romBanks = new Array((romSize / 0x4000) | 0);
        this.ramBanks = new Array((ramSize / 0x2000) | 0);

        for (let i = 0; i < this.romBanks.length; i++) {
            this.romBanks[i] = this.image.subarray(i * 0x4000, (i + 1) * 0x4000);
        }

        this.romBank1 = this.romBanks[this.romBankIndex];

        if (ramSize > 0) {
            for (let i = 0; i < this.ramBanks.length; i++) {
                this.ramBanks[i] = this.ram.subarray(i * 0x2000, (i + 1) * 0x2000);
            }

            this.ramBank = this.ramBanks[this.ramBankIndex];
        } else {
            this.ramBank = this.ram;
        }
    }

    save(savestate: Savestate): void {
        savestate.startChunk(SAVESTATE_VERSION).write16(this.romBankIndex).write16(this.ramBankIndex).writeBool(this.ramEnable).writeBuffer(this.ram);
    }

    load(savestate: Savestate): void {
        savestate.validateChunk(SAVESTATE_VERSION);

        this.romBankIndex = savestate.read16();
        this.ramBankIndex = savestate.read16();
        this.ramEnable = savestate.readBool();
        this.ram.set(savestate.readBuffer(this.ram.length));

        this.romBank1 = this.romBanks[this.romBankIndex];
        if (this.ram.length > 0) this.ramBank = this.ramBanks[this.ramBankIndex];
    }

    install(bus: Bus): void {
        super.install(bus);

        for (let i = 0x0000; i < 0x2000; i++) bus.map(i, this.readBank0, this.writeRamEnable);
        for (let i = 0x2000; i < 0x3000; i++) bus.map(i, this.readBank0, this.writeRomBankIndexLo);
        for (let i = 0x3000; i < 0x4000; i++) bus.map(i, this.readBank0, this.writeRomBankIndexHi);
        for (let i = 0x4000; i < 0x6000; i++) bus.map(i, this.readBank1, this.writeRamBankIndex);
        for (let i = 0x6000; i < 0x8000; i++) bus.map(i, this.readBank1, this.writeStub);
        for (let i = 0xa000; i < 0xc000; i++) bus.map(i, this.readBankRam, this.writeBankRam);
    }

    reset(savedRam?: Uint8Array): void {
        this.romBankIndex = 0x01;
        this.romBank1 = this.romBanks[this.romBankIndex];

        this.ramBankIndex = 0x00;
        this.ramBank = this.ram.length > 0 ? this.ramBanks[this.ramBankIndex] : this.ram;

        this.ramEnable = false;

        if (this.hasBattery() && savedRam && savedRam.length === this.ram.length) {
            this.ram.set(savedRam);
        }

        if (!this.hasBattery()) {
            this.ram.fill(0);
        }
    }

    clearNvData(): void {
        this.ram.fill(0);
    }

    printState(): string {
        return `romBank=${hex8(this.romBankIndex)} ramBank=${hex8(this.ramBankIndex)} ramEnable=${this.ramEnable}`;
    }

    getNvData(): Uint8Array | undefined {
        return this.hasBattery() ? this.ram.slice() : undefined;
    }

    private hasBattery(): boolean {
        return this.type() === CartridgeType.mbc5_ram_battery || this.type() === CartridgeType.mbc5_rumble_ram_battery;
    }

    private readBank0: ReadHandler = (address) => this.image[address];
    private readBank1: ReadHandler = (address) => this.romBank1[address & 0x3fff];
    private writeStub: WriteHandler = () => undefined;

    private writeRamEnable: WriteHandler = (_, value) => (this.ramEnable = value === 0x0a && this.ram.length > 0);
    private writeRomBankIndexLo: WriteHandler = (_, value) => {
        this.romBankIndex = (this.romBankIndex & ~0xff) | value;
        this.romBank1 = this.romBanks[this.romBankIndex % this.romBanks.length];
    };
    private writeRomBankIndexHi: WriteHandler = (_, value) => {
        this.romBankIndex = (this.romBankIndex & 0xff) | ((value & 0x01) << 8);
        this.romBank1 = this.romBanks[this.romBankIndex % this.romBanks.length];
    };
    private writeRamBankIndex: WriteHandler = (_, value) => {
        if (this.ramBanks.length === 0) return;

        this.ramBankIndex = value % this.ramBanks.length;
        this.ramBank = this.ramBanks[this.ramBankIndex];
    };

    private readBankRam: ReadHandler = (address) => (this.ramEnable ? this.ramBank[address - 0xa000] : 0);
    private writeBankRam: WriteHandler = (address, value) => this.ramEnable && (this.ramBank[address - 0xa000] = value);

    private romBank1!: Uint8Array;
    private romBankIndex = 0x01;
    private romBanks = new Array<Uint8Array>(0x10);

    private ram: Uint8Array;
    private ramBanks: Array<Uint8Array>;
    private ramBankIndex = 0x00;
    private ramBank!: Uint8Array;
    private ramEnable = false;
}
