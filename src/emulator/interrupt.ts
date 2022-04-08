import { Bus, ReadHandler, WriteHandler } from './bus';
export class Interrupt {
    install(bus: Bus) {
        bus.readMap[0xff0f] = this.readIF;
        bus.readMap[0xffff] = this.readIE;

        bus.writeMap[0xff0f] = this.writeIF;
        bus.writeMap[0xffff] = this.writeIE;
    }

    readIE: ReadHandler = () => 0;
    writeIE: WriteHandler = () => undefined;

    readIF: ReadHandler = () => 0;
    writeIF: WriteHandler = () => undefined;
}
