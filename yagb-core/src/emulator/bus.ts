import { hex16, hex8 } from '../helper/format';

import { Event } from 'microevent.ts';
import { Savestate } from './savestate';
import { System } from './system';

export type ReadHandler = (address: number) => number;
export type WriteHandler = (address: number, value: number) => void;

const SAVESTATE_VERSION = 0x01;

export class Bus {
    constructor(private system: System) {
        for (let i = 0; i < 0x10000; i++) {
            this.readMap[i] = this.invalidRead;
            this.writeMap[i] = this.invalidWrite;
        }
    }

    save(savestate: Savestate) {
        savestate.startChunk(SAVESTATE_VERSION).writeBool(this.locked);
    }

    load(savestate: Savestate) {
        if (savestate.bytesRemaining() === 0) {
            this.locked = false;
            return;
        }

        savestate.validateChunk(SAVESTATE_VERSION);
        this.locked = savestate.readBool();
    }

    read(address: number): number {
        this.onRead.dispatch(address);

        if (this.locked && (address < 0xff80 || address === 0xffff)) return 0xff;

        return this.readMap[address](address);
    }

    write(address: number, value: number): void {
        this.onWrite.dispatch(address);

        if (this.locked && (address < 0xff80 || address === 0xffff)) return;

        this.writeMap[address](address, value);
    }

    write16(address: number, value: number): void {
        this.write(address, value & 0xff);
        this.write((address + 1) & 0xffff, (value >>> 8) & 0xff);
    }

    read16(address: number): number {
        return this.read(address) | (this.read((address + 1) & 0xffff) << 8);
    }

    map(address: number, read: ReadHandler, write: WriteHandler): void {
        this.readMap[address] = read;
        this.writeMap[address] = write;
    }

    lock(): void {
        this.locked = true;
    }

    isLocked(): boolean {
        return this.locked;
    }

    unlock(): void {
        this.locked = false;
    }

    reset(): void {
        this.locked = false;
    }

    private invalidRead: ReadHandler = (address) => {
        this.system.trap(`unmapped read from ${hex16(address)}`);

        return 0;
    };

    private invalidWrite: WriteHandler = (address, value) => {
        this.system.trap(`unmapped write of ${hex8(value)} to ${hex16(address)}`);
    };

    readonly onRead = new Event<number>();
    readonly onWrite = new Event<number>();

    private readonly readMap = new Array<ReadHandler>(0x10000);
    private readonly writeMap = new Array<WriteHandler>(0x10000);

    private locked = false;
}
