export const enum cgbRegisters {
    vramBank = 0xff4f,
    svbk = 0xff70,
    rp = 0xff56,
    bgpi = 0xff68,
    bgpd = 0xff69,
}

export function isCgbRegister(address: number): boolean {
    switch (address) {
        case cgbRegisters.vramBank:
        case cgbRegisters.svbk:
        case cgbRegisters.rp:
        case cgbRegisters.bgpi:
        case cgbRegisters.bgpd:
            return true;

        default:
            return false;
    }
}
