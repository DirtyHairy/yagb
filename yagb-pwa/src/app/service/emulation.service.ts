import { AudioDriver } from 'yagb-core/src/emulator/apu/audio-driver';
import { Database } from './database.service';
import { Emulator } from 'yagb-core/src/emulator/emulator';
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
    }

    start(): Promise<void> {
        return this.doStart();
    }

    stop(): Promise<void> {
        return this.doStop();
    }

    getEmulator(): Emulator | undefined {
        return this.emulator;
    }

    private doStart = () =>
        this.mutex.runExclusive(async () => {
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

                this.emulator = new Emulator(romData, (x) => console.log(x));
                this.scheduler = new Scheduler(this.emulator);
                this.lastFrameIndex = -1;

                this.scheduler.onTimesliceComplete.addHandler(this.onTimeslice);
                this.audioDriver.start(this.emulator.startAudio(this.audioDriver.getSampleRate()));

                const savestate = await this.database.getAutosave(currentGame.romHash);
                if (savestate) {
                    this.emulator.load(new Uint8Array(savestate));
                }

                this.lastAutosaveAt = 0;

                this.currentlyRunning = currentGame.romHash;
            } else {
                this.audioDriver.continue();
            }

            this.scheduler.start();
        });

    private doStop = () =>
        this.mutex.runExclusive(() => {
            if (this.scheduler) {
                this.scheduler.stop();
                this.audioDriver.pause();
            }
        });

    private onTimeslice = () => {
        this.autosave();

        if (!this.emulator || this.emulator.getFrameIndex() === this.lastFrameIndex) {
            return;
        }

        const imageData = new ImageData(new Uint8ClampedArray(this.emulator.getFrameData()), 160, 144);
        this.frameCanvasCtx.putImageData(imageData, 0, 0);

        this.onNewFrame.dispatch(this.frameCanvasCtx.canvas);

        this.lastFrameIndex = this.emulator.getFrameIndex();
    };

    private autosave() {
        const virtualClock = this.scheduler.getVirtualClockSeconds();
        if (virtualClock - this.lastAutosaveAt < AUTOSAVE_INTERVAL_SECONDS) {
            return;
        }

        this.database.putAutosave(this.currentlyRunning, this.emulator.save().getBuffer());
        this.lastAutosaveAt = virtualClock;
    }
}
