import { Bus, ReadHandler, WriteHandler } from './bus';

export class Joypad {
    install(bus: Bus): void {
        // io register: P1/JOYP - Joypad (R/W)
        bus.map(0xff00, this.joypadRead, this.joypadWrite);
    }

    reset(): void {
        this.joypad = 0x00;
    }

    private joypadRead: ReadHandler = () => this.joypad | 0x0f;
    private joypadWrite: WriteHandler = (address, value) => (this.joypad = value & 0xff);

    private joypad = 0x00;
}
