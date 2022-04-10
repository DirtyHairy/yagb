import { Bus, ReadHandler, WriteHandler } from './bus';

export class Timer {
    install(bus: Bus): void {
        // io register: TMA - Timer Modulo (R/W)
        bus.map(0xff06, this.tmaRead, this.tmaWrite);
    }

    reset(): void {
        this.registers.fill(0);
    }

    private tmaRead: ReadHandler = (address) => this.registers[address & 0xff];
    private tmaWrite: WriteHandler = (address, value) => (this.registers[address & 0xff] = value);

    private registers = new Uint8Array(0x06);
}
