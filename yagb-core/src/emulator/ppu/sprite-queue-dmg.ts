import { SpriteQueueBase } from './sprite-queue-base';

export class SpriteQueueDmg extends SpriteQueueBase {
    constructor(private vram: Uint8Array, oam: Uint8Array, public pal0: Uint32Array, public pal1: Uint32Array) {
        super(oam);
        this.vram16 = new Uint16Array(vram.buffer);
    }

    protected readTileData(flag: number, offset: number): number {
        return this.vram16[offset];
    }
    protected getPalette(flag: number): Uint32Array {
        return flag & 0x10 ? this.pal1 : this.pal0;
    }
    protected recordSortIndex(indexInOam: number, indexOrderedByX: number): void {}

    private vram16: Uint16Array;
}
