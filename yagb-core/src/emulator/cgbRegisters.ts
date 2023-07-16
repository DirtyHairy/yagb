export const enum cgbRegisters {
    vramBank = 0xff4f,
}

export function isCgbRegister(address: number): boolean {
    switch (address) {
        case cgbRegisters.vramBank:
            return true;

        default:
            return false;
    }
}
