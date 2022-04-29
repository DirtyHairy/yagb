import { Bus, ReadHandler, WriteHandler } from '../bus';

import { CartridgeBase, CartridgeType } from './CartridgeBase';
import { System } from '../system';

export class CartridgeRom extends CartridgeBase {
    constructor(image: Uint8Array, system: System) {
        super(image, system);
        this.rom = Uint8Array.from(this.image.slice(0x0000, 0x8000));
        this.ram = new Uint8Array(this.ramSize());
    }

    install(bus: Bus): void {
        super.install(bus);

        for (let i = 0; i < 0x8000; i++) {
            bus.map(i, this.romRead, this.stubWrite);
        }

        for (let i = 0xa000; i < 0xc000; i++) bus.map(i, this.readBankRam, this.writeBankRam);
    }

    reset(savedRam?: Uint8Array): void {
        if (this.type() === CartridgeType.rom_ram_battery && savedRam && savedRam.length === this.ram.length) {
            this.ram.set(savedRam);
        }

        if (this.type() !== CartridgeType.rom_ram_battery) {
            this.ram.fill(0);
        }
    }

    clearRam(): void {
        this.ram.fill(0);
    }

    printState(): string {
        return `rom ${this.type() === CartridgeType.rom ? 'only' : `with ${this.ramSize() / 1024}kb ram`}`;
    }

    getRam(): Uint8Array | undefined {
        return this.type() === CartridgeType.rom_ram_battery ? this.ram.slice() : undefined;
    }

    private romRead: ReadHandler = (address) => this.rom[address];
    private stubWrite: WriteHandler = () => undefined;

    private readBankRam: ReadHandler = (address) => this.ram.length > 0 ? this.ram[address - 0xa000] : 0xff;
    private writeBankRam: WriteHandler = (address, value) => this.ram.length > 0 && (this.ram[address - 0xa000] = value);

    private readonly rom: Uint8Array;
    private readonly ram: Uint8Array;
}
