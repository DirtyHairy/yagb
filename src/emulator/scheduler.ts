import { Emulator } from './emulator';
import { Event } from 'microevent.ts';

const SYSTEM_CLOCK = 1048576;

export class Scheduler {
    constructor(private emulator: Emulator) {}

    start(): void {
        if (this.animationFrameHandle !== undefined) return;

        this.virtualClockSeconds = 0.0;
        this.realClockBase = performance.now();

        this.animationFrameHandle = requestAnimationFrame(this.onAnimationFrame);
    }

    stop(): void {
        if (this.animationFrameHandle === undefined) return;

        cancelAnimationFrame(this.animationFrameHandle);
        this.animationFrameHandle = undefined;
    }

    isRunning(): boolean {
        return this.animationFrameHandle !== undefined;
    }

    private onAnimationFrame = (timestamp: number): void => {
        const deltaSeconds = (timestamp - this.realClockBase) / 1000 - this.virtualClockSeconds;
        if (deltaSeconds <= 0) return;

        const cyclesGoal = Math.floor(deltaSeconds * SYSTEM_CLOCK);
        if (cyclesGoal === 0) return;

        const cycles = this.emulator.run(cyclesGoal);
        this.virtualClockSeconds += cycles / SYSTEM_CLOCK;

        this.animationFrameHandle = this.emulator.isTrap() ? undefined : requestAnimationFrame(this.onAnimationFrame);
        this.onTimesliceComplete.dispatch();
    };

    readonly onTimesliceComplete = new Event<void>();

    private virtualClockSeconds = 0.0;
    private realClockBase = 0;
    private animationFrameHandle: number | undefined = undefined;
}
