import { Bus, ReadHandler, WriteHandler } from './bus';
import { Interrupt, irq } from './interrupt';

export class Serial {
    constructor(private interrupt: Interrupt) {}

    install(bus: Bus): void {
        bus.map(0xff01, this.stubRead, this.stubWrite);
        bus.map(0xff02, this.scRead, this.scWrite);
    }

    reset(): void {
        this.regSC = 0;
    }

    private stubRead: ReadHandler = () => 0;
    private stubWrite: WriteHandler = () => undefined;
    private regSC = 0;

    // Always flag that any request transfer has completed.
    private scRead: ReadHandler = () => this.regSC & 0x03;

    // Always trigger a serial interrupt if a master write is initiated in order to
    // keep games that wait for the transfer to finish from hanging.
    private scWrite: WriteHandler = (_, value) => {
        this.regSC = value & 0xff;

        if ((value & 0x81) === 0x81) this.interrupt.raise(irq.serial);
    };
}
