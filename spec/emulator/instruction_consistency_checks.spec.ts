import { AddressingMode, Operation, decodeInstruction, disassembleInstruction } from '../../src/emulator/instruction';
import { Bus, ReadHandler, WriteHandler } from '../../src/emulator/bus';

import { Cpu } from '../../src/emulator/cpu';
import { System } from '../../src/emulator/system';
import { hex8 } from '../../src/helper/format';

describe('The opcode instructions', () => {
    function setup(code: ArrayLike<number>) {
        const system = new System((msg) => console.log(msg));
        const bus = new Bus(system);

        const address = 0x100;
        const cartridge = new Uint8Array(0x8000);

        const read: ReadHandler = (address) => cartridge[address];
        const write: WriteHandler = (address, value) => (cartridge[address] = value);

        for (let i = 0; i < 0x8000; i++) {
            bus.map(i, read, write);
        }

        cartridge.subarray(address).set(code);

        return { bus, address };
    }

    describe('consistency checks', () => {
        function cyclesForMode(mode: AddressingMode): number {
            switch (mode) {
                case AddressingMode.none:
                case AddressingMode.explicit:
                case AddressingMode.reg8:
                case AddressingMode.reg8io:
                case AddressingMode.reg16:
                case AddressingMode.reg16ind8:
                    return 0;

                case AddressingMode.imm8:
                case AddressingMode.imm8io:
                    return 1;

                case AddressingMode.imm16:
                case AddressingMode.imm16ind8:
                    return 2;

                default:
                    throw new Error(`bad addressing mode ${hex8(mode)}`);
            }
        }

        const opcodes = Array.from({ length: 0x1ff }, (_, i) => i);
        const { bus, address } = setup(
            opcodes.reduce((acc, x) => {
                let y = 0;
                if (x > 0xff) {
                    y = x - 0x100;
                    x = 0xcb;
                }
                return acc.concat([x, y, 0]);
            }, [] as Array<number>)
        );

        opcodes.forEach((opcode) => {
            const instruction = decodeInstruction(bus, address + 3 * opcode);

            // skip not defined (invalid) operations
            if (instruction.op === Operation.invalid) return;

            describe(disassembleInstruction(bus, address + 3 * opcode), () => {
                it('has cycles set', () => {
                    expect(instruction.cycles).toBeGreaterThan(0);
                });

                it('has correct len set', () => {
                    const len = bus.read(address + 3 * opcode) === 0xcb ? 2 : 1;
                    expect(instruction.len).toBe(len + cyclesForMode(instruction.mode1) + cyclesForMode(instruction.mode2));
                });

                const modes = [AddressingMode.imm8, AddressingMode.imm16ind8, AddressingMode.imm8io, AddressingMode.imm16];
                it('does not load both parameters from memory', () => {
                    expect(modes.includes(instruction.mode1) && modes.includes(instruction.mode2)).not.toBe(true);
                });
            });
        });
    });
});
