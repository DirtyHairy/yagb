import { Apu } from './apu';
import { Bus } from './bus';
import { ClockCgb } from './clock/clock-cgb';
import { ClockDmg } from './clock/clock-dmg';
import { Mode } from './mode';
import { Ppu } from './ppu';
import { Savestate } from './savestate';
import { Serial } from './serial';
import { Timer } from './timer';

export interface Clock {
    reset(): void;

    save(savestate: Savestate): void;
    load(savestate: Savestate): void;

    install(bus: Bus): void;

    // Unit: 1MHz (DMG, CGB slow), 2MHz (CGB fast)
    increment(cpuCycles: number): void;

    // Unit: 1MHz
    pauseCpu(oneMhzCycles: number): void;

    notifyStop(): void;

    isDoubleSpeed(): boolean;
    isSpeedSwitchInProgress(): boolean;

    // Unit: 1MHz (DMG), 2MHz (CGB)
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
