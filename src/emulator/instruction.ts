import { hex16, hex8 } from '../helper/format';
import { r16, r8 } from './cpu';

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
    jrnz,
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
    imm8,
    imm8ind,
    imm8io,
    reg8,
    reg8io,
    ind8,

    imm16,
    reg16,
}

export interface OperationParameter {
    value?: number;
    addressingMode: AddressingMode;
}

export interface Instruction {
    opcode: number;
    operation: Operation;
    par1?: OperationParameter;
    par2?: OperationParameter;
    cycles: number;
    len: number;
}

export function decodeInstruction(bus: Bus, address: number): Instruction {
    return instructions[bus.read(address)];
}

export function disassembleInstruction(bus: Bus, address: number): string {
    const instruction = decodeInstruction(bus, address);
    if (instruction.operation === Operation.invalid) return `DB ${hex8(instruction.opcode)}`;

    const op = disassembleOperation(instruction.operation);

    switch (true) {
        case instruction.par1 === undefined && instruction.par2 === undefined:
            return op;

        case instruction.par2 === undefined: {
            const par1 = instruction.par1 === undefined ? '' : disassembleOperationParameter(bus, address, instruction.par1);
            return `${op} ${par1}`;
        }

        default: {
            const par1 = instruction.par1 === undefined ? '' : disassembleOperationParameter(bus, address, instruction.par1);
            const par2 = instruction.par2 === undefined ? '' : disassembleOperationParameter(bus, address, instruction.par2);
            return `${op} ${par1}  ${par2}`;
        }
    }
}

