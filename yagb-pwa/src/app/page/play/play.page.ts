import { Component, ElementRef, ViewChild } from '@angular/core';

import { Database } from 'src/app/service/database.service';
import { EmulationService } from './../../service/emulation.service';
import { GameService } from './../../service/game.service';
import { KeyboardService } from './../../service/keyboard.service';
import { getCurrentGame } from 'src/app/helper/currentGame';

@Component({
    selector: 'app-page-play',
    templateUrl: 'play.page.html',
    styleUrls: ['play.page.scss'],
})
export class PlayPage {
    @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

    private bootstrapComplete: Promise<void>;
    private firstView = true;

    constructor(
        private gameService: GameService,
        private emulationService: EmulationService,
        private keyboarsService: KeyboardService,
        private database: Database
    ) {
        this.bootstrapComplete = this.bootstrap();
    }

    get currentGameName(): string | undefined {
        return this.gameService.getCurrentGame()?.name;
    }

    get isGameSelected(): boolean {
        return this.gameService.getCurrentGame() !== undefined;
    }

    get isRunning(): boolean {
        return this.emulationService.isRunning();
    }

    togglePlayPause(): boolean {
        if (!this.isGameSelected) {
            return;
        }

        if (this.emulationService.isRunning()) {
            this.stopEmulation();
        } else {
            this.startEmulation();
        }
    }

    async ionViewDidEnter(): Promise<void> {
        await this.bootstrapComplete;

        if (this.isGameSelected && !this.firstView) {
            await this.startEmulation();
        }
    }

    async ionViewDidLeave(): Promise<void> {
        await this.stopEmulation();

        this.firstView = false;
    }

    private onNewFrame = (sourceCanvas: HTMLCanvasElement) => {
        const canvas = this.canvasRef.nativeElement;
        const ctx = canvas.getContext('2d');

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
    };

    private async bootstrap(): Promise<void> {
        const currentGameHash = getCurrentGame();
        if (!currentGameHash) {
            return;
        }

        const currentGame = await this.database.getGameByRomHash(currentGameHash);
        if (!currentGame) {
            return;
        }

        this.gameService.setCurrentGame(currentGame);

        this.emulationService.onNewFrame.addHandler(this.onNewFrame);
        await this.emulationService.prepare();
    }

    private async startEmulation(): Promise<void> {
        await this.emulationService.start();

        if (!this.emulationService.onNewFrame.isHandlerAttached(this.onNewFrame)) {
            this.emulationService.onNewFrame.addHandler(this.onNewFrame);
        }

        this.keyboarsService.bind(this.emulationService.getEmulator());
    }

    private async stopEmulation(): Promise<void> {
        this.keyboarsService.unbind();
        this.emulationService.onNewFrame.removeHandler(this.onNewFrame);

        await this.emulationService.stop();
    }
}
