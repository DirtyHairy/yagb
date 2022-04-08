import { Bus, ReadHandler, WriteHandler } from './bus';

export class Serial {
    install(bus: Bus): void {
        for (let i = 0xff01; i <= 0xff02; i++) {
            bus.map(i, this.stubRead, this.stubWrite);
        }
    }

    private stubRead: ReadHandler = () => 0;
    private stubWrite: WriteHandler = () => undefined;
}
