import { AddressingMode, Operation, decodeInstruction, disassembleInstruction } from '../../src/emulator/instruction';
import { Environment, newEnvironment } from '../support/_helper';

import { hex8 } from '../../src/helper/format';

describe('The opcode instructions', () => {
    function setup(code: ArrayLike<number>): Environment {
        return newEnvironment(code);
    }

    describe('consistency checks', () => {
        function cyclesForMode(mode: AddressingMode): number {
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
                    return 1;

                case AddressingMode.imm16:
                case AddressingMode.imm16ind8:
                    return 2;

                default:
                    throw new Error(`bad addressing mode ${hex8(mode)}`);
            }
        }

        const opcodes = Array.from({ length: 0x1ff }, (_, i) => i);
        const { bus, cpu, env } = setup(
            opcodes.reduce((acc, x) => {
                let y = 0;
                if (x > 0xff) {
                    y = x - 0x100;
                    x = 0xcb;
                }
                return acc.concat([x, y, 0]);
            }, [] as Array<number>)
        );
        const address = cpu.state.p;

        const modes = [AddressingMode.imm8, AddressingMode.imm16ind8, AddressingMode.imm8io, AddressingMode.imm16];
        const jumpOperations = [Operation.jp, Operation.jr, Operation.call, Operation.ret, Operation.reti, Operation.rst];

        afterEach(() => {
            env.reset();
        });

        opcodes.forEach((opcode) => {
            const instruction = decodeInstruction(bus, address + 3 * opcode);
            const currentAddress = address + 3 * opcode;

            // skip not defined (invalid) operations
            if (instruction.op === Operation.invalid) return;

            describe(disassembleInstruction(bus, currentAddress), () => {
                it('has cycles set', () => {
                    expect(instruction.cycles).toBeGreaterThan(0);
                });

                it('has correct len set', () => {
                    const len = bus.read(currentAddress) === 0xcb ? 2 : 1;
                    expect(instruction.len).toBe(len + cyclesForMode(instruction.mode1) + cyclesForMode(instruction.mode2));
                });

                it('does not load both parameters from memory', () => {
                    expect(modes.includes(instruction.mode1) && modes.includes(instruction.mode2)).not.toBe(true);
                });

                it('moves the process pointer', () => {
                    cpu.state.p = currentAddress;

                    let expectedAddress = currentAddress + 1;
                    if (jumpOperations.includes(instruction.op)) {
                        expectedAddress = 0x0000;
                    }

                    try {
                        cpu.step(1);

                        expect(cpu.state.p).toBeGreaterThanOrEqual(expectedAddress);
                    } catch (e: unknown) {
                        if (typeof e === 'string') {
                            throw e;
                        } else if (e instanceof Error) {
                            if (!e.message.startsWith('invalid instruction')) {
                                throw e;
                            }
                        }
                    }
                });
            });
        });
    });
});
