import { Bus, ReadHandler, WriteHandler } from './bus';
export class Ppu {
    install(bus: Bus): void {
        for (let i = 0xff40; i <= 0xff4b; i++) {
            bus.readMap[i] = this.stubRead;
            bus.writeMap[i] = this.stubWrite;
        }
    }

    private stubRead: ReadHandler = () => 0;
    private stubWrite: WriteHandler = () => undefined;
}
