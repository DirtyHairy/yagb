import { COLOR_MAPPING } from './color-mapping';

// The code below is ported from the free CGB ROM implementation
// in SameBoy.

export interface CompatPaletteSet {
    obj0: Uint32Array;
    obj1: Uint32Array;
    bg: Uint32Array;
}

export function determinePaletteIndex(cartridge: Uint8Array) {
    if (!isNintendo(cartridge)) return 0;

    return determineIndexFromChecksum(cartridge);
}

export function buildPaletteForIndex(index: number): CompatPaletteSet {
    if (4 * index + 4 > PALETTE_DEFINITIONS.length) {
        console.error(`palette index ${index} out of range`);
        return buildPaletteForIndex(0);
    }

    const mult = PALETTE_DEFINITIONS[index * 4];
    const offsetObj0 = PALETTE_DEFINITIONS[index * 4 + 1] * mult;
    const offsetObj1 = PALETTE_DEFINITIONS[index * 4 + 2] * mult;
    const offsetBg = PALETTE_DEFINITIONS[index * 4 + 3] * mult;

    return {
        obj0: buildPaletteAtOffset(offsetObj0),
        obj1: buildPaletteAtOffset(offsetObj1),
        bg: buildPaletteAtOffset(offsetBg),
    };
}

function isNintendo(cartridge: Uint8Array): boolean {
    switch (cartridge[0x14b]) {
        case 0x01:
            return true;

        case 0x33:
            break;

        default:
            return false;
    }

    return cartridge[0x144] === 48 && cartridge[0x145] === 49;
}

function determineIndexFromChecksum(cartridge: Uint8Array): number {
    let checksum = 0;
    for (let i = 0x134; i < 0x144; i++) checksum += cartridge[i];
    checksum &= 0xff;

    for (let i = 0; i < CHECKSUMS.length >>> 1; i++) {
        if (checksum !== CHECKSUMS[2 * i]) continue;

        if (i < 65 || DISAMBIGUATION_LETTERS.charCodeAt(i - 65) === cartridge[0x137]) return CHECKSUMS[2 * i + 1];
    }

    return 0;
}

function buildPaletteAtOffset(offset: number): Uint32Array {
    const palette = new Uint32Array(4);

    if (offset + 4 > COLORS.length) {
        console.error(`color offset ${offset} out of range`);
        return palette;
    }

    for (let i = 0; i < 4; i++) palette[i] = COLOR_MAPPING[COLORS[offset + i]];

    return palette;
}

// prettier-ignore
const COLORS = new Uint16Array([
    0x7FFF, 0x32BF, 0x00D0, 0x0000,
    0x639F, 0x4279, 0x15B0, 0x04CB,
    0x7FFF, 0x6E31, 0x454A, 0x0000,
    0x7FFF, 0x1BEF, 0x0200, 0x0000,
    0x7FFF, 0x421F, 0x1CF2, 0x0000,
    0x7FFF, 0x5294, 0x294A, 0x0000,
    0x7FFF, 0x03FF, 0x012F, 0x0000,
    0x7FFF, 0x03EF, 0x01D6, 0x0000,
    0x7FFF, 0x42B5, 0x3DC8, 0x0000,
    0x7E74, 0x03FF, 0x0180, 0x0000,
    0x67FF, 0x77AC, 0x1A13, 0x2D6B,
    0x7ED6, 0x4BFF, 0x2175, 0x0000,
    0x53FF, 0x4A5F, 0x7E52, 0x0000,
    0x4FFF, 0x7ED2, 0x3A4C, 0x1CE0,
    0x03ED, 0x7FFF, 0x255F, 0x0000,
    0x036A, 0x021F, 0x03FF, 0x7FFF,
    0x7FFF, 0x01DF, 0x0112, 0x0000,
    0x231F, 0x035F, 0x00F2, 0x0009,
    0x7FFF, 0x03EA, 0x011F, 0x0000,
    0x299F, 0x001A, 0x000C, 0x0000,
    0x7FFF, 0x027F, 0x001F, 0x0000,
    0x7FFF, 0x03E0, 0x0206, 0x0120,
    0x7FFF, 0x7EEB, 0x001F, 0x7C00,
    0x7FFF, 0x3FFF, 0x7E00, 0x001F,
    0x7FFF, 0x03FF, 0x001F, 0x0000,
    0x03FF, 0x001F, 0x000C, 0x0000,
    0x7FFF, 0x033F, 0x0193, 0x0000,
    0x0000, 0x4200, 0x037F, 0x7FFF,
    0x7FFF, 0x7E8C, 0x7C00, 0x0000,
    0x7FFF, 0x1BEF, 0x6180, 0x0000,
]);

