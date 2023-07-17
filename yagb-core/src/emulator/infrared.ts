import { Bus, ReadHandler, WriteHandler } from './bus';

import { Mode } from './mode';
import { Savestate } from './savestate';
import { cgbRegisters } from './cgb-registers';

export class Infrared {
    constructor(private mode: Mode) {}

    install(bus: Bus): void {
        if (Mode.cgb !== this.mode) return;

        bus.map(cgbRegisters.rp, this.rpRead, this.rpWrite);
    }

    reset(): void {}

    save(savestate: Savestate): void {}

    load(savestate: Savestate): void {}

    private rpRead: ReadHandler = () => 0x3e;
    private rpWrite: WriteHandler = (_, value) => {};
}
