import { Bus, ReadHandler, WriteHandler } from './bus';

export class Ram {
    install(bus: Bus): void {
        for (let i = 0xc000; i < 0xfe00; i++) {
            bus.map(i, this.wramRead, this.wramWrite);
        }

        for (let i = 0xff80; i < 0xffff; i++) {
            bus.map(i, this.hiramRead, this.hiramWrite);
        }

        // TODO: remove this once we don't break on bad reads / writes anymore
        bus.map(0xff7f, this.stubRead, this.stubWrite);
    }

    reset(): void {
        this.wram.fill(0);
        this.hiram.fill(0);
    }

    private stubRead: ReadHandler = () => 0;
    private stubWrite: WriteHandler = () => undefined;

    private wramRead: ReadHandler = (address) => this.wram[address & 0x1fff];
    private wramWrite: WriteHandler = (address, value) => (this.wram[address & 0x1fff] = value);

    private hiramRead: ReadHandler = (address) => this.hiram[address & 0x7f];
    private hiramWrite: WriteHandler = (address, value) => (this.hiram[address & 0x7f] = value);

    private wram = new Uint8Array(0x2000);
    private hiram = new Uint8Array(0x7f);
}
