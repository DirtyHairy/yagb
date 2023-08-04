import { KVSItem, KVSKey } from './kvs';

import { Dexie } from 'dexie';
import { NvsEntry } from './nvs-entry';
import { RomSettings } from './romSettings';
import { Snapshot } from './snapshot';

export class Database extends Dexie {
    constructor() {
        super('yagb-cli');

        this.requestPersistentStorage();

        this.version(2).stores({
            kvs: 'key',
            nvs: 'rom',
            snapshot: '[rom+name], rom',
            romSettings: 'rom',
        });
    }

    private async requestPersistentStorage() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(navigator.storage as any)?.persist || !(navigator.storage as any)?.persisted) {
            console.log('storage manager not supported; unable to request persistent storage');
        }

        try {
            if ((await navigator.storage.persisted()) || (await navigator.storage.persist())) {
                console.log('persistent storage enabled');
            } else {
                console.log('request for persistent storage denied by browser');
            }
        } catch (e) {
            console.warn(e);
            console.log('failed to request persistent storage');
        }
    }

    kvs!: Dexie.Table<KVSItem, KVSKey>;
    nvs!: Dexie.Table<NvsEntry, string>;
    snapshot!: Dexie.Table<Snapshot, [string, string]>;
    romSettings!: Dexie.Table<RomSettings, string>;
}
