import { flag, r16, r8 } from './cpu';
import { hex16, hex8 } from '../helper/format';

import { Bus } from './bus';

export const enum Operation {
    invalid,
    and,
    call,
    cp,
    cpl,
    dec,
    di,
    ei,
    inc,
    jp,
    jr,
    ld,
    ldd,
    ldi,
    nop,
    or,
    pop,
    push,
    ret,
    xor,
}

export const enum AddressingMode {
    implicit,

    imm8,
    imm8ind,
    imm8io,
    reg8,
    reg8io,
    ind8,

    imm16,
    reg16,

    flag,
}

export interface Instruction {
    opcode: number;
    op: Operation;
    par1: number;
    mode1: AddressingMode;
    par2: number;
    mode2: AddressingMode;
    cycles: number;
    len: number;
}

export function decodeInstruction(bus: Bus, address: number): Instruction {
    return instructions[bus.read(address)];
}

export function disassembleInstruction(bus: Bus, address: number): string {
    const instruction = decodeInstruction(bus, address);
    if (instruction.op === Operation.invalid) return `DB ${hex8(instruction.opcode)}`;

    const op = disassembleOperation(instruction.op);

    switch (true) {
        case instruction.mode1 === AddressingMode.implicit && instruction.mode2 === AddressingMode.implicit:
            return op;

        case instruction.mode2 === AddressingMode.implicit: {
            const par1 = disassembleOperationParameter(bus, address, instruction.par1, instruction.mode1);
            return `${op} ${par1}`;
        }

        default: {
            const par1 = disassembleOperationParameter(bus, address, instruction.par1, instruction.mode1);
            const par2 = disassembleOperationParameter(bus, address, instruction.par2, instruction.mode2);
            return `${op} ${par1}${par1 !== '' ? ', ' : ''}${par2}`;
        }
    }
}

function disassembleOperation(operation: Operation): string {
    switch (operation) {
        case Operation.and:
            return 'AND';

        case Operation.call:
            return 'CALL';

        case Operation.cp:
            return 'CP';

        case Operation.cpl:
            return 'CPL';

        case Operation.dec:
            return 'DEC';

        case Operation.di:
            return 'DI';

        case Operation.ei:
            return 'EI';

        case Operation.inc:
            return 'INC';

        case Operation.jp:
            return 'JP';

        case Operation.jr:
            return 'JR';

        case Operation.ld:
            return 'LD';

        case Operation.ldd:
            return 'LDD';

        case Operation.ldi:
            return 'LDI';

        case Operation.nop:
            return 'NOP';

        case Operation.or:
            return 'OR';

        case Operation.pop:
            return 'POP';

        case Operation.push:
            return 'PUSH';

        case Operation.ret:
            return 'RET';

        case Operation.xor:
            return 'XOR';

        default:
            throw new Error('bad operation');
    }
}

function disassembleOperationParameter(bus: Bus, address: number, par: number, mode: AddressingMode): string {
    switch (mode) {
        case AddressingMode.imm8:
            return `${hex8(bus.read((address + 1) & 0xffff))}`;

        case AddressingMode.imm8ind:
            return `(${hex8(bus.read16((address + 1) & 0xffff))})`;

        case AddressingMode.imm8io:
            return `(FF00 + ${hex8(bus.read((address + 1) & 0xffff))})`;

        case AddressingMode.reg8:
            return `${disassembleR8(par)}`;

        case AddressingMode.reg8io:
            return `(FF00 + ${disassembleR8(par)})`;

        case AddressingMode.ind8:
            return `(${disassembleR16(par)})`;

        case AddressingMode.imm16:
            return `${hex16(bus.read16((address + 1) & 0xffff))}`;

        case AddressingMode.reg16:
            return `${disassembleR16(par)}`;

        case AddressingMode.flag: {
            const N = par & flag.not ? 'N' : '';
            const Z = par & flag.z ? 'Z' : '';
            const C = par & flag.c ? 'C' : '';
            return `${N}${Z}${C}`;
        }

        default:
            throw new Error('bad addressing mode');
    }
}

function disassembleR8(reg: r8): string {
    const MNEMONICS = ['F', 'A', 'C', 'B', 'E', 'D', 'L', 'H'];

    return MNEMONICS[reg];
}

function disassembleR16(reg: r16): string {
    const MNEMONICS = ['AF', 'BC', 'DE', 'HL', 'SP'];

    return MNEMONICS[reg];
}

