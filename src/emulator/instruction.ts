import { hex16, hex8 } from '../helper/format';
import { r16, r8 } from './cpu';

import { Bus } from './bus';

export const enum Operation {
    none,

    adc,
    add,
    add16,
    and,
    call,
    cb,
    cp,
    cpl,
    dec,
    dec16,
    di,
    ei,
    halt,
    inc,
    inc16,
    invalid,
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
    reti,
    rla,
    rlca,
    rra,
    rrca,
    rst,
    sbc,
    scf,
    stop,
    sub,
    xor,

    // prefix cb
    bit,
    res,
    rl,
    rlc,
    rr,
    rrc,
    set,
    sla,
    sra,
    srl,
    swap,
}

export const enum AddressingMode {
    none,
    implicit,

    cb,
    bit,

    imm8,
    imm8io,
    reg8,
    reg8io,

    imm16,
    imm16ind8,
    reg16,
    reg16ind8,
}

export const enum Condition {
    always,
    z,
    nz,
    c,
    nc,
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
    condition: Condition;
}

export function decodeInstruction(bus: Bus, address: number): Instruction {
    let opcode = bus.read(address);

    if (0xcb === opcode) opcode = bus.read(address + 1) + 0x100;

    return instructions[opcode];
}

export function disassembleInstruction(bus: Bus, address: number): string {
    const instruction = decodeInstruction(bus, address);
    if (instruction.op === Operation.invalid) return `DB ${hex8(instruction.opcode)}`;

    const op = disassembleOperation(instruction.op);
    const condition = disassembleCondition(instruction.condition);

    switch (true) {
        case instruction.mode1 === AddressingMode.none && instruction.mode2 === AddressingMode.none:
            return `${op}${condition !== '' ? ` ${condition}` : ''}`;

        case instruction.mode2 === AddressingMode.none: {
            const par1 = disassembleOperationParameter(bus, address, instruction.par1, instruction.mode1);
            return `${op}${condition !== '' ? ` ${condition},` : ''} ${par1}`;
        }

        default: {
            const par1 = disassembleOperationParameter(bus, address, instruction.par1, instruction.mode1);
            const par2 = disassembleOperationParameter(bus, address, instruction.par2, instruction.mode2);
            return `${op} ${par1}${par1 !== '' ? ', ' : ''}${par2}`;
        }
    }
}

function disassembleCondition(condition: Condition): string {
    switch (condition) {
        case Condition.always:
            return '';

        case Condition.c:
            return 'C';

        case Condition.nc:
            return 'NC';

        case Condition.z:
            return 'Z';

        case Condition.nz:
            return 'NZ';
    }
}

function disassembleOperation(operation: Operation): string {
    switch (operation) {
        case Operation.none:
            return '';

        case Operation.adc:
            return 'ADC';

        case Operation.add:
        case Operation.add16:
            return 'ADD';

        case Operation.and:
            return 'AND';

        case Operation.call:
            return 'CALL';

        case Operation.cb:
            return 'CB';

        case Operation.cp:
            return 'CP';

        case Operation.cpl:
            return 'CPL';

        case Operation.dec:
        case Operation.dec16:
            return 'DEC';

        case Operation.di:
            return 'DI';

        case Operation.ei:
            return 'EI';

        case Operation.halt:
            return 'HALT';

        case Operation.inc:
        case Operation.inc16:
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

        case Operation.reti:
            return 'RETI';

        case Operation.rlca:
            return 'RLCA';

        case Operation.rrca:
            return 'RRCA';

        case Operation.rla:
            return 'RLA';

        case Operation.rra:
            return 'RRA';

        case Operation.rst:
            return 'RST';

        case Operation.sub:
            return 'SUB';

        case Operation.sbc:
            return 'SBC';

        case Operation.scf:
            return 'SCF';

        case Operation.stop:
            return 'STOP';

        case Operation.xor:
            return 'XOR';

        case Operation.rlc:
            return 'RLC';

        case Operation.rrc:
            return 'RRC';

        case Operation.rl:
            return 'RL';

        case Operation.rr:
            return 'RR';

        case Operation.sla:
            return 'SLA';

        case Operation.sra:
            return 'SRA';

        case Operation.swap:
            return 'SWAP';

        case Operation.srl:
            return 'SRL';

        case Operation.bit:
            return 'BIT';

        case Operation.res:
            return 'RES';

        case Operation.set:
            return 'SET';

        default:
            throw new Error(`bad operation (${operation})`);
    }
}