function disassembleOperation(operation: Operation): string {
    switch (operation) {
        case Operation.invalid:
            return 'INVALID';

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

        case Operation.jrnz:
            return 'JR NZ,';

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

function disassembleOperationParameter(bus: Bus, address: number, par: OperationParameter): string {
    switch (par.addressingMode) {
        case AddressingMode.imm8:
            return `${hex8(bus.read((address + 1) & 0xffff))}`;

        case AddressingMode.imm8ind:
            return `(${hex8(bus.read16((address + 1) & 0xffff))})`;

        case AddressingMode.imm8io:
            return `(FF00 + ${hex8(bus.read((address + 1) & 0xffff))})`;

        case AddressingMode.reg8:
            if (par.value === undefined) {
                throw new Error('missing value for operation parameter');
            }

            return `${disassembleR8(par.value)}`;

        case AddressingMode.reg8io:
            if (par.value === undefined) {
                throw new Error('missing value for operation parameter');
            }

            return `(FF00 + ${disassembleR8(par.value)})`;

        case AddressingMode.ind8:
            if (par.value === undefined) {
                throw new Error('missing value for operation parameter');
            }

            return `(${disassembleR16(par.value)})`;

        case AddressingMode.imm16:
            return `${hex16(bus.read16((address + 1) & 0xffff))}`;

        case AddressingMode.reg16:
            if (par.value === undefined) {
                throw new Error('missing value for operation parameter');
            }

            return `${disassembleR16(par.value)}`;

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
        operation: Operation.invalid,
        cycles: 0,
        len: 1,
    };

apply(0, { operation: Operation.nop, cycles: 1, len: 1 });
apply(0xc3, { operation: Operation.jp, par1: { addressingMode: AddressingMode.imm16 }, cycles: 4, len: 3 });

// 0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5
// 0xa8, 0xa9, 0xaa, 0xab, 0xac, 0xad
// 0xb0, 0xb1, 0xb2, 0xb3, 0xb4, 0xb5
[r8.b, r8.c, r8.d, r8.e, r8.h, r8.l].forEach((reg, i) => {
    apply(0xa0 + i, { operation: Operation.and, par1: { value: reg, addressingMode: AddressingMode.reg8 }, cycles: 1, len: 1 });
    apply(0xa0 + i + 8, { operation: Operation.xor, par1: { value: reg, addressingMode: AddressingMode.reg8 }, cycles: 1, len: 1 });
    apply(0xb0 + i, { operation: Operation.or, par1: { value: reg, addressingMode: AddressingMode.reg8 }, cycles: 1, len: 1 });
});
apply(0xa7, { operation: Operation.and, par1: { value: r8.a, addressingMode: AddressingMode.reg8 }, cycles: 1, len: 1 });
apply(0xaf, { operation: Operation.xor, par1: { value: r8.a, addressingMode: AddressingMode.reg8 }, cycles: 1, len: 1 });
apply(0xb7, { operation: Operation.or, par1: { value: r8.a, addressingMode: AddressingMode.reg8 }, cycles: 1, len: 1 });

apply(0xa6, { operation: Operation.and, par1: { value: r16.hl, addressingMode: AddressingMode.ind8 }, cycles: 2, len: 1 });
apply(0xae, { operation: Operation.xor, par1: { value: r16.hl, addressingMode: AddressingMode.ind8 }, cycles: 2, len: 1 });
apply(0xb6, { operation: Operation.or, par1: { value: r16.hl, addressingMode: AddressingMode.ind8 }, cycles: 2, len: 1 });

// 0x01, 0x11, 0x21, 0x31
[r16.bc, r16.de, r16.hl, r16.sp].forEach((reg, i) => {
    apply((i << 4) | 0x01, {
        operation: Operation.ld,
        par1: { value: reg, addressingMode: AddressingMode.reg16 },
        par2: { addressingMode: AddressingMode.imm16 },
        cycles: 3,
        len: 3,
    });
});

apply(0x36, {
    operation: Operation.ld,
    par1: { value: r16.hl, addressingMode: AddressingMode.ind8 },
    par2: { addressingMode: AddressingMode.imm8 },
    cycles: 3,
    len: 2,
});

apply(0xea, {
    operation: Operation.ld,
    par1: { addressingMode: AddressingMode.imm8ind },
    par2: { value: r8.a, addressingMode: AddressingMode.reg8 },
    cycles: 4,
    len: 3,
});

apply(0xf0, {
    operation: Operation.ld,
    par1: { value: r8.a, addressingMode: AddressingMode.reg8 },
    par2: { addressingMode: AddressingMode.imm8io },
    cycles: 3,
    len: 2,
});
apply(0xe0, {
    operation: Operation.ld,
    par1: { addressingMode: AddressingMode.imm8io },
    par2: { value: r8.a, addressingMode: AddressingMode.reg8 },
    cycles: 3,
    len: 2,
});

apply(0xf2, {
    operation: Operation.ld,
    par1: { addressingMode: AddressingMode.reg8 },
    par2: { value: r8.c, addressingMode: AddressingMode.reg8io },
    cycles: 2,
    len: 1,
});
apply(0xe2, {
    operation: Operation.ld,
    par1: { value: r8.c, addressingMode: AddressingMode.reg8io },
    par2: { addressingMode: AddressingMode.reg8 },
    cycles: 2,
    len: 1,
});

[r8.c, r8.e, r8.l, r8.a].forEach((reg1, i1) =>
    [r8.a, r8.b, r8.c, r8.d, r8.e, r8.h, r8.l].forEach((reg2, i2) => {
        if (reg1 !== reg2)
            apply(((4 + i1) << 4) | (7 + i2), {
                operation: Operation.ld,
                par1: { value: reg1, addressingMode: AddressingMode.reg8 },
                par2: { value: reg2, addressingMode: AddressingMode.reg8 },
                cycles: 1,
                len: 1,
            });
    })
);

// 0x06, 0x16, 0x26
[r8.b, r8.d, r8.h].forEach((reg, i) => {
    apply((i << 4) | 0x06, {
        operation: Operation.ld,
        par1: { value: reg, addressingMode: AddressingMode.reg8 },
        par2: { addressingMode: AddressingMode.imm8 },
        cycles: 2,
        len: 2,
    });
});

// 0x0e, 0x1e, 0x2e, 0x3e
[r8.c, r8.e, r8.l, r8.a].forEach((reg, i) => {
    apply((i << 4) | 0x0e, {
        operation: Operation.ld,
        par1: { value: reg, addressingMode: AddressingMode.reg8 },
        par2: { addressingMode: AddressingMode.imm8 },
        cycles: 2,
        len: 2,
    });
});

apply(0x22, {
    operation: Operation.ldi,
    par1: { value: r16.hl, addressingMode: AddressingMode.ind8 },
    par2: { value: r8.a, addressingMode: AddressingMode.reg8 },
    cycles: 2,
    len: 1,
});
apply(0x32, {
    operation: Operation.ldd,
    par1: { value: r16.hl, addressingMode: AddressingMode.ind8 },
    par2: { value: r8.a, addressingMode: AddressingMode.reg8 },
    cycles: 2,
    len: 1,
});

apply(0x2a, {
    operation: Operation.ldi,
    par1: { value: r8.a, addressingMode: AddressingMode.reg8 },
    par2: { value: r16.hl, addressingMode: AddressingMode.ind8 },
    cycles: 2,
    len: 1,
});
apply(0x3a, {
    operation: Operation.ldd,
    par1: { value: r8.a, addressingMode: AddressingMode.reg8 },
    par2: { value: r16.hl, addressingMode: AddressingMode.ind8 },
    cycles: 2,
    len: 1,
});

// 0x04, 0x14, 0x24
// 0x05, 0x15, 0x25
// 0x06, 0x16, 0x26
[r8.b, r8.d, r8.h].forEach((reg, i) => {
    apply((i << 4) | 0x04, { operation: Operation.inc, par1: { value: reg, addressingMode: AddressingMode.reg8 }, cycles: 1, len: 1 });
    apply((i << 4) | 0x05, { operation: Operation.dec, par1: { value: reg, addressingMode: AddressingMode.reg8 }, cycles: 1, len: 1 });
    apply((i << 4) | 0x06, {
        operation: Operation.ld,
        par1: { value: reg, addressingMode: AddressingMode.reg8 },
        par2: { addressingMode: AddressingMode.imm8 },
        cycles: 2,
        len: 2,
    });
});

// 0x0c, 0x1c, 0x2c, 0x3c
// 0x0d, 0x1d, 0x2d, 0x3d
[r8.c, r8.e, r8.l, r8.a].forEach((reg, i) => {
    apply((i << 4) | 0x0c, { operation: Operation.inc, par1: { value: reg, addressingMode: AddressingMode.reg8 }, cycles: 1, len: 1 });
    apply((i << 4) | 0x0d, { operation: Operation.dec, par1: { value: reg, addressingMode: AddressingMode.reg8 }, cycles: 1, len: 1 });
    apply((i << 4) | 0x0e, {
        operation: Operation.ld,
        par1: { value: reg, addressingMode: AddressingMode.reg8 },
        par2: { addressingMode: AddressingMode.imm8 },
        cycles: 2,
        len: 2,
    });
});

// 0x0b, 0x1b, 0x2b, 0x3b
[r16.bc, r16.de, r16.hl, r16.sp].forEach((reg, i) => {
    apply((i << 4) | 0x0b, { operation: Operation.dec, par1: { value: reg, addressingMode: AddressingMode.reg16 }, cycles: 2, len: 1 });
    apply((i << 4) | 0x03, { operation: Operation.inc, par1: { value: reg, addressingMode: AddressingMode.reg16 }, cycles: 2, len: 1 });
});

apply(0x20, { operation: Operation.jrnz, par1: { addressingMode: AddressingMode.imm8 }, cycles: 2, len: 2 });

apply(0xf3, { operation: Operation.di, cycles: 1, len: 1 });
apply(0xfb, { operation: Operation.ei, cycles: 1, len: 1 });

apply(0xfe, { operation: Operation.cp, par1: { addressingMode: AddressingMode.imm8 }, cycles: 2, len: 2 });

apply(0xcd, { operation: Operation.call, par1: { addressingMode: AddressingMode.imm16 }, cycles: 8, len: 3 });

apply(0xc9, { operation: Operation.ret, cycles: 4, len: 1 });

apply(0x2f, { operation: Operation.cpl, cycles: 1, len: 1 });

[r16.bc, r16.de, r16.hl, r16.af].forEach((reg, i) => {
    apply(((i + 0xc) << 4) | 0x05, {
        operation: Operation.push,
        par1: { value: reg, addressingMode: AddressingMode.reg16 },
        cycles: 4,
        len: 1,
    });
    apply(((i + 0xc) << 4) | 0x01, {
        operation: Operation.pop,
        par1: { value: reg, addressingMode: AddressingMode.reg16 },
        cycles: 3,
        len: 1,
    });
});
