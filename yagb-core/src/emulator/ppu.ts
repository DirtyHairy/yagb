import { Bus } from './bus';
import { Interrupt } from './interrupt';
import { Mode } from './mode';
import { Savestate } from './savestate';
import { System } from './system';

export const enum ppuMode {
    hblank = 0,
    vblank = 1,
    oamScan = 2,
    draw = 3,
}

export interface Ppu {
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

export function createPpu(mode: Mode, system: System, interrupt: Interrupt): Ppu {}
