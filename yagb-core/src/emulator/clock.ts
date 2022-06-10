import { Apu } from './apu';
import { Ppu } from './ppu';
import { Serial } from './serial';
import { Timer } from './timer';
export class Clock {
    constructor(private ppu: Ppu, private timer: Timer, private serial: Serial, private apu: Apu) {}

    increment(cpuCycles: number) {
        this.ppu.cycle(4 * cpuCycles);
        this.timer.cycle(cpuCycles);
        this.serial.cycle(cpuCycles);
        this.apu.cycle(cpuCycles);
    }
}
