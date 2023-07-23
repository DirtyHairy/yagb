export const COLOR_MAPPING = createPaletteMapping();

function convert(rgb555: number): number {
    let r = rgb555 & 0x1f;
    let g = (rgb555 >>> 5) & 0x1f;
    let b = (rgb555 >>> 10) & 0x1f;

    r = (r << 3) | (r >>> 2);
    g = (g << 3) | (g >>> 2);
    b = (b << 3) | (b >>> 2);

    return 0xff000000 | (b << 16) | (g << 8) | r;
}

function createPaletteMapping(): Uint32Array {
    const mapping = new Uint32Array(0x8000);

    for (let rgb555 = 0; rgb555 < 0x8000; rgb555++) mapping[rgb555] = convert(rgb555);

    return mapping;
}
