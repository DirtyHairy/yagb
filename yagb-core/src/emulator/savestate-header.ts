import { Mode } from './mode';
import { Savestate } from './savestate';

const SAVESTATE_VERSION = 0x01;
const SAVESTATE_OFFSET = 0x80;

export class SavestateHeader {
    constructor(public readonly mode: Mode) {}

    save(savestate: Savestate): void {
        savestate.startChunk(SAVESTATE_OFFSET + SAVESTATE_VERSION).write16(this.mode);
    }

    static load(savestate: Savestate): SavestateHeader {
        let version = savestate.validateChunk(SAVESTATE_VERSION + SAVESTATE_OFFSET);

        if (version < SAVESTATE_OFFSET) {
            savestate.reset();
            return new SavestateHeader(Mode.dmg);
        }

        version -= SAVESTATE_OFFSET;

        // The first version of the header contained a version field that I
        // subsequently removed
        if (version === 0x00) savestate.read16();
        const mode = savestate.read16();

        return new SavestateHeader(mode);
    }
}
