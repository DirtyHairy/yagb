import { hex16, hex8 } from '../helper/format';
import { r16, r8 } from './cpu';

import { Bus } from './bus';

export const enum Operation {
    invalid,
    call,
    cp,
    dec,
    di,
    inc,
    jp,
    jrnz,
    ld,
    ldd,
    ldi,
    nop,
    xor,
}

export const enum AddressingMode {
    implicit,
    imm16,
    imm8,
    reg8,
    reg16_imm16,
    reg8_imm8,
    imm8_reg8,
    immind8_reg8,
    ind8_reg8,
    ind8_imm8,
    reg8_ind8,
    reg8_reg8,
    imm8io_reg8,
    reg8_imm8io,
    reg8io_reg8,
    reg8_reg8io,
}

export interface Instruction {
    opcode: number;
    operation: Operation;
    addressingMode: AddressingMode;
    par1: number;
    par2: number;
    cycles: number;
    len: number;
}

export function decodeInstruction(bus: Bus, address: number): Instruction {
    return instructions[bus.read(address)];
}

export function disassemleInstruction(bus: Bus, address: number): string {
    const instruction = decodeInstruction(bus, address);
    if (instruction.operation === Operation.invalid) return `DB ${hex8(instruction.opcode)}`;

    const op = disassembleOperation(instruction.operation);

    switch (instruction.addressingMode) {
        case AddressingMode.implicit:
            return op;

        case AddressingMode.imm8:
            return `${op} ${hex8(bus.read((address + 1) & 0xffff))}`;

        case AddressingMode.imm16:
            return `${op} ${hex16(bus.read16((address + 1) & 0xffff))}`;

        case AddressingMode.reg8:
            return `${op} ${disassembleR8(instruction.par1)}`;

        case AddressingMode.reg16_imm16:
            return `${op} ${disassembleR16(instruction.par1)}, ${hex16(bus.read16((address + 1) & 0xffff))}`;

        case AddressingMode.reg8_imm8:
            return `${op} ${disassembleR8(instruction.par1)}, ${hex8(bus.read((address + 1) & 0xffff))}`;

        case AddressingMode.imm8_reg8:
            return `${op} ${hex8(bus.read((address + 1) & 0xffff))}, ${disassembleR8(instruction.par2)}`;

        case AddressingMode.immind8_reg8:
            return `${op} (${hex8(bus.read16((address + 1) & 0xffff))}), ${disassembleR8(instruction.par2)}`;

        case AddressingMode.ind8_reg8:
            return `${op} (${disassembleR16(instruction.par1)}), ${disassembleR8(instruction.par2)}`;

        case AddressingMode.reg8_ind8:
            return `${op} ${disassembleR8(instruction.par1)}, (${disassembleR16(instruction.par2)})`;

        case AddressingMode.ind8_imm8:
            return `${op} (${disassembleR16(instruction.par1)}), ${hex8(bus.read((address + 1) & 0xffff))}`;

        case AddressingMode.reg8_reg8:
            return `${op} ${disassembleR8(instruction.par1)}, ${disassembleR8(instruction.par2)}`;

        case AddressingMode.imm8io_reg8:
            return `${op} (${hex8(bus.read((address + 1) & 0xffff))}), ${disassembleR8(instruction.par2)}`;

        case AddressingMode.reg8_imm8io:
            return `${op} ${disassembleR8(instruction.par1)}, (${hex8(bus.read((address + 1) & 0xffff))})`;

        case AddressingMode.reg8io_reg8:
            return `${op} (${disassembleR8(instruction.par1)}), ${disassembleR8(instruction.par2)}`;

        case AddressingMode.reg8_reg8io:
            return `${op} ${disassembleR8(instruction.par1)}, (${disassembleR8(instruction.par2)})`;
    }
}

const instructions = new Array<Instruction>(0x100);

