import { Emulator } from 'yagb-core/src/emulator/emulator';
import { Event } from 'microevent.ts';
import { Injectable } from '@angular/core';
import { key } from 'yagb-core/src/emulator/joypad';

@Injectable({ providedIn: 'root' })
export class KeyboardService {
    onUnhandledKey = new Event<string>();

    private emulator: Emulator | undefined;

    bind(emulator: Emulator): void {
        this.unbind();
        if (!emulator) {
            return;
        }

        this.emulator = emulator;

        window.addEventListener('keydown', this.onKeydown);
        window.addEventListener('keyup', this.onKeyup);
    }

    unbind(): void {
        this.emulator = undefined;

        window.removeEventListener('keydown', this.onKeydown);
        window.removeEventListener('keyup', this.onKeyup);
    }

    private getKey(code: string): key | undefined {
        switch (code) {
            case 'Enter':
                return key.start;

            case ' ':
                return key.select;

            case 's':
            case 'x':
                return key.a;

            case 'a':
            case 'y':
            case 'z':
                return key.b;

            case 'ArrowLeft':
                return key.left;

            case 'ArrowRight':
                return key.right;

            case 'ArrowUp':
                return key.up;

            case 'ArrowDown':
                return key.down;

            default:
                return undefined;
        }
    }

    private onKeydown = (e: KeyboardEvent) => {
        const mappedKey = this.getKey(e.key);
        if (mappedKey === undefined) {
            this.onUnhandledKey.dispatch(e.key);
        }

        if (mappedKey !== undefined && this.emulator !== undefined) {
            this.emulator.keyDown(mappedKey);
            e.preventDefault();
        }
    };

    private onKeyup = (e: KeyboardEvent) => {
        const mappedKey = this.getKey(e.key);

        if (mappedKey !== undefined && this.emulator !== undefined) {
            this.emulator.keyUp(mappedKey);
            e.preventDefault();
        }
    };
}
