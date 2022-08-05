import { Game } from '../model/game';
import { GameSettings } from '../model/game-settings';
import { Injectable } from '@angular/core';
import { System } from 'yagb-core/src/emulator/system';
import { createCartridge } from 'yagb-core/src/emulator/cartridge';
import md5 from 'md5';

@Injectable({ providedIn: 'root' })
export class GameService {
    private games: Array<Game> = [];
    private nextId = 0;

    getAllGames(): Array<Game> {
        return JSON.parse(JSON.stringify(this.games));
    }

    isLoading(): boolean {
        return false;
    }

    async addGameFromRom(settings: GameSettings, rom: Uint8Array): Promise<Game> {
        const cartridge = createCartridge(rom, new System(() => undefined));
        if (cartridge === undefined) {
            throw new Error('cannot happen: invalid ROM');
        }

        const game: Game = {
            id: this.nextId++,
            name: settings.name,
            romHash: md5(rom),
            romInfo: cartridge.describe(),
        };

        this.games.push(game);

        return game;
    }

    async deleteGame(game: Game): Promise<void> {
        this.games = this.games.filter((g) => g.id !== game.id);
    }

    async updateGame(game: Game): Promise<void> {
        this.games = this.games.map((g) => (g.id === game.id ? game : g));
    }
}
