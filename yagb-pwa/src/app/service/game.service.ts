import { clearCurrentGame, setCurrentGame } from '../helper/currentGame';

import { Database } from './database.service';
import { Event } from 'microevent.ts';
import { Game } from '../model/game';
import { GameSettings } from '../model/game-settings';
import { Injectable } from '@angular/core';
import { System } from 'yagb-core/src/emulator/system';
import { createCartridge } from 'yagb-core/src/emulator/cartridge';
import md5 from 'md5';

@Injectable({ providedIn: 'root' })
export class GameService {
    private games: Array<Game> = [];
    private currentGame: Game | undefined;

    onClearCurrentGame = new Event<void>();

    constructor(private database: Database) {
        this.updateGames();
    }

    getCurrentGame(): Game | undefined {
        return this.currentGame;
    }

    setCurrentGame(game: Game): void {
        this.currentGame = game;
        setCurrentGame(game.romHash);
    }

    clearCurrentGame(): void {
        this.currentGame = undefined;
        clearCurrentGame();

        this.onClearCurrentGame.dispatch();
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

        await this.database.putGame(game, rom);
        await this.updateGames();

        return game;
    }

    async deleteGame(game: Game): Promise<void> {
        if (game.romHash === this.currentGame.romHash) {
            this.clearCurrentGame();
        }

        await this.database.deleteGameByRomHash(game.romHash);
        await this.updateGames();
    }

    async updateGame(game: Game): Promise<void> {
        await this.database.updateGame(game);
        await this.updateGames();
    }

    private async updateGames(): Promise<void> {
        this.games = await this.database.getAllGames();

        if (this.currentGame) {
            this.currentGame = await this.database.getGameByRomHash(this.currentGame.romHash);
        }
    }
}
