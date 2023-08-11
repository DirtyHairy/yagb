import { Database } from './repository/database';
import { Event } from 'microevent.ts';
import { LastRom } from './repository/last-rom';
import { Mode } from 'yagb-core/src/emulator/mode';
import { Mutex } from 'async-mutex';
import { PreferredModel } from 'yagb-core/src/emulator/emulator';
import { RomSettings } from './repository/romSettings';
import { decodeBase64 } from './helper/base64';

const STORAGE_KEY_YAGB_CARTERIDGE_DATA = 'yagb-cartridge-data';
const STORAGE_KEY_YAGB_CARTERIDGE_NAME = 'yagb-cartridge-name';

function modeSuffix(mode: Mode): string {
    switch (mode) {
        case Mode.cgb:
        case Mode.cgbcompat:
            return 'cgb';

        case Mode.dmg:
            return 'dmg';

        default:
            throw new Error('unreachable');
    }
}

function SNAPSHOT_AUTO(mode?: Mode) {
    return mode !== undefined ? `autosave-${modeSuffix(mode)}` : 'autosave';
}

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
    async getPreferredModel(): Promise<PreferredModel | undefined> {
        return (await this.db.kvs.get('preferred-model'))?.data as PreferredModel;
    }

    @guard()
    async setPreferredModel(preferredModel: PreferredModel): Promise<void> {
        await this.db.kvs.put({ key: 'preferred-model', data: preferredModel });
    }

    @guard()
    async getMergeFrames(): Promise<boolean> {
        return ((await this.db.kvs.get('merge-frames'))?.data as boolean) ?? true;
    }

    @guard()
    async setMergeFrames(mergeFrames: boolean): Promise<void> {
        await this.db.kvs.put({ key: 'merge-frames', data: mergeFrames });
    }

    @guard()
    saveState(romHash: string, savestate: Uint8Array, nvData: Uint8Array | undefined, mode: Mode): Promise<void> {
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
                await this.db.snapshot.put({
                    name: SNAPSHOT_AUTO(mode),
                    rom: romHash,
                    data: _savestate,
                });

                if (_nvData) await this.db.nvs.put({ rom: romHash, data: _nvData });

                this.savestateTemporary = _savestate;
                this.nvDataTemporary = _nvData;
            })
        );
    }

    @guard()
    async removeSavestate(romHash: string): Promise<void> {
        await this.saveStateMutex.runExclusive(() =>
            Promise.all([
                this.db.snapshot.delete([romHash, SNAPSHOT_AUTO(Mode.cgb)]),
                this.db.snapshot.delete([romHash, SNAPSHOT_AUTO(Mode.dmg)]),
                this.db.snapshot.delete([romHash, SNAPSHOT_AUTO()]),
            ])
        );
    }

    @guard()
    async listSnapshots(romHash: string): Promise<Array<string>> {
        return (await this.db.snapshot.where('rom').equals(romHash).toArray()).map((x) => x.name);
    }

    @guard()
    async deleteSnapshot(romHash: string, name: string): Promise<void> {
        await this.db.snapshot.delete([romHash, name]);
    }

    @guard()
    async saveSnapshot(romHash: string, name: string, data: Uint8Array): Promise<void> {
        await this.db.snapshot.put({ rom: romHash, name, data });
    }

    @guard()
    async getSnapshot(romHash: string, name: string): Promise<Uint8Array | undefined> {
        return (await this.db.snapshot.get([romHash, name]))?.data;
    }

    @guard()
    async getSavestate(romHash: string, mode: Mode): Promise<Uint8Array | undefined> {
        const snapshot = await this.db.snapshot.get([romHash, SNAPSHOT_AUTO(mode)]);
        if (snapshot) {
            return snapshot.data;
        }

        return mode === Mode.dmg ? (await this.db.snapshot.get([romHash, SNAPSHOT_AUTO()]))?.data : undefined;
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

    @guard()
    async getRomSettings(romHash: string): Promise<RomSettings | undefined> {
        return this.db.romSettings.get(romHash);
    }

    @guard()
    async saveRomSettings(settings: RomSettings): Promise<void> {
        await this.db.romSettings.put(settings);
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
