import { Cartridge, createCartridge } from './cartridge';
import { decodeInstruction, disassemleInstruction } from './instruction';

import { Bus } from './bus';
import { Clock } from './clock';
import { Cpu } from './cpu';
import { Ram } from './ram';
import { System } from './system';
import { hex16 } from '../helper/format';

export class Emulator {
    constructor(cartridgeImage: Uint8Array, printCb: (message: string) => void) {
        this.system = new System(printCb);
        this.bus = new Bus(this.system);
        this.clock = new Clock();
        this.cpu = new Cpu(this.bus, this.clock, this.system);
        this.ram = new Ram();

        const cartridge = createCartridge(cartridgeImage, this.system);
        if (!cartridge) {
            throw new Error('bad cartridge image');
        }

        this.cartridge = cartridge;

        this.cartridge.install(this.bus);
        this.ram.install(this.bus);

        this.system.onBreak.addHandler((message) => {
            this.break = true;
            this.breakMessage = message;
        });

        this.reset();
    }

    step(count: number): boolean {
        this.break = false;

        this.cpu.step(count);

        return !this.break;
    }

    reset(): void {
        this.cartridge.reset();
        this.cpu.reset();
        this.ram.reset();
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

            disassembledInstructions.push(`${hex16(disassembleAddress)}: ${disassemleInstruction(this.bus, disassembleAddress)}`);

            disassembledCount += instruction.len;
        }

        return disassembledInstructions;
    }

    lastBreakMessage(): string {
        return this.breakMessage;
    }

    private system: System;

    private bus: Bus;
    private cartridge: Cartridge;
    private cpu: Cpu;
    private clock: Clock;
    private ram: Ram;

    private break = false;
    private breakMessage = '';
}
