import { Component } from '@angular/core';
import { FileService } from './../../service/file.service';
import { Game } from './../../model/game';
import { GameService } from './../../service/game.service';

@Component({
    selector: 'app-page-games',
    templateUrl: 'games.page.html',
    styleUrls: ['games.page.scss'],
})
export class GamesPage {
    constructor(private gameService: GameService, private fileService: FileService) {}

    get games(): Array<Game> {
        return this.gameService.getGames();
    }

    get loading(): boolean {
        return this.gameService.isLoading();
    }

    get currentGameRomHash(): string {
        return '';
    }

    trackGameBy(index: number, game: Game) {
        return game.romHash;
    }

    launchGame(game: Game): void {}

    editGame(game: Game): void {}

    deleteGame(game: Game): void {}

    resetGame(game: Game): void {}

    importGame(): void {
        this.fileService.openFile(() => undefined, '.gb');
    }

    lastGameTouchedRomHash = '';
}
