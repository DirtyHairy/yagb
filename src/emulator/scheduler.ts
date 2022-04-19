import { Average } from './average';
import { Emulator } from './emulator';
import { Event } from 'microevent.ts';

const SYSTEM_CLOCK = 1048576;
const HOST_SPEED_AVERAGE_SAMPLES = 100;
const EMIT_STATISTICS_INTERVAL = 1000;
const CLOCK_DRIFT_LIMIT_SEC = 0.5;
const CLOCK_DRIFT_RESET_HEADROOM_SEC = 0.02;

export interface Statistics {
    hostSpeed: number;
    speed: number;
}

export class Scheduler {
    constructor(private emulator: Emulator) {}

    start(): void {
        if (this.animationFrameHandle !== undefined) return;

        this.virtualClockSeconds = 0.0;
        this.realClockBase = performance.now();
        this.hostSpeedAverage.reset();

        this.animationFrameHandle = requestAnimationFrame(this.onAnimationFrame);
        this.emitStatisticsIntervalHandle = window.setInterval(
            () => this.onEmitStatistics.dispatch({ hostSpeed: this.hostSpeedAverage.calculateAverage(), speed: this.speed }),
            EMIT_STATISTICS_INTERVAL
        );
    }

    stop(): void {
        if (this.animationFrameHandle === undefined) return;

        cancelAnimationFrame(this.animationFrameHandle);
        clearInterval(this.emitStatisticsIntervalHandle);

        this.animationFrameHandle = undefined;
        this.emitStatisticsIntervalHandle = undefined;
    }

    isRunning(): boolean {
        return this.animationFrameHandle !== undefined;
    }

    setSpeed(speed: number): void {
        if (speed <= 0) return;
        this.speed = speed;
    }

    private executeTimeslice(durationSeconds: number, timestamp: number): void {
        if (durationSeconds > CLOCK_DRIFT_LIMIT_SEC) {
            durationSeconds = CLOCK_DRIFT_RESET_HEADROOM_SEC;
            this.virtualClockSeconds = (timestamp - this.realClockBase) / 1000 - CLOCK_DRIFT_RESET_HEADROOM_SEC;
        }

        const cyclesGoal = Math.round(durationSeconds * SYSTEM_CLOCK * this.speed);
        if (cyclesGoal <= 0) return;

        const timestampBeforeDispatch = performance.now();
        const timeslice = this.emulator.run(cyclesGoal) / SYSTEM_CLOCK / this.speed;
        const timestampAfterDispatch = performance.now();

        this.virtualClockSeconds += timeslice;

        if (timestampAfterDispatch !== timestampBeforeDispatch)
            this.hostSpeedAverage.push((timeslice * 1000) / (timestampAfterDispatch - timestampBeforeDispatch));

        this.onTimesliceComplete.dispatch();
    }

    private onAnimationFrame = (timestamp: number): void => {
        this.executeTimeslice((timestamp - this.realClockBase) / 1000 - this.virtualClockSeconds, timestamp);

        if (this.emulator.isTrap()) {
            this.stop();
        } else {
            this.animationFrameHandle = requestAnimationFrame(this.onAnimationFrame);
        }
    };

    readonly onTimesliceComplete = new Event<void>();
    readonly onEmitStatistics = new Event<Statistics>();

    private virtualClockSeconds = 0.0;
    private realClockBase = 0;
    private speed = 1;

    private animationFrameHandle: number | undefined = undefined;
    private emitStatisticsIntervalHandle: number | undefined = undefined;

    private hostSpeedAverage = new Average(HOST_SPEED_AVERAGE_SAMPLES);
}
