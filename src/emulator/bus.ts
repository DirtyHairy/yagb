import { SystemInterface } from './system';
import { hex16 } from '../helper/format';

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

    private invalidRead: ReadHandler = (address) => {
        this.system.break(`invalid read from ${hex16(address)}`);

        return 0;
    };

    private invalidWrite: WriteHandler = (address) => {
        this.system.break(`invalid write to ${hex16(address)}`);
    };

    public readonly readMap = new Array<ReadHandler>(0x10000);
    public readonly writeMap = new Array<WriteHandler>(0x10000);
}
