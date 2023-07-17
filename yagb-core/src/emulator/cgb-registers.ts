export const enum cgbRegisters {
    vramBank = 0xff4f,
    svbk = 0xff70,
    rp = 0xff56,
}

export function isCgbRegister(address: number): boolean {
    switch (address) {
        case cgbRegisters.vramBank:
        case cgbRegisters.svbk:
        case cgbRegisters.rp:
            return true;

        default:
            return false;
    }
}