function disassembleOperation(operation: Operation): string {
    switch (operation) {
        case Operation.invalid:
            return 'INVALID';

        case Operation.call:
            return 'CALL';

        case Operation.cp:
            return 'CP';

        case Operation.dec:
            return 'DEC';

        case Operation.di:
            return 'DI';

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

        case Operation.xor:
            return 'XOR';

        default:
            throw new Error('bad operation');
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

function applySeriesR8_1(baseB: number, baseC: number, instruction: Partial<Instruction>): void {
    apply(baseB, { ...instruction, par1: r8.b });
    apply(baseB + 0x10, { ...instruction, par1: r8.d });
    apply(baseB + 0x20, { ...instruction, par1: r8.h });
    apply(baseC, { ...instruction, par1: r8.c });
    apply(baseC + 0x10, { ...instruction, par1: r8.e });
    apply(baseC + 0x20, { ...instruction, par1: r8.l });
    apply(baseC + 0x30, { ...instruction, par1: r8.a });
}

for (let i = 0; i < 0x100; i++)
    instructions[i] = {
        opcode: i,
        operation: Operation.invalid,
        addressingMode: AddressingMode.implicit,
        par1: 0,
        par2: 0,
        cycles: 0,
        len: 1,
    };

apply(0, { operation: Operation.nop, cycles: 1, len: 1 });
apply(0xc3, { operation: Operation.jp, addressingMode: AddressingMode.imm16, cycles: 4, len: 3 });

apply(0xa8, { operation: Operation.xor, addressingMode: AddressingMode.reg8, par1: r8.b, cycles: 1, len: 1 });
apply(0xa9, { operation: Operation.xor, addressingMode: AddressingMode.reg8, par1: r8.c, cycles: 1, len: 1 });
apply(0xaa, { operation: Operation.xor, addressingMode: AddressingMode.reg8, par1: r8.d, cycles: 1, len: 1 });
apply(0xab, { operation: Operation.xor, addressingMode: AddressingMode.reg8, par1: r8.e, cycles: 1, len: 1 });
apply(0xac, { operation: Operation.xor, addressingMode: AddressingMode.reg8, par1: r8.h, cycles: 1, len: 1 });
apply(0xad, { operation: Operation.xor, addressingMode: AddressingMode.reg8, par1: r8.l, cycles: 1, len: 1 });
apply(0xaf, { operation: Operation.xor, addressingMode: AddressingMode.reg8, par1: r8.a, cycles: 1, len: 1 });

apply(0x31, { operation: Operation.ld, addressingMode: AddressingMode.reg16_imm16, par1: r16.sp, cycles: 3, len: 3 });
apply(0x21, { operation: Operation.ld, addressingMode: AddressingMode.reg16_imm16, par1: r16.hl, cycles: 3, len: 3 });
apply(0x11, { operation: Operation.ld, addressingMode: AddressingMode.reg16_imm16, par1: r16.de, cycles: 3, len: 3 });
apply(0x01, { operation: Operation.ld, addressingMode: AddressingMode.reg16_imm16, par1: r16.bc, cycles: 3, len: 3 });
apply(0x36, { operation: Operation.ld, addressingMode: AddressingMode.ind8_imm8, par1: r16.hl, cycles: 3, len: 2 });
apply(0xea, { operation: Operation.ld, addressingMode: AddressingMode.immind8_reg8, par2: r8.a, cycles: 4, len: 3 });
apply(0xf0, { operation: Operation.ld, addressingMode: AddressingMode.reg8_imm8io, par1: r8.a, cycles: 3, len: 2 });
apply(0xe0, { operation: Operation.ld, addressingMode: AddressingMode.imm8io_reg8, par2: r8.a, cycles: 3, len: 2 });
apply(0xe2, { operation: Operation.ld, addressingMode: AddressingMode.reg8io_reg8, par1: r8.c, cycles: 2, len: 1 });
apply(0xf2, { operation: Operation.ld, addressingMode: AddressingMode.reg8_reg8io, par2: r8.c, cycles: 2, len: 1 });

applySeriesR8_1(0x06, 0x0e, { operation: Operation.ld, addressingMode: AddressingMode.reg8_imm8, cycles: 2, len: 2 });

apply(0x22, { operation: Operation.ldi, addressingMode: AddressingMode.ind8_reg8, par1: r16.hl, par2: r8.a, cycles: 2, len: 1 });
apply(0x32, { operation: Operation.ldd, addressingMode: AddressingMode.ind8_reg8, par1: r16.hl, par2: r8.a, cycles: 2, len: 1 });
apply(0x2a, { operation: Operation.ldi, addressingMode: AddressingMode.reg8_ind8, par1: r8.a, par2: r16.hl, cycles: 2, len: 1 });
apply(0x3a, { operation: Operation.ldd, addressingMode: AddressingMode.reg8_ind8, par1: r8.a, par2: r16.hl, cycles: 2, len: 1 });

applySeriesR8_1(0x04, 0x0c, { operation: Operation.inc, addressingMode: AddressingMode.reg8, cycles: 1, len: 1 });
applySeriesR8_1(0x05, 0x0d, { operation: Operation.dec, addressingMode: AddressingMode.reg8, cycles: 1, len: 1 });

apply(0x20, { operation: Operation.jrnz, addressingMode: AddressingMode.imm8, cycles: 2, len: 2 });

apply(0xf3, { operation: Operation.di, addressingMode: AddressingMode.implicit, cycles: 1, len: 1 });

apply(0xfe, { operation: Operation.cp, addressingMode: AddressingMode.imm8, cycles: 2, len: 2 });

apply(0xcd, { operation: Operation.call, addressingMode: AddressingMode.imm16, cycles: 8, len: 3 });
