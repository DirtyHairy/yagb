import { LastRom } from './last-rom';
export interface KVSItemLastRom {
    key: 'last-rom';
    data: LastRom;
}
export type KVSItem = KVSItemLastRom;

export type KVSKey = KVSItem['key'];
