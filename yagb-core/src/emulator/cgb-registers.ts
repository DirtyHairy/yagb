export const enum cgbRegisters {
    key1 = 0xff4d,
    vramBank = 0xff4f,
    hdma1 = 0xff51,
    hdma2 = 0xff52,
    hdma3 = 0xff53,
    hdma4 = 0xff54,
    hdma5 = 0xff55,
    rp = 0xff56,
    bgpi = 0xff68,
    bgpd = 0xff69,
    obpi = 0xff6a,
    obpd = 0xff6b,
    svbk = 0xff70,
}

export function isCgbRegister(address: number): boolean {
    switch (address) {
        case cgbRegisters.key1:
        case cgbRegisters.vramBank:
        case cgbRegisters.svbk:
        case cgbRegisters.rp:
        case cgbRegisters.bgpi:
        case cgbRegisters.bgpd:
        case cgbRegisters.obpi:
        case cgbRegisters.obpd:
        case cgbRegisters.hdma1:
        case cgbRegisters.hdma2:
        case cgbRegisters.hdma3:
        case cgbRegisters.hdma4:
        case cgbRegisters.hdma5:
            return true;

        default:
            return false;
    }
}
