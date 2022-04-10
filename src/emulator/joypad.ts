import { Bus, ReadHandler, WriteHandler } from './bus';

export class Joypad {
    install(bus: Bus): void {
        // io register: P1/JOYP - Joypad (R/W)
        bus.map(0xff00, this.joypadRead, this.joypadWrite);
    }

    reset(): void {
        this.joypad = 0;
    }

    private joypadRead: ReadHandler = () => this.joypad;
    private joypadWrite: WriteHandler = (address, value) => (this.joypad = value);

    private joypad = 0x00;
}
