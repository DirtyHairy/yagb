import { Game } from '../model/game';
import { Injectable } from '@angular/core';

const GAMES_MOCK: Array<Game> = [
    {
        name: 'Super Mario Land',
        romHash: 'abc1',
        romInfo: '64kb MBC2',
    },
    {
        name: 'Tetris',
        romHash: 'abc2',
        romInfo: '16kb MBC1',
    },
    {
        name: 'Super Mario Land 2: Six Golden Coins',
        romHash: 'abc3',
        romInfo: '256kb MBC2, 16kb RAM',
    },
];

@Injectable({ providedIn: 'root' })
export class GameService {
    getGames(): Array<Game> {
        return [];
    }

    isLoading(): boolean {
        return false;
    }
}
