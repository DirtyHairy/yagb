import { Apu } from './apu';
import { ClockCgb } from './clock/clock-cgb';
import { ClockDmg } from './clock/clock-dmg';
import { Mode } from './mode';
import { Ppu } from './ppu';
import { Serial } from './serial';
import { Timer } from './timer';

export interface Clock {
    reset(): void;

    increment(cpuCycles: number): void;
    pauseCpu(timerCycles: number): void;

    resetCpuCycles(): void;
    get cpuCycles(): number;
}

export function createClock(mode: Mode, ppu: Ppu, timer: Timer, serial: Serial, apu: Apu) {
    switch (mode) {
        case Mode.dmg:
            return new ClockDmg(ppu, timer, serial, apu);

        case Mode.cgb:
            return new ClockCgb(ppu, timer, serial, apu);

        default:
            throw new Error('unreachable');
    }
}
