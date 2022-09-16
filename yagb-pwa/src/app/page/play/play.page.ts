import { Component, ElementRef, ViewChild } from '@angular/core';

import { EmulationService } from './../../service/emulation.service';
import { Game } from './../../model/game';
import { GameService } from './../../service/game.service';
import { KeyboardService } from './../../service/keyboard.service';

@Component({
    selector: 'app-page-play',
    templateUrl: 'play.page.html',
    styleUrls: ['play.page.scss'],
})
export class PlayPage {
    @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

    constructor(private gameService: GameService, private emulationService: EmulationService, private keyboarsService: KeyboardService) {}

    get currentGameName(): string | undefined {
        return this.gameService.getCurrentGame()?.name;
    }

    get isGameSelected(): boolean {
        return this.gameService.getCurrentGame() !== undefined;
    }

    async ionViewDidEnter(): Promise<void> {
        if (this.isGameSelected) {
            await this.emulationService.start();

            this.emulationService.onNewFrame.addHandler(this.onNewFrame);
            this.keyboarsService.bind(this.emulationService.getEmulator());
        }
    }

    async ionViewDidLeave(): Promise<void> {
        await this.emulationService.stop();

        this.emulationService.onNewFrame.removeHandler(this.onNewFrame);
        this.keyboarsService.unbind();
    }

    private onNewFrame = (sourceCanvas: HTMLCanvasElement) => {
        const canvas = this.canvasRef.nativeElement;
        const ctx = canvas.getContext('2d');

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
    };
}
