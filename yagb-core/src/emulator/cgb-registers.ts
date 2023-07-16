export const enum cgbRegisters {
    vramBank = 0xff4f,
    svbk = 0xff70,
}

export function isCgbRegister(address: number): boolean {
    switch (address) {
        case cgbRegisters.vramBank:
        case cgbRegisters.svbk:
            return true;

        default:
            return false;
    }
}