// prettier-ignore
const PALETTE_DEFINITIONS = new Uint8Array([
    4, 4, 4, 29,
    4, 18, 18, 18,
    4, 20, 20, 20,
    4, 24, 24, 24,
    4, 9, 9, 9,
    4, 0, 0, 0,
    4, 27, 27, 27,
    4, 5, 5, 5,
    4, 12, 12, 12,
    4, 26, 26, 26,
    4, 16, 8, 8,
    4, 4, 28, 28,
    4, 4, 2, 2,
    4, 3, 4, 4,
    4, 4, 29, 29,
    4, 28, 4, 28,
    4, 2, 17, 2,
    4, 16, 16, 8,
    4, 4, 4, 7,
    4, 4, 4, 18,
    4, 4, 4, 20,
    4, 19, 19, 9,
    1, 4 * 4 - 1, 4 * 4 - 1, 11 * 4,
    4, 17, 17, 2,
    4, 4, 4, 2,
    4, 4, 4, 3,
    4, 28, 28, 0,
    4, 3, 3, 0,
    4, 0, 0, 1,
    4, 18, 22, 18,
    4, 20, 22, 20,
    4, 24, 22, 24,
    4, 16, 22, 8,
    4, 17, 4, 13,
    1, 28 * 4 - 1, 0 * 4, 14 * 4,
    1, 28 * 4 - 1, 4 * 4, 15 * 4,
    1, 19 * 4, 23 * 4 - 1, 9 * 4,
    4, 16, 28, 10,
    4, 4, 23, 28,
    4, 17, 22, 2,
    4, 4, 0, 2,
    4, 4, 28, 3,
    4, 28, 3, 0,
    4, 3, 28, 4,
    4, 21, 28, 4,
    4, 3, 28, 0,
    4, 25, 3, 28,
    4, 0, 28, 8,
    4, 4, 3, 28,
    4, 28, 3, 6,
    4, 4, 28, 29,
]);

