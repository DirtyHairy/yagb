const REVERSE = new Uint8Array(0x100);
for (let i = 0; i < 0x100; i++) {
    REVERSE[i] =
        ((i & 0x01) << 7) |
        ((i & 0x02) << 5) |
        ((i & 0x04) << 3) |
        ((i & 0x08) << 1) |
        ((i & 0x10) >>> 1) |
        ((i & 0x20) >>> 3) |
        ((i & 0x40) >>> 5) |
        ((i & 0x80) >>> 7);
}

export class SpriteQueue {
    constructor(public vram: Uint8Array, public oam: Uint8Array, public pal0: Uint32Array, public pal1: Uint32Array) {
        this.vram16 = new Uint16Array(vram.buffer);
    }

    initialize(scanline: number, dblHeight: boolean) {
        this.length = 0;
        const height = dblHeight ? 16 : 8;

        // Pass 1: build and sort the sprite list
        //
        // We perform an insert sort on the visible sprites as we go through the list. sortBuffer
        // encodes a linked list of sprites that maps sprite index to the index of the next sprite.
        // Sprite 40 is a dummy and acts as the start of the list.
        //
        // For example, sortBuffer[40] = 11 means that sprite 11 is the leftmost visible sprite.
        // sortBuffer[11] = 25 means that sprite 25 is the next sprite, etc.
        //
        // We set sortBuffer[40] to 0xff in order to give it a well-defined value. We *could* traverse
        // the list by hopping through sortBuffer until we encounter 0xff (which acts as a terminator),
        // but we also keep its lenght (we need it for later anyway).
        this.sortBuffer[40] = 0xff;

        for (let i = 0; i < 40; i++) {
            // We store the calculated y in positionYCache for later usage
            const y = (this.postionYCache[i] = this.oam[4 * i] - 16);
            // Sprite not visible on this line? -> skip it
            if (y > scanline || y + height <= scanline) continue;

            // We store the calculated x in positionXCache for later usage
            const positionX = (this.postionXCache[i] = this.oam[4 * i + 1] - 8);

            // Insert into the list. Start with "sprite" 40 (which is prepared to have x larger than
            // all other sprites)
            let previousSprite = 40;

            // Note that this loop *never* reaches the terminating 0xff (and is not even executed when
            // the list is empty)
            for (let j = 0; j < this.length; j++) {
                // Get the index of the next sprite
                const nextSprite = this.sortBuffer[previousSprite];

                // Our x is larger?
                if (positionX > this.postionXCache[nextSprite]) {
                    // Larger? -> move to the next sprite in the list
                    previousSprite = nextSprite;
                } else {
                    // Not larger? We have found our insert position
                    break;
                }
            }

            // Grab the index of the sprite that used to come after previousSprite
            const nextSprite = this.sortBuffer[previousSprite];
            // Now, previousSprite is followed by i (the currentSprite) instead
            this.sortBuffer[previousSprite] = i;
            // Finally, point to nextSprite as the next entry
            this.sortBuffer[i] = nextSprite;

            // Keep a maximum of 10 sprites
            if (++this.length === 10) break;
        }

        // Pass 2: prepare sprite data
        //
        // We start traversing the list starting from "sprite" 40 (see above)
        let index = 40;
        for (let i = 0; i < this.length; i++) {
            index = this.sortBuffer[index];

            const flag = this.oam[4 * index + 3];
            // Account for flipped y
            const y = flag & 0x40 ? height - 1 - scanline + this.postionYCache[index] : scanline - this.postionYCache[index];

            const tileIndex = this.oam[4 * index + 2];
            const data = this.vram16[(dblHeight ? tileIndex & 0xfe : tileIndex) * 8 + y];

            // Account for flipped x by reversing data high and low bytes (but retain their order as they
            // represent the two bitplanes)
            this.data[i] = flag & 0x20 ? (REVERSE[data >>> 8] << 8) | REVERSE[data & 0xff] : data;

            this.positionX[i] = this.postionXCache[index];
            this.flag[i] = flag;
            this.palette[i] = flag & 0x10 ? this.pal1 : this.pal0;
        }
    }

    length = 0;
    data = new Uint16Array(10);
    positionX = new Int32Array(10);
    flag = new Uint8Array(10);
    palette = new Array<Uint32Array>(10);

    private sortBuffer = new Uint8Array(41);
    private postionXCache = new Int32Array(40);
    private postionYCache = new Int32Array(40);
    private vram16: Uint16Array;
}
