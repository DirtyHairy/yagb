import { environment } from './../../environments/environment';
const KEY = environment.localStoragePrefix + '-current-game';

export function getCurrentGame(): string {
    return localStorage.getItem(KEY);
}

export function hasCurrentGame(): boolean {
    return localStorage.getItem(KEY) !== null;
}

export function setCurrentGame(hash: string): void {
    localStorage.setItem(KEY, hash);
}

export function clearCurrentGame(): void {
    localStorage.removeItem(KEY);
}
