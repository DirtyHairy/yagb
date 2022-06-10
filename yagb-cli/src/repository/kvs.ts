import { LastRom } from './last-rom';

export interface KVSItemLastRom {
    key: 'last-rom';
    data: LastRom;
}

export interface KVSItemVolume {
    key: 'volume';
    data: number;
}

export type KVSItem = KVSItemLastRom | KVSItemVolume;

export type KVSKey = KVSItem['key'];
