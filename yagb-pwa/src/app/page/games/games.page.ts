import { AlertController, ModalController } from '@ionic/angular';

import { AlertService } from './../../service/alert.service';
import { Component } from '@angular/core';
import { EmulationService } from './../../service/emulation.service';
import { FileService } from './../../service/file.service';
import { Game } from './../../model/game';
import { GameService } from './../../service/game.service';
import { GameSettings } from './../../model/game-settings';
import { GameSettingsComponent } from './../../component/game-settings/game-settings.component';
import { Router } from '@angular/router';
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
        private modalController: ModalController,
        private alertController: AlertController,
        private emulationService: EmulationService,
        private router: Router
    ) {}

    get games(): Array<Game> {
        return this.gameService.getAllGames().sort((g1, g2) => g1.name.localeCompare(g2.name));
    }

    get loading(): boolean {
        return this.gameService.isLoading();
    }

    get currentGameRomHash(): string {
        return this.gameService.getCurrentGame()?.romHash || '';
    }

    trackGameBy(index: number, game: Game) {
        return game.romHash;
    }

    launchGame(game: Game): void {
        this.gameService.setCurrentGame(game);
        this.router.navigateByUrl('/tab/play');
    }

    async editGame(game: Game): Promise<void> {
        const settings: GameSettings = {
            name: game.name,
        };

        const modal = await this.modalController.create({
            component: GameSettingsComponent,
            componentProps: {
                settings,
                onSave: () => {
                    modal.dismiss();
                    this.gameService.updateGame({ ...game, name: settings.name });
                },
                onCancel: () => modal.dismiss(),
            },
        });

        await modal.present();
    }

    async deleteGame(game: Game): Promise<void> {
        const alert = await this.alertController.create({
            header: 'Warning',
            message: `Deleting the game '${game.name}' will remove it and all associated save states. This cannot be undone. Are you sure you want to continue?`,
            buttons: [
                { text: 'Cancel', role: 'cancel' },
                { text: 'Delete', handler: () => this.gameService.deleteGame(game) },
            ],
        });

        await alert.present();
    }

    resetGame(game: Game): void {}

    importGame(): void {
        this.fileService.openFile(this.handleFile.bind(this), '.gb,.gbc');
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
            name: this.disambiguateName(name.replace(/\.gbc?$/, '')),
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
