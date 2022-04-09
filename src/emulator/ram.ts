import { Bus, ReadHandler, WriteHandler } from './bus';

export class Ram {
    install(bus: Bus): void {
        for (let i = 0xc000; i < 0xfe00; i++) {
            bus.map(i, this.wramRead, this.wramWrite);
        }

        for (let i = 0x8000; i < 0xA000; i++) {
            bus.map(i, this.vramRead, this.vramWrite);
        }

        for (let i = 0xff80; i < 0xffff; i++) {
            bus.map(i, this.hiramRead, this.hiramWrite);
        }
    }

    reset(): void {
        this.wram.fill(0);
        this.hiram.fill(0);
    }

    private wramRead: ReadHandler = (address) => this.wram[address & 0x1fff];
    private wramWrite: WriteHandler = (address, value) => (this.wram[address & 0x1fff] = value);

    private hiramRead: ReadHandler = (address) => this.hiram[address & 0x7f];
    private hiramWrite: WriteHandler = (address, value) => (this.hiram[address & 0x7f] = value);

    private vramRead: ReadHandler = (address) => this.vram[address & 0x1fff];
    private vramWrite: WriteHandler = (address, value) => (this.vram[address & 0x1fff] = value);

    private wram = new Uint8Array(0x2000);
    private hiram = new Uint8Array(0x7f);
    private vram = new Uint8Array(0x2000);
}
