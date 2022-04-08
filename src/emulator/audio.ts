import { Bus, ReadHandler, WriteHandler } from './bus';

export class Audio {
    install(bus: Bus): void {
        for (let i = 0xff10; i <= 0xff26; i++) {
            bus.map(i, this.stubRead, this.stubWrite);
        }

        for (let i = 0xff30; i <= 0xff3f; i++) {
            bus.map(i, this.stubRead, this.stubWrite);
        }
    }

    private stubRead: ReadHandler = () => 0;
    private stubWrite: WriteHandler = () => undefined;
}
