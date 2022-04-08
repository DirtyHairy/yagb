import { hex16, hex8 } from '../helper/format';

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
        return this.readMap[address](address);
    }

    write(address: number, value: number): void {
        this.writeMap[address](address, value);
    }

    read16(address: number): number {
        return this.read(address) | (this.read((address + 1) & 0xffff) << 8);
    }

    private invalidRead: ReadHandler = (address) => {
        this.system.break(`invalid read from ${hex16(address)}`);

        return 0;
    };

    private invalidWrite: WriteHandler = (address, value) => {
        this.system.break(`invalid write of ${hex8(value)} to ${hex16(address)}`);
    };

    public readonly readMap = new Array<ReadHandler>(0x10000);
    public readonly writeMap = new Array<WriteHandler>(0x10000);
}
