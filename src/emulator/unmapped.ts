import { Bus, ReadHandler, WriteHandler } from './bus';
export class Unmapped {
    install(bus: Bus): void {
        for (let i = 0xfea0; i < 0xff00; i++) {
            bus.map(i, this.stubRead, this.stubWrite);
        }

        for (let i = 0xff4c; i < 0xff80; i++) {
            bus.map(i, this.stubRead, this.stubWrite);
        }
    }

    private stubRead: ReadHandler = () => 0;
    private stubWrite: WriteHandler = () => undefined;
}
