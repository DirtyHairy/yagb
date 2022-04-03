import { Cartridge, createCartridge } from './cartridge';
import { System, SystemInterface } from './system';

import { Bus } from './bus';
import { Cpu } from './cpu';

export class Emulator {
    constructor(cartridgeImage: Uint8Array, printCb: (message: string) => void) {
        this.system = new System(printCb);
        this.bus = new Bus(this.system);
        this.cpu = new Cpu();

        const cartridge = createCartridge(cartridgeImage, this.system);
        if (!cartridge) {
            throw new Error('bad cartridge image');
        }

        this.cartridge = cartridge;
        this.cartridge.install(this.bus);

        this.reset();
    }

    reset(): void {
        this.cartridge.reset();
        this.cpu.reset();
    }

    printState(): string {
        return `CPU:\n${this.cpu.printState()}`;
    }

    private system: SystemInterface;

    private bus: Bus;
    private cartridge: Cartridge;
    private cpu: Cpu;
}
