export const enum cgbRegisters {
    vramBank = 0xff4f,
    svbk = 0xff70,
    rp = 0xff56,
    bgpi = 0xff68,
    bgpd = 0xff69,
    obpi = 0xff6a,
    obpd = 0xff6b,
}

export function isCgbRegister(address: number): boolean {
    switch (address) {
        case cgbRegisters.vramBank:
        case cgbRegisters.svbk:
        case cgbRegisters.rp:
        case cgbRegisters.bgpi:
        case cgbRegisters.bgpd:
        case cgbRegisters.obpi:
        case cgbRegisters.obpd:
            return true;

        default:
            return false;
    }
}