function disassembleOperationParameter(bus: Bus, address: number, par: number, mode: AddressingMode): string {
    switch (mode) {
        case AddressingMode.implicit:
            return `${hex8(par)}`;

        case AddressingMode.bit:
            return `${par}`;

        case AddressingMode.cb:
            return `${hex8(bus.read((address + 1) & 0xffff))}`;

        case AddressingMode.imm8:
            return `${hex8(bus.read((address + 1) & 0xffff))}`;

        case AddressingMode.imm8io:
            return `(FF00 + ${hex8(bus.read((address + 1) & 0xffff))})`;

        case AddressingMode.reg8:
            return `${disassembleR8(par)}`;

        case AddressingMode.reg8io:
            return `(FF00 + ${disassembleR8(par)})`;

        case AddressingMode.imm16:
            return `${hex16(bus.read16((address + 1) & 0xffff))}`;

        case AddressingMode.imm16ind8:
            return `(${hex16(bus.read16((address + 1) & 0xffff))})`;

        case AddressingMode.reg16:
            return `${disassembleR16(par)}`;

        case AddressingMode.reg16ind8:
            return `(${disassembleR16(par)})`;

        default:
            throw new Error(`bad addressing mode ${hex8(mode)}`);
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
    opcode = (opcode & 0xff00) >>> 8 === 0xcb ? (opcode & 0x00ff) + 0x100 : opcode;

    if (instructions[opcode].op !== Operation.invalid) {
        throw new Error(`OpCode ${hex8(opcode)} is already assign`);
    }

    instructions[opcode] = {
        ...instructions[opcode],
        ...instruction,
        opcode,
    };
}

const instructions = new Array<Instruction>(0x200);

for (let i = 0; i < 0x200; i++)
    instructions[i] = {
        opcode: i,
        op: Operation.invalid,
        par1: 0,
        mode1: AddressingMode.none,
        par2: 0,
        mode2: AddressingMode.none,
        cycles: 0,
        len: 1,
        condition: Condition.always,
    };

apply(0xd3, { op: Operation.none, cycles: 1, len: 1 });
apply(0xdb, { op: Operation.none, cycles: 1, len: 1 });
apply(0xdd, { op: Operation.none, cycles: 1, len: 1 });
apply(0xe3, { op: Operation.none, cycles: 1, len: 1 });
apply(0xe4, { op: Operation.none, cycles: 1, len: 1 });
apply(0xeb, { op: Operation.none, cycles: 1, len: 1 });
apply(0xec, { op: Operation.none, cycles: 1, len: 1 });
apply(0xed, { op: Operation.none, cycles: 1, len: 1 });
apply(0xf4, { op: Operation.none, cycles: 1, len: 1 });
apply(0xfc, { op: Operation.none, cycles: 1, len: 1 });
apply(0xfd, { op: Operation.none, cycles: 1, len: 1 });

apply(0x00, { op: Operation.nop, cycles: 1, len: 1 });
apply(0x10, { op: Operation.stop, cycles: 1, len: 1 });
apply(0x37, { op: Operation.scf, cycles: 1, len: 1 });
apply(0x76, { op: Operation.halt, cycles: 1, len: 1 });
apply(0xf3, { op: Operation.di, cycles: 1, len: 1 });
apply(0xfb, { op: Operation.ei, cycles: 1, len: 1 });

apply(0xc3, { op: Operation.jp, mode1: AddressingMode.imm16, cycles: 3, len: 3 });
apply(0xc2, { op: Operation.jp, mode1: AddressingMode.imm16, condition: Condition.nz, cycles: 3, len: 3 });
apply(0xca, { op: Operation.jp, mode1: AddressingMode.imm16, condition: Condition.z, cycles: 3, len: 3 });
apply(0xd2, { op: Operation.jp, mode1: AddressingMode.imm16, condition: Condition.nc, cycles: 3, len: 3 });
apply(0xda, { op: Operation.jp, mode1: AddressingMode.imm16, condition: Condition.c, cycles: 3, len: 3 });

apply(0xe9, { op: Operation.jp, par1: r16.hl, mode1: AddressingMode.reg16, cycles: 1, len: 1 });

apply(0x18, { op: Operation.jr, mode1: AddressingMode.imm8, cycles: 2, len: 2 });
apply(0x20, { op: Operation.jr, mode1: AddressingMode.imm8, condition: Condition.nz, cycles: 2, len: 2 });
apply(0x28, { op: Operation.jr, mode1: AddressingMode.imm8, condition: Condition.z, cycles: 2, len: 2 });
apply(0x30, { op: Operation.jr, mode1: AddressingMode.imm8, condition: Condition.nc, cycles: 2, len: 2 });
apply(0x38, { op: Operation.jr, mode1: AddressingMode.imm8, condition: Condition.c, cycles: 2, len: 2 });

apply(0xcd, { op: Operation.call, mode1: AddressingMode.imm16, cycles: 3, len: 3 });
apply(0xc4, { op: Operation.call, mode1: AddressingMode.imm16, condition: Condition.nz, cycles: 3, len: 3 });
apply(0xd4, { op: Operation.call, mode1: AddressingMode.imm16, condition: Condition.z, cycles: 3, len: 3 });
apply(0xcc, { op: Operation.call, mode1: AddressingMode.imm16, condition: Condition.nc, cycles: 3, len: 3 });
apply(0xdc, { op: Operation.call, mode1: AddressingMode.imm16, condition: Condition.c, cycles: 3, len: 3 });

apply(0xc9, { op: Operation.ret, cycles: 1, len: 1 });
apply(0xc0, { op: Operation.ret, condition: Condition.nz, cycles: 2, len: 1 });
apply(0xc8, { op: Operation.ret, condition: Condition.z, cycles: 2, len: 1 });
apply(0xd0, { op: Operation.ret, condition: Condition.nc, cycles: 2, len: 1 });
apply(0xd8, { op: Operation.ret, condition: Condition.c, cycles: 2, len: 1 });
apply(0xd9, { op: Operation.reti, cycles: 4, len: 1 });

apply(0x2f, { op: Operation.cpl, cycles: 1, len: 1 });

// 0x80, 0x81, 0x82, 0x83, 0x84, 0x85
// 0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8d
// 0x90, 0x91, 0x92, 0x93, 0x94, 0x95
// 0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9d
// 0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5
// 0xa8, 0xa9, 0xaa, 0xab, 0xac, 0xad
// 0xb0, 0xb1, 0xb2, 0xb3, 0xb4, 0xb5
// 0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8d
[r8.b, r8.c, r8.d, r8.e, r8.h, r8.l].forEach((reg, i) => {
    apply(0x80 + i, { op: Operation.add, par1: r8.a, mode1: AddressingMode.reg8, par2: reg, mode2: AddressingMode.reg8, cycles: 1, len: 1 });
    apply(0x88 + i, { op: Operation.adc, par1: r8.a, mode1: AddressingMode.reg8, par2: reg, mode2: AddressingMode.reg8, cycles: 1, len: 1 });
    apply(0x90 + i, { op: Operation.sub, par1: reg, mode1: AddressingMode.reg8, cycles: 1, len: 1 });
    apply(0x98 + i, { op: Operation.sbc, par1: r8.a, mode1: AddressingMode.reg8, par2: reg, mode2: AddressingMode.reg8, cycles: 1, len: 1 });
    apply(0xa0 + i, { op: Operation.and, par1: reg, mode1: AddressingMode.reg8, cycles: 1, len: 1 });
    apply(0xa8 + i, { op: Operation.xor, par1: reg, mode1: AddressingMode.reg8, cycles: 1, len: 1 });
    apply(0xb0 + i, { op: Operation.or, par1: reg, mode1: AddressingMode.reg8, cycles: 1, len: 1 });
    apply(0xb8 + i, { op: Operation.cp, par1: reg, mode1: AddressingMode.reg8, cycles: 1, len: 1 });
});

apply(0x87, { op: Operation.add, par1: r8.a, mode1: AddressingMode.reg8, par2: r8.a, mode2: AddressingMode.reg8, cycles: 1, len: 1 });
apply(0x8f, { op: Operation.adc, par1: r8.a, mode1: AddressingMode.reg8, par2: r8.a, mode2: AddressingMode.reg8, cycles: 1, len: 1 });
apply(0x97, { op: Operation.sub, par1: r8.a, mode1: AddressingMode.reg8, cycles: 1, len: 1 });
apply(0x9f, { op: Operation.sub, par1: r8.a, mode1: AddressingMode.reg8, par2: r8.a, mode2: AddressingMode.reg8, cycles: 1, len: 1 });
apply(0xa7, { op: Operation.and, par1: r8.a, mode1: AddressingMode.reg8, cycles: 1, len: 1 });
apply(0xaf, { op: Operation.xor, par1: r8.a, mode1: AddressingMode.reg8, cycles: 1, len: 1 });
apply(0xb7, { op: Operation.or, par1: r8.a, mode1: AddressingMode.reg8, cycles: 1, len: 1 });
apply(0xbf, { op: Operation.cp, par1: r8.a, mode1: AddressingMode.reg8, cycles: 1, len: 1 });

apply(0x86, { op: Operation.add, par1: r8.a, mode1: AddressingMode.reg8, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 2, len: 1 });
apply(0x8e, { op: Operation.adc, par1: r8.a, mode1: AddressingMode.reg8, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 2, len: 1 });
apply(0x96, { op: Operation.sub, par1: r16.hl, mode1: AddressingMode.reg16ind8, cycles: 2, len: 1 });
apply(0x9e, { op: Operation.sbc, par1: r8.a, mode1: AddressingMode.reg8, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 2, len: 1 });
apply(0xa6, { op: Operation.and, par1: r16.hl, mode1: AddressingMode.reg16ind8, cycles: 2, len: 1 });
apply(0xae, { op: Operation.xor, par1: r16.hl, mode1: AddressingMode.reg16ind8, cycles: 2, len: 1 });
apply(0xb6, { op: Operation.or, par1: r16.hl, mode1: AddressingMode.reg16ind8, cycles: 2, len: 1 });
apply(0xbe, { op: Operation.cp, par1: r16.hl, mode1: AddressingMode.reg16ind8, cycles: 2, len: 1 });

apply(0xc6, { op: Operation.add, par1: r8.a, mode1: AddressingMode.reg8, mode2: AddressingMode.imm8, cycles: 2, len: 2 });
apply(0xce, { op: Operation.adc, par1: r8.a, mode1: AddressingMode.reg8, mode2: AddressingMode.imm8, cycles: 2, len: 2 });
apply(0xd6, { op: Operation.sub, mode1: AddressingMode.imm8, cycles: 2, len: 2 });
apply(0xde, { op: Operation.sbc, par1: r8.a, mode1: AddressingMode.reg8, mode2: AddressingMode.imm8, cycles: 2, len: 2 });
apply(0xe6, { op: Operation.and, mode1: AddressingMode.imm8, cycles: 2, len: 2 });
apply(0xee, { op: Operation.xor, mode1: AddressingMode.imm8, cycles: 2, len: 2 });
apply(0xf6, { op: Operation.or, mode1: AddressingMode.imm8, cycles: 2, len: 2 });
apply(0xfe, { op: Operation.cp, mode1: AddressingMode.imm8, cycles: 2, len: 2 });

// 0x01, 0x11, 0x21, 0x31
[r16.bc, r16.de, r16.hl, r16.sp].forEach((reg, i) => {
    apply((i << 4) | 0x01, { op: Operation.ld, par1: reg, mode1: AddressingMode.reg16, mode2: AddressingMode.imm16, cycles: 3, len: 3 });
});

apply(0x34, { op: Operation.inc, par1: r16.hl, mode1: AddressingMode.reg16ind8, cycles: 3, len: 1 });
apply(0x35, { op: Operation.dec, par1: r16.hl, mode1: AddressingMode.reg16ind8, cycles: 3, len: 1 });
apply(0x36, { op: Operation.ld, par1: r16.hl, mode1: AddressingMode.reg16ind8, mode2: AddressingMode.imm8, cycles: 3, len: 2 });

apply(0xf0, { op: Operation.ld, par1: r8.a, mode1: AddressingMode.reg8, mode2: AddressingMode.imm8io, cycles: 3, len: 2 });
apply(0xe0, { op: Operation.ld, mode1: AddressingMode.imm8io, par2: r8.a, mode2: AddressingMode.reg8, cycles: 3, len: 2 });

apply(0xf2, { op: Operation.ld, par1: r8.a, mode1: AddressingMode.reg8, par2: r8.c, mode2: AddressingMode.reg8io, cycles: 2, len: 1 });
apply(0xe2, { op: Operation.ld, par1: r8.c, mode1: AddressingMode.reg8io, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 1 });

apply(0xea, { op: Operation.ld, mode1: AddressingMode.imm16ind8, par2: r8.a, mode2: AddressingMode.reg8, cycles: 4, len: 3 });
apply(0xfa, { op: Operation.ld, par1: r8.a, mode1: AddressingMode.reg8, mode2: AddressingMode.imm16ind8, cycles: 4, len: 3 });

// 0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47
// 0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57
// 0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67
[r8.b, r8.d, r8.h].forEach((reg1, i1) => {
    [r8.b, r8.c, r8.d, r8.e, r8.h, r8.l].forEach((reg2, i2) => {
        // prettier-ignore
        apply(((4 + i1) << 4) | i2, { op: Operation.ld, par1: reg1, mode1: AddressingMode.reg8, par2: reg2, mode2: AddressingMode.reg8, cycles: 1, len: 1, });
    });
    // prettier-ignore
    apply(((4 + i1) << 4) | 0x06, { op: Operation.ld, par1: reg1, mode1: AddressingMode.reg8, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 2, len: 1, });
    apply(((4 + i1) << 4) | 0x07, { op: Operation.ld, par1: reg1, mode1: AddressingMode.reg8, par2: r8.a, mode2: AddressingMode.reg8, cycles: 1, len: 1 });
});

// 0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f
// 0x58, 0x59, 0x5a, 0x5b, 0x5c, 0x5d, 0x5e, 0x5f
// 0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f
// 0x78, 0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f
[r8.c, r8.e, r8.l, r8.a].forEach((reg1, i1) => {
    [r8.b, r8.c, r8.d, r8.e, r8.h, r8.l].forEach((reg2, i2) => {
        // prettier-ignore
        apply(((4 + i1) << 4) | (8 + i2), { op: Operation.ld, par1: reg1, mode1: AddressingMode.reg8, par2: reg2, mode2: AddressingMode.reg8, cycles: 1, len: 1, });
    });
    // prettier-ignore
    apply(((4 + i1) << 4) | 0x0e, { op: Operation.ld, par1: reg1, mode1: AddressingMode.reg8, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 2, len: 1, });
    apply(((4 + i1) << 4) | 0x0f, { op: Operation.ld, par1: reg1, mode1: AddressingMode.reg8, par2: r8.a, mode2: AddressingMode.reg8, cycles: 1, len: 1 });
});

// 0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x77
[r8.b, r8.c, r8.d, r8.e, r8.h, r8.l, -1, r8.a].forEach((reg, i) => {
    if (reg === -1) return; // 0x76 is HALT
    apply((0x07 << 4) | i, { op: Operation.ld, par1: r16.hl, mode1: AddressingMode.reg16ind8, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 1 });
});

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

apply(0x02, { op: Operation.ld, par1: r16.bc, mode1: AddressingMode.reg16ind8, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 1 });
apply(0x12, { op: Operation.ld, par1: r16.de, mode1: AddressingMode.reg16ind8, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 1 });

apply(0x0a, { op: Operation.ld, par1: r8.a, mode1: AddressingMode.reg8, par2: r16.bc, mode2: AddressingMode.reg16ind8, cycles: 2, len: 1 });
apply(0x1a, { op: Operation.ld, par1: r8.a, mode1: AddressingMode.reg8, par2: r16.de, mode2: AddressingMode.reg16ind8, cycles: 2, len: 1 });

apply(0x22, { op: Operation.ldi, par1: r16.hl, mode1: AddressingMode.reg16ind8, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 1 });
apply(0x32, { op: Operation.ldd, par1: r16.hl, mode1: AddressingMode.reg16ind8, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 1 });

apply(0x2a, { op: Operation.ldi, par1: r8.a, mode1: AddressingMode.reg8, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 2, len: 1 });
apply(0x3a, { op: Operation.ldd, par1: r8.a, mode1: AddressingMode.reg8, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 2, len: 1 });

apply(0x07, { op: Operation.rlca, cycles: 1, len: 1 });
apply(0x17, { op: Operation.rla, cycles: 1, len: 1 });

apply(0x0f, { op: Operation.rrca, cycles: 1, len: 1 });
apply(0x1f, { op: Operation.rra, cycles: 1, len: 1 });

// 0x03, 0x13, 0x23, 0x33
// 0x09, 0x19, 0x29, 0x39
// 0x0b, 0x1b, 0x2b, 0x3b
[r16.bc, r16.de, r16.hl, r16.sp].forEach((reg, i) => {
    apply((i << 4) | 0x03, { op: Operation.inc16, par1: reg, mode1: AddressingMode.reg16, cycles: 2, len: 1 });
    apply((i << 4) | 0x09, { op: Operation.add16, par1: r16.hl, mode1: AddressingMode.reg16, par2: reg, mode2: AddressingMode.reg16, cycles: 2, len: 1 });
    apply((i << 4) | 0x0b, { op: Operation.dec16, par1: reg, mode1: AddressingMode.reg16, cycles: 2, len: 1 });
});

[r16.bc, r16.de, r16.hl, r16.af].forEach((reg, i) => {
    apply(((i + 0xc) << 4) | 0x05, { op: Operation.push, par1: reg, mode1: AddressingMode.reg16, cycles: 4, len: 1 });
    apply(((i + 0xc) << 4) | 0x01, { op: Operation.pop, par1: reg, mode1: AddressingMode.reg16, cycles: 3, len: 1 });
});

apply(0xcb, { op: Operation.cb, mode1: AddressingMode.cb, cycles: 1, len: 1 });

// 0xc7, 0xd7, 0xe7, 0xf7
[0x00, 0x10, 0x20, 0x30].forEach((target, i) =>
    apply(((0xc + i) << 4) | 0x7, { op: Operation.rst, mode1: AddressingMode.implicit, par1: target, cycles: 4, len: 1 })
);

// 0xcf, 0xdf, 0xef, 0xff
[0x08, 0x18, 0x28, 0x38].forEach((target, i) =>
    apply(((0xc + i) << 4) | 0xf, { op: Operation.rst, mode1: AddressingMode.implicit, par1: target, cycles: 4, len: 1 })
);

/*********************/
/* prefix cb opcodes */
/*********************/

// 0x00, 0x01, 0x02, 0x03, 0x04, 0x05 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d
// 0x10, 0x11, 0x12, 0x13, 0x14, 0x15 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d
// 0x20, 0x21, 0x22, 0x23, 0x24, 0x25 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d
// 0x30, 0x31, 0x32, 0x33, 0x34, 0x35 0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d
// 0x40, 0x41, 0x42, 0x43, 0x44, 0x45 0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x4d
// 0x50, 0x51, 0x52, 0x53, 0x54, 0x55 0x58, 0x59, 0x5a, 0x5b, 0x5c, 0x5d
// 0x60, 0x61, 0x62, 0x63, 0x64, 0x65 0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d
// 0x70, 0x71, 0x72, 0x73, 0x74, 0x75 0x78, 0x79, 0x7a, 0x7b, 0x7c, 0x7d
// 0x80, 0x81, 0x82, 0x83, 0x84, 0x85 0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8d
// 0x90, 0x91, 0x92, 0x93, 0x94, 0x95 0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9d
// 0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5 0xa8, 0xa9, 0xaa, 0xab, 0xac, 0xad
// 0xb0, 0xb1, 0xb2, 0xb3, 0xb4, 0xb5 0xb8, 0xb9, 0xba, 0xbb, 0xbc, 0xbd
// 0xc0, 0xc1, 0xc2, 0xc3, 0xc4, 0xc5 0xc8, 0xc9, 0xca, 0xcb, 0xcc, 0xcd
// 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5 0xd8, 0xd9, 0xda, 0xdb, 0xdc, 0xdd
// 0xe0, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5 0xe8, 0xe9, 0xea, 0xeb, 0xec, 0xed
// 0xf0, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5 0xf8, 0xf9, 0xfa, 0xfb, 0xfc, 0xfd
[r8.b, r8.c, r8.d, r8.e, r8.h, r8.l].forEach((reg, i) => {
    apply(0xcb00 + i, { op: Operation.rlc, par1: reg, mode1: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcb08 + i, { op: Operation.rrc, par1: reg, mode1: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcb10 + i, { op: Operation.rl, par1: reg, mode1: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcb18 + i, { op: Operation.rr, par1: reg, mode1: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcb20 + i, { op: Operation.sla, par1: reg, mode1: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcb28 + i, { op: Operation.sra, par1: reg, mode1: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcb30 + i, { op: Operation.swap, par1: reg, mode1: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcb38 + i, { op: Operation.srl, par1: reg, mode1: AddressingMode.reg8, cycles: 2, len: 2 });

    apply(0xcb40 + i, { op: Operation.bit, par1: 0, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcb48 + i, { op: Operation.bit, par1: 1, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcb50 + i, { op: Operation.bit, par1: 2, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcb58 + i, { op: Operation.bit, par1: 3, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcb60 + i, { op: Operation.bit, par1: 4, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcb68 + i, { op: Operation.bit, par1: 5, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcb70 + i, { op: Operation.bit, par1: 6, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcb78 + i, { op: Operation.bit, par1: 7, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });

    apply(0xcb80 + i, { op: Operation.res, par1: 0, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcb88 + i, { op: Operation.res, par1: 1, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcb90 + i, { op: Operation.res, par1: 2, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcb98 + i, { op: Operation.res, par1: 3, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcba0 + i, { op: Operation.res, par1: 4, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcba8 + i, { op: Operation.res, par1: 5, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcbb0 + i, { op: Operation.res, par1: 6, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcbb8 + i, { op: Operation.res, par1: 7, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });

    apply(0xcbc0 + i, { op: Operation.set, par1: 0, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcbc8 + i, { op: Operation.set, par1: 1, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcbd0 + i, { op: Operation.set, par1: 2, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcbd8 + i, { op: Operation.set, par1: 3, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcbe0 + i, { op: Operation.set, par1: 4, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcbe8 + i, { op: Operation.set, par1: 5, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcbf0 + i, { op: Operation.set, par1: 6, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
    apply(0xcbf8 + i, { op: Operation.set, par1: 7, mode1: AddressingMode.bit, par2: reg, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
});

apply(0xcb07, { op: Operation.rlc, par1: r8.a, mode1: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcb0f, { op: Operation.rrc, par1: r8.a, mode1: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcb17, { op: Operation.rl, par1: r8.a, mode1: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcb1f, { op: Operation.rr, par1: r8.a, mode1: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcb27, { op: Operation.sla, par1: r8.a, mode1: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcb2f, { op: Operation.sra, par1: r8.a, mode1: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcb37, { op: Operation.swap, par1: r8.a, mode1: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcb3f, { op: Operation.srl, par1: r8.a, mode1: AddressingMode.reg8, cycles: 2, len: 2 });

apply(0xcb47, { op: Operation.bit, par1: 0, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcb4f, { op: Operation.bit, par1: 1, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcb57, { op: Operation.bit, par1: 2, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcb5f, { op: Operation.bit, par1: 3, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcb67, { op: Operation.bit, par1: 4, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcb6f, { op: Operation.bit, par1: 5, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcb77, { op: Operation.bit, par1: 6, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcb7f, { op: Operation.bit, par1: 7, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });

apply(0xcb87, { op: Operation.res, par1: 0, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcb8f, { op: Operation.res, par1: 1, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcb97, { op: Operation.res, par1: 2, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcb9f, { op: Operation.res, par1: 3, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcba7, { op: Operation.res, par1: 4, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcbaf, { op: Operation.res, par1: 5, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcbb7, { op: Operation.res, par1: 6, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcbbf, { op: Operation.res, par1: 7, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });

apply(0xcbc7, { op: Operation.set, par1: 0, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcbcf, { op: Operation.set, par1: 1, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcbd7, { op: Operation.set, par1: 2, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcbdf, { op: Operation.set, par1: 3, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcbe7, { op: Operation.set, par1: 4, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcbef, { op: Operation.set, par1: 5, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcbf7, { op: Operation.set, par1: 6, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });
apply(0xcbff, { op: Operation.set, par1: 7, mode1: AddressingMode.bit, par2: r8.a, mode2: AddressingMode.reg8, cycles: 2, len: 2 });

apply(0xcb06, { op: Operation.rlc, par1: r16.hl, mode1: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcb0e, { op: Operation.rrc, par1: r16.hl, mode1: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcb16, { op: Operation.rl, par1: r16.hl, mode1: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcb1e, { op: Operation.rr, par1: r16.hl, mode1: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcb26, { op: Operation.sla, par1: r16.hl, mode1: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcb2e, { op: Operation.sra, par1: r16.hl, mode1: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcb36, { op: Operation.swap, par1: r16.hl, mode1: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcb3e, { op: Operation.srl, par1: r16.hl, mode1: AddressingMode.reg16ind8, cycles: 4, len: 2 });

apply(0xcb46, { op: Operation.bit, par1: 0, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcb4e, { op: Operation.bit, par1: 1, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcb56, { op: Operation.bit, par1: 2, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcb5e, { op: Operation.bit, par1: 3, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcb66, { op: Operation.bit, par1: 4, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcb6e, { op: Operation.bit, par1: 5, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcb76, { op: Operation.bit, par1: 6, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcb7e, { op: Operation.bit, par1: 7, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });

apply(0xcb86, { op: Operation.res, par1: 0, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcb8e, { op: Operation.res, par1: 1, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcb96, { op: Operation.res, par1: 2, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcb9e, { op: Operation.res, par1: 3, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcba6, { op: Operation.res, par1: 4, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcbae, { op: Operation.res, par1: 5, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcbb6, { op: Operation.res, par1: 6, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcbbe, { op: Operation.res, par1: 7, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });

apply(0xcbc6, { op: Operation.set, par1: 0, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcbce, { op: Operation.set, par1: 1, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcbd6, { op: Operation.set, par1: 2, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcbde, { op: Operation.set, par1: 3, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcbe6, { op: Operation.set, par1: 4, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcbee, { op: Operation.set, par1: 5, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcbf6, { op: Operation.set, par1: 6, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
apply(0xcbfe, { op: Operation.set, par1: 7, mode1: AddressingMode.bit, par2: r16.hl, mode2: AddressingMode.reg16ind8, cycles: 4, len: 2 });
