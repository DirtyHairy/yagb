export const PALETTE_CLASSIC = new Uint32Array([0xff0fbc9b, 0xff0fac8b, 0xff306230, 0xff0f380f, 0xff9fdcca]);

function fromRGB(r: number, g: number, b: number, factor = 1): number {
    return 0xff000000 | (Math.min(0xff, Math.round(b * factor)) << 16) | (Math.min(0xff, Math.round(g * factor)) << 8) | Math.min(0xff, Math.round(r * factor));
}
