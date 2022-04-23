import { Bus, ReadHandler, WriteHandler } from './bus';
import { Interrupt, irq } from './interrupt';

export class Serial {
    constructor(private interrupt: Interrupt) {}

    install(bus: Bus): void {
        bus.map(0xff01, this.stubRead, this.stubWrite);
        bus.map(0xff02, this.stubRead, this.scWrite);
    }

    private stubRead: ReadHandler = () => 0;
    private stubWrite: WriteHandler = () => undefined;

    // Always trigger a serial interrupt if a master write is initiated in order to
    // keep games that wait for the transfer to finish from hanging.
    private scWrite: WriteHandler = (_, value) => value & 0x81 && this.interrupt.raise(irq.serial);
}
