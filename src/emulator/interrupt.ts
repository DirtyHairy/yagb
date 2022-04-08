import { Bus, ReadHandler, WriteHandler } from './bus';
export class Interrupt {
    install(bus: Bus) {
        bus.readMap[0xff0f] = this.readIF;
        bus.readMap[0xffff] = this.readIE;

        bus.writeMap[0xff0f] = this.writeIF;
        bus.writeMap[0xffff] = this.writeIE;
    }

    private readIE: ReadHandler = () => 0;
    private writeIE: WriteHandler = () => undefined;

    private readIF: ReadHandler = () => 0;
    private writeIF: WriteHandler = () => undefined;
}
