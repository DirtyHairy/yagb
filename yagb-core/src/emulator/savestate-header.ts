import { Mode } from './mode';
import { Savestate } from './savestate';

const SAVESTATE_VERSION = 0x00;
const SAVESTATE_OFFSET = 0x80;

export class SavestateHeader {
    constructor(public readonly mode: Mode = Mode.dmg, public readonly version = 0) {}

    save(savestate: Savestate): void {
        savestate
            .startChunk(SAVESTATE_OFFSET + SAVESTATE_VERSION)
            .write16(this.version)
            .write16(this.mode);
    }

    static load(savestate: Savestate): SavestateHeader {
        const version = savestate.validateChunk(SAVESTATE_VERSION + SAVESTATE_OFFSET);

        if (version < SAVESTATE_OFFSET) {
            savestate.reset();
            return new SavestateHeader();
        }

        const headerVersion = savestate.read16();
        const mode = savestate.read16();

        return new SavestateHeader(mode, version);
    }
}
