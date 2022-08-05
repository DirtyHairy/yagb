import { createCartridge, identifyCartridge } from 'yagb-core/src/emulator/cartridge';

import { AlertService } from './../../service/alert.service';
import { Component } from '@angular/core';
import { FileService } from './../../service/file.service';
import { Game } from './../../model/game';
import { GameService } from './../../service/game.service';
import { GameSettings } from './../../model/game-settings';
import { GameSettingsComponent } from './../../component/game-settings/game-settings.component';
import { ModalController } from '@ionic/angular';
import { System } from 'yagb-core/src/emulator/system';

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
        return this.gameService.getAllGames().sort((g1, g2) => g1.name.localeCompare(g2.name));
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

    deleteGame(game: Game): void {
        this.gameService.deleteGame(game);
    }

    resetGame(game: Game): void {}

    importGame(): void {
        this.fileService.openFile(this.handleFile.bind(this), '.gb');
    }

    private async handleFile(data: Uint8Array, name: string): Promise<void> {
        if (identifyCartridge(data, new System(() => undefined)) === undefined) {
            this.alertService.errorMessage('This file is not a supported cartridge.');
            return;
        }

        const game = await this.gameService.getByRom(data);
        if (game) {
            this.alertService.errorMessage(`Cartridge already imported as "${game.name}".`);
            return;
        }

        const settings: GameSettings = {
            name: this.disambiguateName(name.replace(/\.gb$/, '')),
        };

        const modal = await this.modalController.create({
            component: GameSettingsComponent,
            componentProps: {
                settings,
                onSave: () => {
                    modal.dismiss();
                    this.addNewGame(settings, data);
                },
                onCancel: () => modal.dismiss(),
            },
        });

        await modal.present();
    }

    private disambiguateName(name: string) {
        let newName = name;
        let i = 1;

        while (this.gameService.getAllGames().some((game) => game.name === newName)) {
            newName = `${name} (${i++})`;
        }

        return newName;
    }

    private addNewGame(settings: GameSettings, rom: Uint8Array): void {
        this.gameService.addGameFromRom(settings, rom);
    }
}
