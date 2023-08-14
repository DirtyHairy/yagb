import { compressFrame, decompressFrame } from '../helper/frame';

import { AudioDriver } from 'yagb-core/src/emulator/apu/audio-driver';
import { Database } from './database.service';
import { Emulator, PreferredModel } from 'yagb-core/src/emulator/emulator';
import { Event } from 'microevent.ts';
import { GameService } from './game.service';
import { Injectable } from '@angular/core';
import { Mutex } from 'async-mutex';
import { Scheduler } from 'yagb-core/src/emulator/scheduler';

const AUTOSAVE_INTERVAL_SECONDS = 1;

@Injectable({ providedIn: 'root' })
export class EmulationService {
    private emulator: Emulator | undefined;
    private lastFrameIndex = 0;
    private lastAutosaveAt = 0;
    private frameCanvasCtx: CanvasRenderingContext2D;
    private mutex = new Mutex();
    private currentlyRunning = '';
    private scheduler: Scheduler | undefined;
    private audioDriver = new AudioDriver();

    readonly onNewFrame = new Event<HTMLCanvasElement>();

    constructor(private gameService: GameService, private database: Database) {
        const canvas: HTMLCanvasElement = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 144;

        this.frameCanvasCtx = canvas.getContext('2d');

        this.gameService.onClearCurrentGame.addHandler(() => this.stop());
    }

    start(): Promise<void> {
        return this.mutex.runExclusive(() => this.doStart());
    }

    stop(): Promise<void> {
        return this.mutex.runExclusive(() => this.doStop());
    }

    prepare(): Promise<void> {
        return this.mutex.runExclusive(() => this.doPrepare());
    }

    getEmulator(): Emulator | undefined {
        return this.emulator;
    }

    isRunning(): boolean {
        return !!this.scheduler?.isRunning();
    }

    lastFrameData(): ArrayBuffer | undefined {
        return this.emulator.getFrameData();
    }

    private async doPrepare(): Promise<void> {
        const currentGame = this.gameService.getCurrentGame();
        if (!currentGame) {
            return;
        }

        if (currentGame.romHash !== this.currentlyRunning) {
            this.audioDriver.stop();

            if (this.scheduler) {
                this.scheduler.stop();
                this.scheduler.onTimesliceComplete.removeHandler(this.onTimeslice);
            }

            const romData = await this.database.getRomData(currentGame.romHash);
            if (!romData) {
                throw new Error(`cannot happend: no ROM found for ${currentGame.romHash}`);
            }

            this.emulator = new Emulator(romData, PreferredModel.auto, (x) => console.log(x));
            this.scheduler = new Scheduler(this.emulator);
            this.lastFrameIndex = this.emulator.getFrameIndex();

            this.scheduler.onTimesliceComplete.addHandler(this.onTimeslice);
            this.audioDriver.start(this.emulator.startAudio(this.audioDriver.getSampleRate()));
            this.audioDriver.pause();

            const savestate = await this.database.getAutosave(currentGame.romHash);
            if (savestate) {
                this.emulator.load(new Uint8Array(savestate.data));

                if (savestate.lastFrame) {
                    this.dispatchFrame(decompressFrame(savestate.lastFrame));
                }
            }

            this.lastAutosaveAt = 0;

            this.currentlyRunning = currentGame.romHash;
        }
    }

    private async doStart(): Promise<void> {
        if (!this.gameService.getCurrentGame()) {
            return;
        }

        await this.doPrepare();

        this.scheduler.start();
        this.audioDriver.continue();
    }

    private async doStop(): Promise<void> {
        if (this.scheduler) {
            this.scheduler.stop();
            this.audioDriver.pause();
        }
    }

    private onTimeslice = () => {
        this.autosave();

        if (!this.emulator || this.emulator.getFrameIndex() === this.lastFrameIndex) {
            return;
        }

        this.dispatchFrame();
        this.lastFrameIndex = this.emulator.getFrameIndex();
    };

    private autosave() {
        const virtualClock = this.scheduler.getVirtualClockSeconds();
        if (virtualClock - this.lastAutosaveAt < AUTOSAVE_INTERVAL_SECONDS || this.currentlyRunning === undefined) {
            return;
        }

        this.database.putAutosave({
            romHash: this.currentlyRunning,
            data: this.emulator.save().getBuffer(),
            lastFrame: compressFrame(this.emulator.getFrameData()),
        });

        this.lastAutosaveAt = virtualClock;
    }

    private dispatchFrame(data = this.emulator.getFrameData()): void {
        const imageData = new ImageData(new Uint8ClampedArray(data), 160, 144);
        this.frameCanvasCtx.putImageData(imageData, 0, 0);

        this.onNewFrame.dispatch(this.frameCanvasCtx.canvas);
    }
}