function apply(opcode: number, instruction: Partial<Instruction>): void {
    instructions[opcode] = {
        ...instructions[opcode],
        ...instruction,
        opcode,
    };
}

const instructions = new Array<Instruction>(0x100);

for (let i = 0; i < 0x100; i++)
    instructions[i] = {
        opcode: i,
        op: Operation.invalid,
        par1: 0,
        mode1: AddressingMode.implicit,
        par2: 0,
        mode2: AddressingMode.implicit,
        cycles: 0,
        len: 1,
    };

apply(0, { op: Operation.nop, cycles: 1, len: 1 });
apply(0xc3, { op: Operation.jp, mode1: AddressingMode.imm16, cycles: 4, len: 3 });

// 0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5
// 0xa8, 0xa9, 0xaa, 0xab, 0xac, 0xad
// 0xb0, 0xb1, 0xb2, 0xb3, 0xb4, 0xb5
[r8.b, r8.c, r8.d, r8.e, r8.h, r8.l].forEach((reg, i) => {
    apply(0xa0 + i, { op: Operation.and, par1: reg, mode1: AddressingMode.reg8, cycles: 1, len: 1 });
    apply(0xa0 + i + 8, { op: Operation.xor, par1: reg, mode1: AddressingMode.reg8, cycles: 1, len: 1 });
    apply(0xb0 + i, { op: Operation.or, par1: reg, mode1: AddressingMode.reg8, cycles: 1, len: 1 });
});
apply(0xa7, { op: Operation.and, par1: r8.a, mode1: AddressingMode.reg8, cycles: 1, len: 1 });
apply(0xaf, { op: Operation.xor, par1: r8.a, mode1: AddressingMode.reg8, cycles: 1, len: 1 });
apply(0xb7, { op: Operation.or, par1: r8.a, mode1: AddressingMode.reg8, cycles: 1, len: 1 });

apply(0xa6, { op: Operation.and, par1: r16.hl, mode1: AddressingMode.ind8, cycles: 2, len: 1 });
apply(0xae, { op: Operation.xor, par1: r16.hl, mode1: AddressingMode.ind8, cycles: 2, len: 1 });
apply(0xb6, { op: Operation.or, par1: r16.hl, mode1: AddressingMode.ind8, cycles: 2, len: 1 });

// 0x01, 0x11, 0x21, 0x31
[r16.bc, r16.de, r16.hl, r16.sp].forEach((reg, i) => {
    apply((i << 4) | 0x01, { op: Operation.ld, par1: reg, mode1: AddressingMode.reg16, mode2: AddressingMode.imm16, cycles: 3, len: 3 });
});

apply(0x36, { op: Operation.ld, par1: r16.hl, mode1: AddressingMode.ind8, mode2: AddressingMode.imm8, cycles: 3, len: 2 });

apply(0xea, { op: Operation.ld, mode1: AddressingMode.imm8ind, par2: r8.a, mode2: AddressingMode.reg8, cycles: 4, len: 3 });

apply(0xf0, { op: Operation.ld, par1: r8.a, mode1: AddressingMode.reg8, mode2: AddressingMode.imm8io, cycles: 3, len: 2 });
apply(0xe0, { op: Operation.ld, mode1: AddressingMode.imm8io, par2: r8.a, mode2: AddressingMode.reg8, cycles: 3, len: 2 });

apply(0xf2, { op: Operation.ld, par1: r8.a, mode1: AddressingMode.reg8, par2: r8.c, mode2: AddressingMode.reg8io, cycles: 2, len: 1 });
apply(0xe2, { op: Operation.ld, par1: r8.c, mode1: AddressingMode.reg8io, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 1 });
[r8.c, r8.e, r8.l, r8.a].forEach((reg1, i1) =>
    [r8.a, r8.b, r8.c, r8.d, r8.e, r8.h, r8.l].forEach((reg2, i2) => {
        if (reg1 !== reg2)
            apply(((4 + i1) << 4) | (7 + i2), {
                op: Operation.ld,
                par1: reg1,
                mode1: AddressingMode.reg8,
                par2: reg2,
                mode2: AddressingMode.reg8,
                cycles: 1,
                len: 1,
            });
    })
);

