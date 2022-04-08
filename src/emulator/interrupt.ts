import { Bus, ReadHandler, WriteHandler } from './bus';

const enum reg {
    if = 0xff0f,
    ie = 0xffff,
}

export class Interrupt {
    install(bus: Bus) {
        bus.map(reg.if, this.readIF, this.writeIF);
        bus.map(reg.ie, this.readIE, this.writeIE);
    }

    private readIE: ReadHandler = () => 0;
    private writeIE: WriteHandler = () => undefined;

    private readIF: ReadHandler = () => 0;
    private writeIF: WriteHandler = () => undefined;
}
