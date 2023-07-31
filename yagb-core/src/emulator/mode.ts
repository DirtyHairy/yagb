export const enum Mode {
    dmg = 0,
    cgb = 1,
}

export function modeToString(mode: Mode): string {
    switch (mode) {
        case Mode.cgb:
            return 'cgb';

        case Mode.dmg:
            return 'dmg';

        default:
            throw new Error('unreachable');
    }
}
