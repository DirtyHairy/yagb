import { KVSItem, KVSKey } from './kvs';

import { Dexie } from 'dexie';
import { NvsEntry } from './nvs-entry';
import { Snapshot } from './snapshot';

export class Database extends Dexie {
    constructor() {
        super('yagb-cli');

        this.version(1).stores({
            kvs: 'key',
            nvs: 'rom',
            snapshot: '[rom+name], rom',
        });
    }

    kvs!: Dexie.Table<KVSItem, KVSKey>;
    nvs!: Dexie.Table<NvsEntry, string>;
    snapshot!: Dexie.Table<Snapshot, [string, string]>;
}
