import { Cartridge, createCartridge } from './cartridge';
import { System, SystemInterface } from './system';

import { Bus } from './bus';

export class Emulator {
    constructor(cartridgeImage: Uint8Array, printCb: (message: string) => void) {
        this.system = new System(printCb);
        this.bus = new Bus(this.system);

        const cartridge = createCartridge(cartridgeImage, this.system);
        if (!cartridge) {
            throw new Error('bad cartridge image');
        }

        this.cartridge = cartridge;
        this.cartridge.install(this.bus);
    }

    private bus: Bus;
    private cartridge: Cartridge;
    private system: SystemInterface;
}
