import { COLOR_MAPPING } from './color-mapping';

export class Cram {
    constructor(private initialFill: number) {
        this.data.fill(initialFill);
        this.data16 = new Uint16Array(this.data.buffer);

        for (let i = 0; i < 8; i++) this.palettes[i] = new Uint32Array(4);
    }

    load(cram: Uint8Array) {
        this.data.set(cram);
        this.dirty.fill(true);
    }

    reset() {
        this.data.fill(this.initialFill);
        this.dirty.fill(true);
    }

    write(address: number, value: number) {
        this.data[address] = value;
        this.dirty[address >>> 3] = true;
    }

    read(address: number): number {
        return this.data[address];
    }

    updatePalette(index: number): void {
        const palette = this.palettes[index];

        for (let i = 0; i < 4; i++) palette[i] = COLOR_MAPPING[this.data16[4 * index + i] & 0x7fff];
        this.dirty[index] = false;
    }

    getPalette(index: number): Uint32Array {
        if (this.dirty[index]) this.updatePalette(index);

        return this.palettes[index];
    }

    private palettes = new Array<Uint32Array>(8);
    private dirty = new Array<boolean>(8).fill(true);

    readonly data = new Uint8Array(0x40);
    private data16: Uint16Array;
}
