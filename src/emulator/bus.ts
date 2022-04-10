import { hex16, hex8 } from '../helper/format';

import { Event } from 'microevent.ts';
import { SystemInterface } from './system';

export type ReadHandler = (address: number) => number;
export type WriteHandler = (address: number, value: number) => void;

export class Bus {
    constructor(private system: SystemInterface) {
        for (let i = 0; i < 0x10000; i++) {
            this.readMap[i] = this.invalidRead;
            this.writeMap[i] = this.invalidWrite;
        }
    }

    read(address: number): number {
        this.onRead.dispatch(address);
        return this.readMap[address](address);
    }

    write(address: number, value: number): void {
        this.onWrite.dispatch(address);
        this.writeMap[address](address, value);
    }

    read16(address: number): number {
        return this.read(address) | (this.read((address + 1) & 0xffff) << 8);
    }

    map(address: number, read: ReadHandler, write: WriteHandler): void {
        this.readMap[address] = read;
        this.writeMap[address] = write;
    }

    private invalidRead: ReadHandler = (address) => {
        this.system.break(`invalid read from ${hex16(address)}`);

        return 0;
    };

    private invalidWrite: WriteHandler = (address, value) => {
        this.system.break(`invalid write of ${hex8(value)} to ${hex16(address)}`);
    };

    readonly onRead = new Event<number>();
    readonly onWrite = new Event<number>();

    private readonly readMap = new Array<ReadHandler>(0x10000);
    private readonly writeMap = new Array<WriteHandler>(0x10000);
}
