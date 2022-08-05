import { AlertService } from './../../service/alert.service';
import { Component } from '@angular/core';
import { FileService } from './../../service/file.service';
import { Game } from './../../model/game';
import { GameService } from './../../service/game.service';
import { GameSettingsComponent } from './../../component/game-settings/game-settings.component';
import { ModalController } from '@ionic/angular';
import { System } from 'yagb-core/src/emulator/system';
import { identifyCartridge } from 'yagb-core/src/emulator/cartridge';

@Component({
    selector: 'app-page-games',
    templateUrl: 'games.page.html',
    styleUrls: ['games.page.scss'],
})
export class GamesPage {
    lastGameTouchedRomHash = '';

    constructor(
        private gameService: GameService,
        private fileService: FileService,
        private alertService: AlertService,
        private modalController: ModalController
    ) {}

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
        this.fileService.openFile(this.handleFile.bind(this), '.gb');
    }

    private async handleFile(data: Uint8Array, name: string): Promise<void> {
        if (identifyCartridge(data, new System(() => undefined)) === undefined) {
            this.alertService.errorMessage('This file is not a supported cartridge.');
        }

        const modal = await this.modalController.create({
            component: GameSettingsComponent,
            componentProps: {
                settings: { name: name.replace(/\.gb$/, '') },
                onSave: () => modal.dismiss(),
                onCancel: () => modal.dismiss(),
            },
        });

        await modal.present();
    }
}
