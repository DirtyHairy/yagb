import { AddressingMode, Instruction, Operation, decodeInstruction } from '../../src/emulator/instruction';
import { Environment, lengthFromMode, newEnvironment, opcodeMemoryMap, opcodesTestsMap } from '../support/_helper';

describe('The opcode instructions', () => {
    function setup(code: ArrayLike<number>): Environment {
        return newEnvironment(code);
    }

    describe('consistency checks', () => {
        const { bus, cpu, env, system } = setup(opcodeMemoryMap());
        const address = cpu.state.p;

        const memoryModes = [
            AddressingMode.imm8,
            AddressingMode.imm8io,
            AddressingMode.imm8sign,
            AddressingMode.imm16,
            AddressingMode.imm16ind16,
            AddressingMode.imm16ind8,
        ];
        const jumpOperations = [Operation.jp, Operation.jr, Operation.call, Operation.ret, Operation.reti, Operation.rst];

        afterEach(() => {
            env.reset();
        });

        const instruc = decodeInstruction(bus, address);

        describe.each(
            opcodesTestsMap(bus, address) as Array<{
                opcode: number;
                description: string;
                instruction: Instruction;
                currentAddress: number;
            }>
        )('$description', ({ opcode, description, instruction, currentAddress }) => {
            it('has cycles set', () => {
                if (instruction.opcode !== 0xe9) expect(instruction.cycles).toBeGreaterThan(0);
            });

            it('has len set', () => {
                expect(instruction.len).toBeGreaterThan(0);
            });

            it('has correct len set', () => {
                const len = bus.read(currentAddress) === 0xcb ? 2 : 1;
                expect(instruction.len).toBe(len + lengthFromMode(instruction.mode1) + lengthFromMode(instruction.mode2));
            });

            it('does not load both parameters from memory', () => {
                expect(memoryModes.includes(instruction.mode1) && memoryModes.includes(instruction.mode2)).not.toBe(true);
            });

            it('moves the process pointer', () => {
                cpu.state.p = currentAddress;

                let expectedAddress = currentAddress + 1;
                if (jumpOperations.includes(instruction.op)) {
                    expectedAddress = 0x0000;
                }

                try {
                    system.clearTrap();
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
