import { Apu } from '../apu';
import { Clock } from '../clock';
import { Ppu } from '../ppu';
import { Serial } from '../serial';
import { Timer } from '../timer';

export class ClockCgb implements Clock {
    constructor(private ppu: Ppu, private timer: Timer, private serial: Serial, private apu: Apu) {}

    reset(): void {
        this.cpuCycles = 0;
        this.extraCpuCycles = 0;
    }

    increment(cpuCycles: number) {
        this.incrementImpl(cpuCycles);

        while (this.extraCpuCycles !== 0) {
            const cycles = this.extraCpuCycles;
            this.extraCpuCycles = 0;

            this.incrementImpl(cycles);
        }
    }

    pauseCpu(timerCycles: number): void {
        this.extraCpuCycles += timerCycles;
    }

    resetCpuCycles(): void {
        this.cpuCycles = 0;
    }

    private incrementImpl(cpuCycles: number) {
        this.ppu.cycle(4 * cpuCycles);
        this.timer.cycle(cpuCycles);
        this.serial.cycle(cpuCycles);
        this.apu.cycle(cpuCycles);

        this.cpuCycles += cpuCycles;
    }

    cpuCycles = 0;

    private extraCpuCycles = 0;
}
