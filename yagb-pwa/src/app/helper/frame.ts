import { PALETTE_CLASSIC } from './../../../../yagb-core/src/emulator/palette';

const LOOKUP = new Uint32Array(256);
LOOKUP.fill(0);

for (let i = 0; i < PALETTE_CLASSIC.length; i++) {
    const entry = PALETTE_CLASSIC[i];

    LOOKUP[entry & 0xff] = i;
}

export function compressFrame(data: ArrayBuffer | undefined): ArrayBuffer | undefined {
    if (!data) {
        return undefined;
    }

    if (data.byteLength !== 4 * 160 * 144) {
        console.error('invalid frame data');
        return undefined;
    }

    const data32 = new Uint32Array(data);
    const compressed = new Uint8Array((160 * 144) / 2);

    for (let i = 0; i < (160 * 144) / 2; i++) {
        compressed[i] = LOOKUP[data32[2 * i] & 0xff] | (LOOKUP[data32[2 * i + 1] & 0xff] << 4);
    }

    return compressed.buffer;
}

export function decompressFrame(compressed: ArrayBuffer | undefined): ArrayBuffer | undefined {
    if (!compressed) {
        return undefined;
    }

    if (compressed.byteLength !== (160 * 144) / 2) {
        console.error('invalid compressed frame data');
        return undefined;
    }

    const data32 = new Uint32Array(160 * 144);
    const compressed8 = new Uint8Array(compressed);

    for (let i = 0; i < (160 * 144) / 2; i++) {
        data32[2 * i] = PALETTE_CLASSIC[compressed8[i] & 0x0f];
        data32[2 * i + 1] = PALETTE_CLASSIC[compressed8[i] >>> 4];
    }

    return data32.buffer;
}
