export const enum Mode {
    dmg = 0,
    cgb = 1,
    cgbcompat = 2,
}

export function modeToString(mode: Mode): string {
    switch (mode) {
        case Mode.cgb:
            return 'cgb';

        case Mode.dmg:
            return 'dmg';

        case Mode.cgbcompat:
            return 'cgbcompat';

        default:
            throw new Error('unreachable');
    }
}
