import { Component } from '@angular/core';
import { Database } from './service/database.service';
import { EmulationService } from './service/emulation.service';
import { GameService } from './service/game.service';
import { getCurrentGame } from './helper/currentGame';

@Component({
    selector: 'app-root',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss'],
})
export class AppComponent {
    constructor(private database: Database, private gameService: GameService, private emulationService: EmulationService) {
        this.restoreCurrentGame();
    }

    async restoreCurrentGame(): Promise<void> {
        const currentGameHash = getCurrentGame();
        if (!currentGameHash) {
            return;
        }

        const currentGame = await this.database.getGameByRomHash(currentGameHash);
        if (!currentGame) {
            return;
        }

        this.gameService.setCurrentGame(currentGame);
    }
}
