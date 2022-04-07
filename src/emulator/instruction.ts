import { hex16, hex8 } from '../helper/format';
import { r16, r8 } from './cpu';

import { Bus } from './bus';

export const enum Operation {
    invalid,
    jp,
    ld,
    ldd,
    ldi,
    nop,
    xor,
}

export const enum AddressingMode {
    implicit,
    imm16,
    reg8,
    reg16_imm16,
    reg8_imm8,
    ind_reg8,
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

        case AddressingMode.imm16:
            return `${op} ${hex16(bus.read16((address + instruction.par1) & 0xffff))}`;

        case AddressingMode.reg8:
            return `${op} ${disassembleR8(instruction.par1)}`;

        case AddressingMode.reg16_imm16:
            return `${op} ${disassembleR16(instruction.par1)}, ${hex16(bus.read16((address + instruction.par2) & 0xffff))}`;

        case AddressingMode.reg8_imm8:
            return `${op} ${disassembleR8(instruction.par1)}, ${hex8(bus.read((address + instruction.par2) & 0xffff))}`;

        case AddressingMode.ind_reg8:
            return `${op} (${disassembleR16(instruction.par1)}),${disassembleR8(instruction.par2)}`;
    }
}

const instructions = new Array<Instruction>(0x100);

function disassembleOperation(operation: Operation): string {
    switch (operation) {
        case Operation.invalid:
            return 'INVALID';

        case Operation.jp:
            return 'JP';

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
apply(0xc3, { operation: Operation.jp, addressingMode: AddressingMode.imm16, par1: 1, cycles: 4, len: 3 });

apply(0xa8, { operation: Operation.xor, addressingMode: AddressingMode.reg8, par1: r8.b, cycles: 1, len: 1 });
apply(0xa9, { operation: Operation.xor, addressingMode: AddressingMode.reg8, par1: r8.c, cycles: 1, len: 1 });
apply(0xaa, { operation: Operation.xor, addressingMode: AddressingMode.reg8, par1: r8.d, cycles: 1, len: 1 });
apply(0xab, { operation: Operation.xor, addressingMode: AddressingMode.reg8, par1: r8.e, cycles: 1, len: 1 });
apply(0xac, { operation: Operation.xor, addressingMode: AddressingMode.reg8, par1: r8.h, cycles: 1, len: 1 });
apply(0xad, { operation: Operation.xor, addressingMode: AddressingMode.reg8, par1: r8.l, cycles: 1, len: 1 });
apply(0xaf, { operation: Operation.xor, addressingMode: AddressingMode.reg8, par1: r8.a, cycles: 1, len: 1 });

apply(0x31, { operation: Operation.ld, addressingMode: AddressingMode.reg16_imm16, par1: r16.sp, par2: 1, cycles: 3, len: 3 });
apply(0x21, { operation: Operation.ld, addressingMode: AddressingMode.reg16_imm16, par1: r16.hl, par2: 1, cycles: 3, len: 3 });
apply(0x11, { operation: Operation.ld, addressingMode: AddressingMode.reg16_imm16, par1: r16.de, par2: 1, cycles: 3, len: 3 });
apply(0x01, { operation: Operation.ld, addressingMode: AddressingMode.reg16_imm16, par1: r16.bc, par2: 1, cycles: 3, len: 3 });

apply(0x06, { operation: Operation.ld, addressingMode: AddressingMode.reg8_imm8, par1: r8.b, par2: 1, cycles: 2, len: 2 });
apply(0x16, { operation: Operation.ld, addressingMode: AddressingMode.reg8_imm8, par1: r8.d, par2: 1, cycles: 2, len: 2 });
apply(0x26, { operation: Operation.ld, addressingMode: AddressingMode.reg8_imm8, par1: r8.h, par2: 1, cycles: 2, len: 2 });
apply(0x0e, { operation: Operation.ld, addressingMode: AddressingMode.reg8_imm8, par1: r8.c, par2: 1, cycles: 2, len: 2 });
apply(0x1e, { operation: Operation.ld, addressingMode: AddressingMode.reg8_imm8, par1: r8.d, par2: 1, cycles: 2, len: 2 });
apply(0x2e, { operation: Operation.ld, addressingMode: AddressingMode.reg8_imm8, par1: r8.l, par2: 1, cycles: 2, len: 2 });
apply(0x3e, { operation: Operation.ld, addressingMode: AddressingMode.reg8_imm8, par1: r8.a, par2: 1, cycles: 2, len: 2 });

apply(0x22, { operation: Operation.ldi, addressingMode: AddressingMode.ind_reg8, par1: r16.hl, par2: r8.a, cycles: 2, len: 1 });
apply(0x32, { operation: Operation.ldd, addressingMode: AddressingMode.ind_reg8, par1: r16.hl, par2: r8.a, cycles: 2, len: 1 });
