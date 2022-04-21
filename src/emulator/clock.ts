import { Ppu } from './ppu';
import { Timer } from './timer';
export class Clock {
    constructor(private ppu: Ppu, private timer: Timer) {}

    increment(cpuCycles: number) {
        this.ppu.cycle(4 * cpuCycles);
        this.timer.cycle(4 * cpuCycles);
    }
}
