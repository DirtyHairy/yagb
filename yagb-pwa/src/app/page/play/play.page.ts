import { Component } from '@angular/core';
import { Game } from './../../model/game';
import { GameService } from './../../service/game.service';

@Component({
    selector: 'app-page-play',
    templateUrl: 'play.page.html',
    styleUrls: ['play.page.scss'],
})
export class PlayPage {
    constructor(private gameService: GameService) {}

    get currentGameName(): string | undefined {
        return this.gameService.getCurrentGame()?.name;
    }

    get isGameSelected(): boolean {
        return this.gameService.getCurrentGame() !== undefined;
    }
}
