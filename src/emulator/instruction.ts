import { Bus } from './bus';
import { hex8 } from '../helper/format';

export const enum Operation {
    invalid,
    nop,
}

export const enum AddressingMode {
    implicit,
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

export function disassemleInstruction(instruction: Instruction): string {
    return instruction.operation === Operation.invalid
        ? `db ${hex8(instruction.opcode)}`
        : disassembleOperation(instruction.operation);
}

const instructions = new Array<Instruction>(0x100);

function disassembleOperation(operation: Operation): string {
    switch (operation) {
        case Operation.invalid:
            return 'invalid';

        case Operation.nop:
            return 'nop';

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
