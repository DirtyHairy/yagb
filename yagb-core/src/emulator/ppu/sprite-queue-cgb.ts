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
    protected recordOamIndex(oamIndex: number, index: number): void {
        this.oamIndex[index] = oamIndex;
    }

    oamIndex = new Uint8Array(10);

    private vram16Banks: Array<Uint16Array>;
}
