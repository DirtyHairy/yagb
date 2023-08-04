import { PreferredModel } from 'yagb-core/src/emulator/emulator';

export interface RomSettings {
    rom: string;
    preferredModel?: PreferredModel;
}
