import { AddressingMode, Operation, decodeInstruction, disassembleInstruction } from '../../src/emulator/instruction';

import { Bus } from '../../src/emulator/bus';
import { Clock } from '../../src/emulator/clock';
import { Cpu } from '../../src/emulator/cpu';
import { Interrupt } from '../../src/emulator/interrupt';
import { System } from '../../src/emulator/system';
import { TestEnvironment } from './test_environment';
import { hex8 } from '../../src/helper/format';

export interface Environment {
    bus: Bus;
    cpu: Cpu;
    system: System;
    clock: Clock;
    interrupt: Interrupt;
    cartridge: Uint8Array;
    env: TestEnvironment;
}

export function newEnvironment(code: ArrayLike<number>, address = 0x100): Environment {
    const env = new TestEnvironment(code, address);

    return {
        bus: env.bus,
        cpu: env.cpu,
        system: env.system,
        clock: env.clock,
        interrupt: env.interrupt,
        cartridge: env.cartridge,
        env: env,
    };
}

export const lengthFromMode = function (mode: AddressingMode): number {
    switch (mode) {
        case AddressingMode.none:
        case AddressingMode.implicit:
        case AddressingMode.bit:
        case AddressingMode.reg8:
        case AddressingMode.reg8io:
        case AddressingMode.reg16:
        case AddressingMode.reg16ind8:
            return 0;

        case AddressingMode.imm8:
        case AddressingMode.imm8io:
        case AddressingMode.imm8sign:
            return 1;

        case AddressingMode.imm16:
        case AddressingMode.imm16ind8:
        case AddressingMode.imm16ind16:
            return 2;

        default:
            throw new Error(`bad addressing mode ${hex8(mode)}`);
    }
};

const opcodes = Array.from({ length: 0x1ff }, (_, i) => i);

export const opcodeMemoryMap = function () {
    return opcodes.reduce((acc, opcode) => {
        let par1 = 0;
        if (opcode > 0xff) {
            par1 = opcode - 0x100;
            opcode = 0xcb;
        }
        return acc.concat([opcode, par1, 0x20]);
    }, [] as Array<number>);
};

export const opcodesTestsMap = function (bus: Bus, address: number) {
    return (
        opcodes
            // build test case object
            .map((opcode) => {
                const currentAddress = address + 3 * opcode;
                const instruction = decodeInstruction(bus, currentAddress);

                // skip not defined (invalid) operations
                switch (instruction.op) {
                    case Operation.invalid:
                    case Operation.halt:
                    case Operation.stop:
                    case Operation.reserved:
                        return;
                }

                const description = disassembleInstruction(bus, currentAddress);

                return { opcode, description, instruction, currentAddress };
            })
            // remove undefined elements
            .filter((n) => n)
    );
};
