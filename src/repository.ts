import { Database } from './repository/database';
import { Event } from 'microevent.ts';
import { LastRom } from './repository/last-rom';
import { Mutex } from 'async-mutex';
import { decodeBase64 } from './helper/base64';

const STORAGE_KEY_YAGB_CARTERIDGE_DATA = 'yagb-cartridge-data';
const STORAGE_KEY_YAGB_CARTERIDGE_NAME = 'yagb-cartridge-name';

const SNAPSHOT_AUTO = 'autosave';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function guard(): any {
    return (target: unknown, propertyKey: string, desc: PropertyDescriptor) => {
        const oldMethod = desc.value;

        desc.value = async function (this: Repository) {
            try {
                // eslint-disable-next-line prefer-rest-params
                return await oldMethod.apply(this, arguments);
            } catch (e: unknown) {
                console.error(e);
                this.onError.dispatch('IndexedDB failed');
            }
        };

        return desc;
    };
}

export class Repository {
    @guard()
    async getLastRom(): Promise<LastRom | undefined> {
        return (await this.getLastRomDB()) || (await this.getLastRomLocalStorage());
    }

    @guard()
    async setLastRom(lastRom: LastRom): Promise<void> {
        await this.db.kvs.put({ key: 'last-rom', data: lastRom });
    }

    @guard()
    async getVolume(): Promise<number | undefined> {
        return (await this.db.kvs.get('volume'))?.data as number;
    }

    @guard()
    async setVolume(volume: number): Promise<void> {
        await this.db.kvs.put({ key: 'volume', data: volume });
    }

    @guard()
    saveState(romHash: string, savestate: Uint8Array, nvData: Uint8Array | undefined): Promise<void> {
        let _savestate: Uint8Array;
        let _nvData: Uint8Array | undefined;

        if (!this.savestateTemporary || this.savestateTemporary.length !== savestate.length) {
            _savestate = savestate.slice();
        } else {
            this.savestateTemporary.set(savestate);
            _savestate = this.savestateTemporary;
        }

        this.savestateTemporary = undefined;

        if (nvData && (!this.nvDataTemporary || this.nvDataTemporary.length !== nvData.length)) {
            _nvData = nvData.slice();
        } else if (nvData && this.nvDataTemporary) {
            this.nvDataTemporary.set(nvData);
            _nvData = nvData;
        }

        this.nvDataTemporary = undefined;

        return this.saveStateMutex.runExclusive(() =>
            this.db.transaction('rw', this.db.snapshot, this.db.nvs, async () => {
                await this.db.snapshot.put({ name: SNAPSHOT_AUTO, rom: romHash, data: _savestate });

                if (_nvData) await this.db.nvs.put({ rom: romHash, data: _nvData });

                this.savestateTemporary = _savestate;
                this.nvDataTemporary = _nvData;
            })
        );
    }

    @guard()
    removeSavestate(romHash: string): Promise<void> {
        return this.saveStateMutex.runExclusive(() => this.db.snapshot.delete([romHash, SNAPSHOT_AUTO]));
    }

    @guard()
    async getSavestate(romHash: string): Promise<Uint8Array | undefined> {
        return (await this.db.snapshot.get([romHash, SNAPSHOT_AUTO]))?.data as Uint8Array;
    }

    @guard()
    async getNvsData(romHash: string): Promise<Uint8Array | undefined> {
        const data = (await this.db.nvs.get(romHash))?.data;
        if (data) return data;

        const serializedData = localStorage.getItem('ram_' + romHash);
        if (!serializedData) return undefined;

        try {
            return await decodeBase64(serializedData);
        } catch (e) {
            console.error(e);
            return undefined;
        }
    }

    private async getLastRomDB(): Promise<LastRom | undefined> {
        const itemLastRom = await this.db.kvs.get('last-rom');
        if (!itemLastRom) return undefined;

        return itemLastRom.data as LastRom;
    }

    private async getLastRomLocalStorage(): Promise<LastRom | undefined> {
        const name = localStorage.getItem(STORAGE_KEY_YAGB_CARTERIDGE_NAME);
        const dataEncoded = localStorage.getItem(STORAGE_KEY_YAGB_CARTERIDGE_DATA);

        if (!(name && dataEncoded)) return undefined;

        try {
            return { name, data: await decodeBase64(dataEncoded) };
        } catch (e) {
            console.error(e);
            return undefined;
        }
    }

    onError = new Event<string>();
    saveStateMutex = new Mutex();

    private savestateTemporary: Uint8Array | undefined = undefined;
    private nvDataTemporary: Uint8Array | undefined = undefined;

    private db = new Database();
}
