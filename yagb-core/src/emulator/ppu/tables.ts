export const REVERSE = new Uint8Array(0x100);

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