// prettier-ignore
const CHECKSUMS = new Uint8Array([
    0x00, 0,  //  Default
    0x88, 4,  //  ALLEY WAY
    0x16, 5,  //  YAKUMAN
    0x36, 35, //  BASEBALL, (Game and Watch 2)
    0xD1, 34, //  TENNIS
    0xDB, 3,  //  TETRIS
    0xF2, 31, //  QIX
    0x3C, 15, //  DR.MARIO
    0x8C, 10, //  RADARMISSION
    0x92, 5,  //  F1RACE
    0x3D, 19, //  YOSSY NO TAMAGO
    0x5C, 36, //
    0x58, 7,  //  X
    0xC9, 37, //  MARIOLAND2
    0x3E, 30, //  YOSSY NO COOKIE
    0x70, 44, //  ZELDA
    0x1D, 21, //
    0x59, 32, //
    0x69, 31, //  TETRIS FLASH
    0x19, 20, //  DONKEY KONG
    0x35, 5,  //  MARIO'S PICROSS
    0xA8, 33, //
    0x14, 13, //  POKEMON RED, (GAMEBOYCAMERA G)
    0xAA, 14, //  POKEMON GREEN
    0x75, 5,  //  PICROSS 2
    0x95, 29, //  YOSSY NO PANEPON
    0x99, 5,  //  KIRAKIRA KIDS
    0x34, 18, //  GAMEBOY GALLERY
    0x6F, 9,  //  POCKETCAMERA
    0x15, 3,  //
    0xFF, 2,  //  BALLOON KID
    0x97, 26, //  KINGOFTHEZOO
    0x4B, 25, //  DMG FOOTBALL
    0x90, 25, //  WORLD CUP
    0x17, 41, //  OTHELLO
    0x10, 42, //  SUPER RC PRO-AM
    0x39, 26, //  DYNABLASTER
    0xF7, 45, //  BOY AND BLOB GB2
    0xF6, 42, //  MEGAMAN
    0xA2, 45, //  STAR WARS-NOA
    0x49, 36, //
    0x4E, 38, //  WAVERACE
    0x43, 26, //
    0x68, 42, //  LOLO2
    0xE0, 30, //  YOSHI'S COOKIE
    0x8B, 41, //  MYSTIC QUEST
    0xF0, 34, //
    0xCE, 34, //  TOPRANKINGTENNIS
    0x0C, 5,  //  MANSELL
    0x29, 42, //  MEGAMAN3
    0xE8, 6,  //  SPACE INVADERS
    0xB7, 5,  //  GAME&WATCH
    0x86, 33, //  DONKEYKONGLAND95
    0x9A, 25, //  ASTEROIDS/MISCMD
    0x52, 42, //  STREET FIGHTER 2
    0x01, 42, //  DEFENDER/JOUST
    0x9D, 40, //  KILLERINSTINCT95
    0x71, 2,  //  TETRIS BLAST
    0x9C, 16, //  PINOCCHIO
    0xBD, 25, //
    0x5D, 42, //  BA.TOSHINDEN
    0x6D, 42, //  NETTOU KOF 95
    0x67, 5,  //
    0x3F, 0,  //  TETRIS PLUS
    0x6B, 39, //  DONKEYKONGLAND 3
    // Checksums with disambiguation
    0xB3, 36, // ???[B]????????
    0x46, 22, // SUP[E]R MARIOLAND
    0x28, 25, // GOL[F]
    0xA5, 6,  // SOL[A]RSTRIKER
    0xC6, 32, // GBW[A]RS
    0xD3, 12, // KAE[R]UNOTAMENI
    0x27, 36, // ???[B]????????
    0x61, 11, // POK[E]MON BLUE
    0x18, 39, // DON[K]EYKONGLAND
    0x66, 18, // GAM[E]BOY GALLERY2
    0x6A, 39, // DON[K]EYKONGLAND 2
    0xBF, 24, // KID[ ]ICARUS
    0x0D, 31, // TET[R]IS2
    0xF4, 50, // ???[-]????????
    0xB3, 17, // MOG[U]RANYA
    0x46, 46, // ???[R]????????
    0x28, 6,  // GAL[A]GA&GALAXIAN
    0xA5, 27, // BT2[R]AGNAROKWORLD
    0xC6, 0,  // KEN[ ]GRIFFEY JR
    0xD3, 47, // ???[I]????????
    0x27, 41, // MAG[N]ETIC SOCCER
    0x61, 41, // VEG[A]S STAKES
    0x18, 0,  // ???[I]????????
    0x66, 0,  // MIL[L]I/CENTI/PEDE
    0x6A, 19, // MAR[I]O & YOSHI
    0xBF, 34, // SOC[C]ER
    0x0D, 23, // POK[E]BOM
    0xF4, 18, // G&W[ ]GALLERY
    0xB3, 29, // TET[R]IS ATTACK
]);

const DISAMBIGUATION_LETTERS = 'BEFAARBEKEK R-URAR INAILICE R';
