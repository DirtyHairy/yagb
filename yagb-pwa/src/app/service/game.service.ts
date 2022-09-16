import { Database } from './database.service';
import { Game } from '../model/game';
import { GameSettings } from '../model/game-settings';
import { Injectable } from '@angular/core';
import { System } from 'yagb-core/src/emulator/system';
import { createCartridge } from 'yagb-core/src/emulator/cartridge';
import md5 from 'md5';

@Injectable({ providedIn: 'root' })
export class GameService {
    private games: Array<Game> = [];

    constructor(private database: Database) {
        this.updateGames();
    }

    getAllGames(): Array<Game> {
        return JSON.parse(JSON.stringify(this.games));
    }

    isLoading(): boolean {
        return false;
    }

    async getByRom(rom: Uint8Array): Promise<Game | undefined> {
        return this.database.getGameByRomHash(md5(rom));
    }

    async addGameFromRom(settings: GameSettings, rom: Uint8Array): Promise<Game> {
        const cartridge = createCartridge(rom, new System(() => undefined));
        if (cartridge === undefined) {
            throw new Error('cannot happen: invalid ROM');
        }

        const game: Game = {
            name: settings.name,
            romHash: md5(rom),
            romInfo: cartridge.describe(),
        };

        await this.database.putGame(game);
        await this.updateGames();

        return game;
    }

    async deleteGame(game: Game): Promise<void> {
        await this.database.deleteGameByRomHash(game.romHash);
        await this.updateGames();
    }

    async updateGame(game: Game): Promise<void> {
        await this.database.putGame(game);
        await this.updateGames();
    }

    private async updateGames(): Promise<void> {
        this.games = await this.database.getAllGames();
    }
}
