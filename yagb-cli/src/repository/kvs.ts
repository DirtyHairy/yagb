import { LastRom } from './last-rom';
import { PreferredModel } from 'yagb-core/src/emulator/emulator';

export interface KVSItemLastRom {
    key: 'last-rom';
    data: LastRom;
}

export interface KVSItemVolume {
    key: 'volume';
    data: number;
}

export interface KVSItemPreferredModel {
    key: 'preferred-model';
    data: PreferredModel;
}

export interface KVSItemMergeFrames {
    key: 'merge-frames';
    data: boolean;
}

export type KVSItem = KVSItemLastRom | KVSItemVolume | KVSItemPreferredModel | KVSItemMergeFrames;

export type KVSKey = KVSItem['key'];
