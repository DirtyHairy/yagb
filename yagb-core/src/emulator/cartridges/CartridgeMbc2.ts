import { CartridgeType, CgbSupportLevel } from '../cartridge';
import { ReadHandler, WriteHandler } from '../bus';

import { Bus } from '../bus';
import { CartridgeBase } from './CartridgeBase';
import { Savestate } from './../savestate';
import { System } from '../system';
import { hex8 } from '../../helper/format';

const SAVESTATE_VERSION = 0x00;

export class CartridgeMbc2 extends CartridgeBase {
    constructor(image: Uint8Array, system: System, cgbSupportLevel: CgbSupportLevel) {
        super(image, system, cgbSupportLevel);

        const romSize = this.size();
        if (romSize % 0x4000 !== 0 || romSize > 16 * 0x4000 || romSize < 2 * 0x4000) {
            throw new Error('invalid ROM size; not a MBC2 image');
        }

        this.romBanks = new Array((romSize / 0x4000) | 0);
        for (let i = 0; i < this.romBanks.length; i++) {
            this.romBanks[i] = this.image.subarray(i * 0x4000, (i + 1) * 0x4000);
        }

        this.romBank1 = this.romBanks[this.bankIndex];
    }

    save(savestate: Savestate): void {
        savestate.startChunk(SAVESTATE_VERSION).write16(this.bankIndex).writeBool(this.ramEnable).writeBuffer(this.ram);
    }

    load(savestate: Savestate): void {
        savestate.validateChunk(SAVESTATE_VERSION);

        this.bankIndex = savestate.read16() % this.romBanks.length;
        this.ramEnable = savestate.readBool();
        this.ram.set(savestate.readBuffer(this.ram.length));

        this.romBank1 = this.romBanks[this.bankIndex > 0 ? this.bankIndex % this.romBanks.length : 1];
    }

    install(bus: Bus): void {
        super.install(bus);

        for (let i = 0x0000; i < 0x4000; i++) bus.map(i, this.readBank0, this.writeReg);
        for (let i = 0x4000; i < 0x8000; i++) bus.map(i, this.readBank1, this.writeStub);
        for (let i = 0xa000; i < 0xc000; i++) bus.map(i, this.readBankRam, this.writeBankRam);
    }

    reset(savedRam?: Uint8Array): void {
        this.bankIndex = 1;
        this.romBank1 = this.romBanks[this.bankIndex];
        this.ramEnable = false;

        if (this.type() === CartridgeType.mbc2_battery && savedRam && savedRam.length === this.ram.length) {
            this.ram.set(savedRam);
        }

        if (this.type() !== CartridgeType.mbc2_battery) {
            this.ram.fill(0);
        }
    }

    clearNvData(): void {
        this.ram.fill(0);
    }

    printState(): string {
        return `bank=${hex8(this.bankIndex)} ramEnable=${this.ramEnable}`;
    }

    getNvData(): Uint8Array | undefined {
        return this.type() === CartridgeType.mbc2_battery ? this.ram : undefined;
    }

    private readBank0: ReadHandler = (address) => this.image[address];
    private readBank1: ReadHandler = (address) => this.romBank1[address & 0x3fff];
    private writeStub: WriteHandler = () => undefined;

    private readBankRam: ReadHandler = (address) => (this.ramEnable ? this.ram[(address - 0xa000) & 0x01ff] | 0xf0 : 0xff);
    private writeBankRam: WriteHandler = (address, value) => this.ramEnable && (this.ram[(address - 0xa000) & 0x01ff] = value & 0x0f);

    private writeReg: WriteHandler = (address, value) => {
        if (address & 0x0100) {
            this.bankIndex = value & 0x0f;
            this.romBank1 = this.romBanks[this.bankIndex > 0 ? this.bankIndex % this.romBanks.length : 1];
        } else {
            this.ramEnable = (value & 0x0f) === 0x0a;
        }
    };

    private romBank1!: Uint8Array;
    private bankIndex = 0x01;
    private romBanks: Array<Uint8Array>;

    private ramEnable = false;
    private ram = new Uint8Array(512);
}
