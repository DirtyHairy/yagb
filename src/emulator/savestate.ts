const CHUNK_MAGIC = 0x1234;

function wordCount(byteCount: number): number {
    return byteCount % 2 === 0 ? byteCount >>> 1 : (byteCount >>> 1) + 1;
}

export class Savestate {
    constructor(private buffer8: Uint8Array) {
        this.buffer16 = new Uint16Array(this.buffer8.buffer);
        this.capacity16 = buffer8.length >>> 1;
    }

    reset() {
        this.offset16 = 0;
        this.chunkId = 0;
    }

    getBuffer(): Uint8Array {
        return this.buffer8;
    }

    getLength(): number {
        return this.offset16 * 2;
    }

    startChunk(version: number): this {
        this.write16((((this.chunkId++ & 0xff) << 8) | (version & 0xff)) ^ CHUNK_MAGIC);

        return this;
    }

    write16(value: number): this {
        this.assertWordsAvailable(1);

        this.buffer16[this.offset16++] = value;

        return this;
    }

    writeBool(value: boolean): this {
        return this.write16(value ? 1 : 0);
    }

    writeBuffer(buffer: Uint8Array): this {
        const words = wordCount(buffer.length);
        this.assertWordsAvailable(words);

        this.buffer8.set(buffer, this.offset16 * 2);
        this.offset16 += words;

        return this;
    }

    validateChunk(maxVersion: number): number {
        const chunkWord = this.read16() ^ CHUNK_MAGIC;
        const chunkId = chunkWord >>> 8;
        const version = chunkWord & 0xff;

        if (chunkId >>> 8 !== this.chunkId++) {
            throw new Error(`invalid chunk ID; expected ${chunkId - 1}, got ${chunkId}`);
        }

        if (version > maxVersion) {
            throw new Error(`invalid chunk version, expected max ${maxVersion}, got ${version}`);
        }

        return version;
    }

    read16(): number {
        this.assertWordsAvailable(1);

        return this.buffer16[this.offset16++];
    }

    readBool(): boolean {
        return this.read16() !== 0;
    }

    readBuffer(size: number): Uint8Array {
        const words = wordCount(size);
        this.assertWordsAvailable(words);

        const result = this.buffer8.subarray(this.offset16 * 2, this.offset16 * 2 + length);
        this.offset16 += words;

        return result;
    }

    private assertWordsAvailable(wordCount: number) {
        if (this.offset16 + wordCount > this.capacity16) {
            throw new Error('savestate capacity exceeded');
        }
    }

    private buffer16: Uint16Array;
    private offset16 = 0;
    private capacity16: number;

    private chunkId = 0;
}
