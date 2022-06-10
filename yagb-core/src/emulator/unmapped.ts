import { Bus, ReadHandler, WriteHandler } from './bus';
export class Unmapped {
    install(bus: Bus): void {
        for (let i = 0xfea0; i < 0xff00; i++) {
            bus.map(i, this.unmappedRead, this.unmappedWrite);
        }

        for (let i = 0xff4c; i < 0xff80; i++) {
            bus.map(i, this.unmappedRead, this.unmappedWrite);
        }

        for (let i = 0xff27; i < 0xff30; i++) {
            bus.map(i, this.unmappedRead, this.unmappedWrite);
        }

        for (let i = 0xff08; i < 0xff0f; i++) {
            bus.map(i, this.unmappedRead, this.unmappedWrite);
        }

        [0xff03].forEach((x) => bus.map(x, this.unmappedRead, this.unmappedWrite));
    }

    private unmappedRead: ReadHandler = () => 0xff;
    private unmappedWrite: WriteHandler = () => undefined;
}
