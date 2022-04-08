import { Ppu } from './ppu';
export class Clock {
    constructor(private ppu: Ppu) {}

    increment(cpuCycles: number) {
        this.ppu.cycle(4 * cpuCycles);
    }
}
