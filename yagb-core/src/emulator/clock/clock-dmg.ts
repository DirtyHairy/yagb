import { Apu } from '../apu';
import { Bus } from '../bus';
import { Clock } from '../clock';
import { Ppu } from '../ppu';
import { Serial } from '../serial';
import { Timer } from '../timer';

export class ClockDmg implements Clock {
    constructor(private ppu: Ppu, private timer: Timer, private serial: Serial, private apu: Apu) {}

    reset(): void {
        this.cpuCycles = 0;
    }

    install(bus: Bus): void {}

    increment(cpuCycles: number) {
        this.ppu.cycle(4 * cpuCycles);
        this.timer.cycle(cpuCycles);
        this.serial.cycle(cpuCycles);
        this.apu.cycle(cpuCycles);

        this.cpuCycles += cpuCycles;
    }

    pauseCpu(oneMhzCycles: number): void {}

    resetCpuCycles(): void {
        this.cpuCycles = 0;
    }

    notifyStop(): void {}

    isDoubleSpeed(): boolean {
        return false;
    }

    isSpeedSwitchInProgress(): boolean {
        return false;
    }

    cpuCycles = 0;
}
