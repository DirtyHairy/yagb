import { Cram } from './cram';
import { SpriteQueueBase } from './sprite-queue-base';

export class SpriteQueueCgb extends SpriteQueueBase {
    constructor(vramBanks: Array<Uint8Array>, oam: Uint8Array, private cram: Cram) {
        super(oam);

        this.vram16Banks = vramBanks.map((data) => new Uint16Array(data.buffer));
    }

    protected readTileData(flag: number, offset: number): number {
        return this.vram16Banks[(flag >>> 3) & 0x01][offset];
    }
    protected getPalette(flag: number): Uint32Array {
        return this.cram.getPalette(flag & 0x07);
    }
    protected recordSortIndex(indexInOam: number, indexOrderedByX: number): void {}

    private vram16Banks: Array<Uint16Array>;
}
