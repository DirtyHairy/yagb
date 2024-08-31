import { Event } from 'microevent.ts';
import { key } from 'yagb-core/src/emulator/joypad';

const AXIS_THRESHOLD = 0.5;

interface Mapping {
    buttons: Array<key>;
    axes: Array<[key, key] | undefined>;
}

// "standard" gamepad mappings
function buttonMapping(index: number): key {
    switch (index) {
        case 14:
            return key.left;

        case 15:
            return key.right;

        case 12:
            return key.up;

        case 13:
            return key.down;

        case 1:
        case 3:
        case 5:
        case 7:
            return key.a;

        case 0:
        case 2:
        case 4:
        case 6:
            return key.b;

        case 8:
            return key.select;

        case 9:
            return key.start;

        default:
            return key.invalid;
    }
}

function axisMapping(index: number): [key, key] | undefined {
    switch (index) {
        case 2:
        case 0:
            return [key.left, key.right];
        case 3:
        case 1:
            return [key.up, key.down];

        default:
            return undefined;
    }
}

export class GamepadDriver {
    update(): void {
        if (!navigator.getGamepads) return;

        this.newState.fill(0);

        Array.from(navigator.getGamepads()).forEach((gamepad, i) => {
            if (gamepad) this.updateFromGamepad(gamepad, i);
            else this.mappings[i] = undefined;
        });

        for (let i = 0; i < 8; i++) {
            if (this.newState[i] ^ this.oldState[i]) this.newState[i] ? this.onKeyDown.dispatch(i) : this.onKeyUp.dispatch(i);
            this.oldState[i] = this.newState[i];
        }
    }

    private updateFromGamepad(gamepad: Gamepad, index: number): void {
        if (!this.mappings[index]) this.mappings[index] = this.getMapping(gamepad);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const mapping = this.mappings[index]!;

        gamepad.buttons.forEach((button, i) => mapping.buttons[i] >= 0 && (this.newState[mapping.buttons[i]] |= +button.pressed));
        gamepad.axes.forEach((axis, i) => {
            const axisMapping = mapping.axes[i];
            if (!axisMapping) return;

            if (axis < -AXIS_THRESHOLD) this.newState[axisMapping[0]] = 1;
            if (axis > AXIS_THRESHOLD) this.newState[axisMapping[1]] = 1;
        });
    }

    private getMapping(gamepad: Gamepad): Mapping {
        return {
            buttons: gamepad.buttons.map((_, i) => buttonMapping(i)),
            axes: gamepad.axes.map((_, i) => axisMapping(i)),
        };
    }

    readonly onKeyDown = new Event<key>();
    readonly onKeyUp = new Event<key>();

    private oldState = new Uint8Array(8);
    private newState = new Uint8Array(8);
    private mappings = new Array<Mapping | undefined>();
}
