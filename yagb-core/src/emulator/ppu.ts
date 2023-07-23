import { Bus } from './bus';
import { Clock } from './clock';
import { Cpu } from './cpu';
import { Interrupt } from './interrupt';
import { Mode } from './mode';
import { PpuCgb } from './ppu/ppu-cgb';
import { PpuDmg } from './ppu/ppu-dmg';
import { Savestate } from './savestate';
import { System } from './system';

export const enum ppuMode {
    hblank = 0,
    vblank = 1,
    oamScan = 2,
    draw = 3,
}

export interface Ppu {
    setCpu(cpu: Cpu): Ppu;
    setClock(clock: Clock): Ppu;

    save(savestate: Savestate): void;
    load(savestate: Savestate): void;

    install(bus: Bus): void;

    reset(): void;

    cycle(systemClocks: number): void;
    printState(): string;
    getFrameIndex(): number;
    getFrameData(): ArrayBuffer;

    getMode(): ppuMode;
}

export function createPpu(mode: Mode, system: System, interrupt: Interrupt): Ppu {
    switch (mode) {
        case Mode.cgb:
            return new PpuCgb(system, interrupt);

        case Mode.dmg:
            return new PpuDmg(system, interrupt);

        default:
            throw new Error('unreachable');
    }
}
