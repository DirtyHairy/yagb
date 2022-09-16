import { Dexie } from 'dexie';
import { Game } from './../model/game';
import { Injectable } from '@angular/core';
import { Rom } from './../model/rom';
import { SavestateContainer } from './../model/savestate-container';
import { environment } from './../../environments/environment';

@Injectable({ providedIn: 'root' })
export class Database extends Dexie {
    private game!: Dexie.Table<Game, string>;
    private rom!: Dexie.Table<Rom, string>;
    private savestate!: Dexie.Table<SavestateContainer, [string, string]>;

    constructor() {
        super(environment.databaseName);

        this.requestPersistentStorage();

        this.version(1).stores({
            game: 'romHash',
            rom: 'hash',
            snapshot: '[romHash+name], romHash',
        });
    }

    getAllGames(): Promise<Array<Game>> {
        return this.game.toArray();
    }

    getGameByRomHash(romHash: string): Promise<Game | undefined> {
        return this.game.get(romHash);
    }

    async putGame(game: Game): Promise<Game> {
        await this.game.put(game);

        return game;
    }

    async deleteGameByRomHash(romHash: string): Promise<void> {
        await this.game.delete(romHash);
    }

    private async requestPersistentStorage() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(navigator.storage as any)?.persist || !(navigator.storage as any)?.persisted) {
            console.log('storage manager not supported; unable to request persistent storage');
        }

        try {
            if ((await navigator.storage.persisted()) || (await navigator.storage.persist())) {
                console.log('persistent storage enabled');
            } else {
                console.log('request for persistent storage denied by browser');
            }
        } catch (e) {
            console.warn(e);
            console.log('failed to request persistent storage');
        }
    }
}