// 0x04, 0x14, 0x24
// 0x05, 0x15, 0x25
// 0x06, 0x16, 0x26
[r8.b, r8.d, r8.h].forEach((reg, i) => {
    apply((i << 4) | 0x04, { op: Operation.inc, par1: reg, mode1: AddressingMode.reg8, cycles: 1, len: 1 });
    apply((i << 4) | 0x05, { op: Operation.dec, par1: reg, mode1: AddressingMode.reg8, cycles: 1, len: 1 });
    apply((i << 4) | 0x06, { op: Operation.ld, par1: reg, mode1: AddressingMode.reg8, mode2: AddressingMode.imm8, cycles: 2, len: 2 });
});

// 0x0c, 0x1c, 0x2c, 0x3c
// 0x0d, 0x1d, 0x2d, 0x3d
// 0x0e, 0x1e, 0x2e, 0x3e
[r8.c, r8.e, r8.l, r8.a].forEach((reg, i) => {
    apply((i << 4) | 0x0c, { op: Operation.inc, par1: reg, mode1: AddressingMode.reg8, cycles: 1, len: 1 });
    apply((i << 4) | 0x0d, { op: Operation.dec, par1: reg, mode1: AddressingMode.reg8, cycles: 1, len: 1 });
    apply((i << 4) | 0x0e, { op: Operation.ld, par1: reg, mode1: AddressingMode.reg8, mode2: AddressingMode.imm8, cycles: 2, len: 2 });
});

apply(0x22, { op: Operation.ldi, par1: r16.hl, mode1: AddressingMode.ind8, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 1 });
apply(0x32, { op: Operation.ldd, par1: r16.hl, mode1: AddressingMode.ind8, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 1 });

apply(0x2a, { op: Operation.ldi, par1: r8.a, mode1: AddressingMode.reg8, par2: r16.hl, mode2: AddressingMode.ind8, cycles: 2, len: 1 });
apply(0x3a, { op: Operation.ldd, par1: r8.a, mode1: AddressingMode.reg8, par2: r16.hl, mode2: AddressingMode.ind8, cycles: 2, len: 1 });

// 0x0b, 0x1b, 0x2b, 0x3b
[r16.bc, r16.de, r16.hl, r16.sp].forEach((reg, i) => {
    apply((i << 4) | 0x03, { op: Operation.inc, par1: reg, mode1: AddressingMode.reg16, cycles: 2, len: 1 });
    apply((i << 4) | 0x0b, { op: Operation.dec, par1: reg, mode1: AddressingMode.reg16, cycles: 2, len: 1 });
});

apply(0x18, { op: Operation.jr, mode1: AddressingMode.flag, mode2: AddressingMode.imm8, cycles: 2, len: 2 });

apply(0x20, { op: Operation.jr, par1: flag.z | flag.not, mode1: AddressingMode.flag, mode2: AddressingMode.imm8, cycles: 2, len: 2 });
apply(0x28, { op: Operation.jr, par1: flag.z, mode1: AddressingMode.flag, mode2: AddressingMode.imm8, cycles: 2, len: 2 });

apply(0x30, { op: Operation.jr, par1: flag.c | flag.not, mode1: AddressingMode.flag, mode2: AddressingMode.imm8, cycles: 2, len: 2 });
apply(0x38, { op: Operation.jr, par1: flag.c, mode1: AddressingMode.flag, mode2: AddressingMode.imm8, cycles: 2, len: 2 });

apply(0xf3, { op: Operation.di, cycles: 1, len: 1 });
apply(0xfb, { op: Operation.ei, cycles: 1, len: 1 });

apply(0xfe, { op: Operation.cp, mode1: AddressingMode.imm8, cycles: 2, len: 2 });

apply(0xcd, { op: Operation.call, mode1: AddressingMode.imm16, cycles: 8, len: 3 });

apply(0xc9, { op: Operation.ret, cycles: 4, len: 1 });

apply(0x2f, { op: Operation.cpl, cycles: 1, len: 1 });

[r16.bc, r16.de, r16.hl, r16.af].forEach((reg, i) => {
    apply(((i + 0xc) << 4) | 0x05, { op: Operation.push, par1: reg, mode1: AddressingMode.reg16, cycles: 4, len: 1 });
    apply(((i + 0xc) << 4) | 0x01, { op: Operation.pop, par1: reg, mode1: AddressingMode.reg16, cycles: 3, len: 1 });
});
