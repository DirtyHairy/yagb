import { hex16, hex8 } from '../helper/format';

import { Bus } from './bus';

export const enum Operation {
    invalid,
    nop,
    jp,
}

export const enum AddressingMode {
    implicit,
    immediate16,
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

        case AddressingMode.immediate16:
            return `${op} ${hex16(bus.read16((address + 1) & 0xffff))}`;
    }
}

const instructions = new Array<Instruction>(0x100);

function disassembleOperation(operation: Operation): string {
    switch (operation) {
        case Operation.invalid:
            return 'INVALID';

        case Operation.nop:
            return 'NOP';

        case Operation.jp:
            return 'JP';

        default:
            throw new Error('bad operation');
    }
}

function apply(opcode: number, instruction: Partial<Instruction>): void {
    instructions[opcode] = { ...instructions[opcode], ...instruction, opcode };
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
apply(0xc3, { operation: Operation.jp, addressingMode: AddressingMode.immediate16, par1: 1, cycles: 4, len: 3 });
