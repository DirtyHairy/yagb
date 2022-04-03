import { hex16 } from '../helper/format';

export const enum r8 {
    f = 0,
    a = 1,
    c = 2,
    b = 3,
    e = 4,
    d = 5,
    l = 6,
    h = 7,
}

export const enum r16 {
    af = 0,
    bc = 1,
    de = 2,
    hl = 3,
}

export const enum flag {
    z = 0x80,
    n = 0x40,
    h = 0x20,
    c = 0x10,
}

export interface CpuState {
    r8: Uint8Array;
    r16: Uint16Array;
    p: number;
    s: number;
}

export class Cpu {
    constructor() {
        const r8 = new Uint8Array(8);
        const r16 = new Uint16Array(r8.buffer);

        this.state = {
            r8,
            r16,
            p: 0,
            s: 0,
        };
    }

    reset() {
        this.state.r16[r16.af] = 0x0100;
        this.state.r16[r16.bc] = 0x0013;
        this.state.r16[r16.de] = 0x00d8;
        this.state.r16[r16.hl] = 0x014d;
        this.state.p = 0x0100;
        this.state.s = 0xfffe;
    }

    printState(): string {
        return `af=${hex16(this.state.r16[r16.af])} bc=${hex16(this.state.r16[r16.bc])} de=${hex16(
            this.state.r16[r16.de]
        )} hl=${hex16(this.state.r16[r16.hl])} s=${hex16(this.state.s)} p=${hex16(this.state.p)}`;
    }

    readonly state: CpuState;
}
