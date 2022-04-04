import { Cartridge, createCartridge } from './cartridge';
import { System, SystemInterface } from './system';
import { decodeInstruction, disassemleInstruction } from './instruction';

import { Bus } from './bus';
import { Cpu } from './cpu';
import { hex16 } from '../helper/format';

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

    disassemble(count: number, address = this.cpu.state.p): Array<string> {
        const disassembledInstructions: Array<string> = [];
        let disassembledCount = 0;

        while (disassembledCount < count) {
            const disassembleAddress = (address + disassembledCount) & 0xffff;
            const instruction = decodeInstruction(this.bus, disassembleAddress);

            disassembledInstructions.push(`${hex16(disassembleAddress)}: ${disassemleInstruction(instruction)}`);

            disassembledCount += instruction.len;
        }

        return disassembledInstructions;
    }

    private system: SystemInterface;

    private bus: Bus;
    private cartridge: Cartridge;
    private cpu: Cpu;
}
