// The code below is ported from SameBoy and matches "modern accurate"

export const COLOR_MAPPING = new Uint32Array(0x8000);

const CHANNEL_LOOKUP = new Uint8Array([
    0, 6, 12, 20, 28, 36, 45, 56, 66, 76, 88, 100, 113, 125, 137, 149, 161, 172, 182, 192, 202, 210, 218, 225, 232, 238, 243, 247, 250, 252, 254, 255,
]);

const GAMMA = 2.2;

function convert(rgb555: number): number {
    const r = CHANNEL_LOOKUP[rgb555 & 0x1f];
    let g = CHANNEL_LOOKUP[(rgb555 >>> 5) & 0x1f];
    const b = CHANNEL_LOOKUP[(rgb555 >>> 10) & 0x1f];

    if (g !== b) g = Math.round(Math.pow((Math.pow(g / 255, GAMMA) * 3 + Math.pow(b / 255, GAMMA)) / 4, 1 / GAMMA) * 255);

    return 0xff000000 | (b << 16) | (g << 8) | r;
}

for (let rgb555 = 0; rgb555 < 0x8000; rgb555++) COLOR_MAPPING[rgb555] = convert(rgb555);
