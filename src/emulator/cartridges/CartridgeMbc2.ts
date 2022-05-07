import { CartridgeBase, CartridgeType } from './CartridgeBase';
import { ReadHandler, WriteHandler } from '../bus';

import { Bus } from '../bus';
import { System } from '../system';
import { hex8 } from '../../helper/format';

export class CartridgeMbc2 extends CartridgeBase {
    constructor(image: Uint8Array, system: System) {
        super(image, system);

        for (let i = 0; i < 0x10; i++) {
            this.romBanks[i] = this.image.subarray(i * 0x4000, (i + 1) * 0x4000);
        }
    }

    install(bus: Bus): void {
        super.install(bus);

        for (let i = 0x0000; i < 0x4000; i++) bus.map(i, this.readBank0, this.writeReg);
        for (let i = 0x4000; i < 0x8000; i++) bus.map(i, this.readBank1, this.writeStub);
        for (let i = 0xa000; i < 0xc000; i++) bus.map(i, this.readBankRam, this.writeBankRam);
    }

    reset(savedRam?: Uint8Array): void {
        this.romBank1 = this.romBanks[0];
        this.bankIndex = 1;
        this.ramEnable = false;

        if (this.type() === CartridgeType.mbc2_battery && savedRam && savedRam.length === this.ram.length) {
            this.ram.set(savedRam);
        }

        if (this.type() !== CartridgeType.mbc2_battery) {
            this.ram.fill(0);
        }
    }

    clearRam(): void {
        this.ram.fill(0);
    }

    printState(): string {
        return `bank=${hex8(this.bankIndex)} ramEnable=${this.ramEnable}`;
    }

    getRam(): Uint8Array | undefined {
        return this.type() === CartridgeType.mbc2_battery ? this.ram.slice() : undefined;
    }

    private readBank0: ReadHandler = (address) => this.image[address];
    private readBank1: ReadHandler = (address) => this.romBank1[address & 0x3fff];
    private writeStub: WriteHandler = () => undefined;

    private readBankRam: ReadHandler = (address) => (this.ramEnable ? this.ram[(address - 0xa000) & 0x01ff] | 0xf0 : 0xff);
    private writeBankRam: WriteHandler = (address, value) => this.ramEnable && (this.ram[(address - 0xa000) & 0x01ff] = value & 0x0f);

    private writeReg: WriteHandler = (address, value) => {
        if (address & 0x0100) {
            this.bankIndex = value & 0x0f;
            this.romBank1 = this.romBanks[this.bankIndex];
        } else {
            this.ramEnable = value === 0x0a;
        }
    };

    private romBank1!: Uint8Array;
    private bankIndex = 0x01;
    private romBanks = new Array<Uint8Array>(0x10);

    private ramEnable = false;
    private ram = new Uint8Array(512);
}
