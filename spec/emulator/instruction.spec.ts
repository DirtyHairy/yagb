import { AddressingMode, Operation, decodeInstruction, disassembleInstruction } from '../../src/emulator/instruction';
import { Bus, ReadHandler, WriteHandler } from '../../src/emulator/bus';

import { Cpu } from '../../src/emulator/cpu';
import { System } from '../../src/emulator/system';

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

    describe('disassembleInstruction', () => {
        describe('unknown opcode', () => {
            it('returns DB d8', () => {
                const { bus, address } = setup([0xec]);
                expect(disassembleInstruction(bus, address)).toBe('DB 0xec');
            });
        });
        describe('with no parameters', () => {
            it('returns NOP', () => {
                const { bus, address } = setup([0x0]);
                expect(disassembleInstruction(bus, address)).toBe('NOP');
            });
            it('returns DI', () => {
                const { bus, address } = setup([0xf3]);
                expect(disassembleInstruction(bus, address)).toBe('DI');
            });
            it('returns EI', () => {
                const { bus, address } = setup([0xfb]);
                expect(disassembleInstruction(bus, address)).toBe('EI');
            });
            it('returns RET', () => {
                const { bus, address } = setup([0xc9]);
                expect(disassembleInstruction(bus, address)).toBe('RET');
            });
            it('returns RETI', () => {
                const { bus, address } = setup([0xd9]);
                expect(disassembleInstruction(bus, address)).toBe('RETI');
            });
            it('returns CPL', () => {
                const { bus, address } = setup([0x2f]);
                expect(disassembleInstruction(bus, address)).toBe('CPL');
            });
        });
        describe('with no parameters and condition', () => {
            it('returns RET', () => {
                const { bus, address } = setup([0xc9]);
                expect(disassembleInstruction(bus, address)).toBe('RET');
            });
            it('returns RET NZ', () => {
                const { bus, address } = setup([0xc0]);
                expect(disassembleInstruction(bus, address)).toBe('RET NZ');
            });
            it('returns RET Z', () => {
                const { bus, address } = setup([0xc8]);
                expect(disassembleInstruction(bus, address)).toBe('RET Z');
            });
            it('returns RET NC', () => {
                const { bus, address } = setup([0xd0]);
                expect(disassembleInstruction(bus, address)).toBe('RET NC');
            });
            it('returns RET C', () => {
                const { bus, address } = setup([0xd8]);
                expect(disassembleInstruction(bus, address)).toBe('RET C');
            });
        });
        describe('with one imm8 value', () => {
            it('returns CP d8', () => {
                const { bus, address } = setup([0xfe, 0x94]);
                expect(disassembleInstruction(bus, address)).toBe('CP 0x94');
            });
            it('returns JR d8', () => {
                const { bus, address } = setup([0x18, 0x08]);
                expect(disassembleInstruction(bus, address)).toBe('JR 0x08');
            });
            it('returns AND d8', () => {
                const { bus, address } = setup([0xe6, 0x08]);
                expect(disassembleInstruction(bus, address)).toBe('AND 0x08');
            });
            it('returns OR d8', () => {
                const { bus, address } = setup([0xf6, 0x08]);
                expect(disassembleInstruction(bus, address)).toBe('OR 0x08');
            });
            it('returns XOR d8', () => {
                const { bus, address } = setup([0xee, 0x08]);
                expect(disassembleInstruction(bus, address)).toBe('XOR 0x08');
            });
        });
        describe('with one imm8 value and condition', () => {
            it('returns JR NZ, d8', () => {
                const { bus, address } = setup([0x20, 0x08]);
                expect(disassembleInstruction(bus, address)).toBe('JR NZ, 0x08');
            });
            it('returns JR Z, d8', () => {
                const { bus, address } = setup([0x28, 0x08]);
                expect(disassembleInstruction(bus, address)).toBe('JR Z, 0x08');
            });
            it('returns JR NC, d8', () => {
                const { bus, address } = setup([0x30, 0x08]);
                expect(disassembleInstruction(bus, address)).toBe('JR NC, 0x08');
            });
            it('returns JR C, d8', () => {
                const { bus, address } = setup([0x38, 0x08]);
                expect(disassembleInstruction(bus, address)).toBe('JR C, 0x08');
            });
        });
        describe('with one reg8 value', () => {
            it('returns AND B', () => {
                const { bus, address } = setup([0xa0, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('AND B');
            });
            it('returns OR B', () => {
                const { bus, address } = setup([0xb0, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('OR B');
            });
            it('returns XOR B', () => {
                const { bus, address } = setup([0xa8, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('XOR B');
            });
            it('returns INC B', () => {
                const { bus, address } = setup([0x04, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('INC B');
            });
            it('returns DEC B', () => {
                const { bus, address } = setup([0x05, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('DEC B');
            });
            it('returns CP B', () => {
                const { bus, address } = setup([0xb8, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('CP B');
            });
            it('returns AND A', () => {
                const { bus, address } = setup([0xa7, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('AND A');
            });
            it('returns OR A', () => {
                const { bus, address } = setup([0xb7, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('OR A');
            });
            it('returns XOR A', () => {
                const { bus, address } = setup([0xaf, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('XOR A');
            });
            it('returns INC A', () => {
                const { bus, address } = setup([0x3c, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('INC A');
            });
            it('returns DEC A', () => {
                const { bus, address } = setup([0x3d, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('DEC A');
            });
            it('returns CP A', () => {
                const { bus, address } = setup([0xbf, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('CP A');
            });
        });
        describe('with one reg16ind8 value', () => {
            it('returns AND (HL)', () => {
                const { bus, address } = setup([0xa6, 0x03]);
                expect(disassembleInstruction(bus, address)).toBe('AND (HL)');
            });
            it('returns OR (HL)', () => {
                const { bus, address } = setup([0xb6, 0x03]);
                expect(disassembleInstruction(bus, address)).toBe('OR (HL)');
            });
            it('returns XOR (HL)', () => {
                const { bus, address } = setup([0xae, 0x03]);
                expect(disassembleInstruction(bus, address)).toBe('XOR (HL)');
            });
            it('returns INC (HL)', () => {
                const { bus, address } = setup([0x34, 0x03]);
                expect(disassembleInstruction(bus, address)).toBe('INC (HL)');
            });
            it('returns DEC (HL)', () => {
                const { bus, address } = setup([0x35, 0x03]);
                expect(disassembleInstruction(bus, address)).toBe('DEC (HL)');
            });
            it('returns CP (HL)', () => {
                const { bus, address } = setup([0xbe, 0x03]);
                expect(disassembleInstruction(bus, address)).toBe('CP (HL)');
            });
        });
        describe('with one imm16 value', () => {
            it('returns CALL a16', () => {
                const { bus, address } = setup([0xcd, 0xff, 0xff]);
                expect(disassembleInstruction(bus, address)).toBe('CALL 0xffff');
            });
            it('returns JP a16', () => {
                const { bus, address } = setup([0xc3, 0xff, 0xff]);
                expect(disassembleInstruction(bus, address)).toBe('JP 0xffff');
            });
        });
        describe('with one reg16 value', () => {
            it('returns INC BC', () => {
                const { bus, address } = setup([0x03]);
                expect(disassembleInstruction(bus, address)).toBe('INC BC');
            });
            it('returns DEC BC', () => {
                const { bus, address } = setup([0x0b]);
                expect(disassembleInstruction(bus, address)).toBe('DEC BC');
            });
            it('returns PUSH BC', () => {
                const { bus, address } = setup([0xc5]);
                expect(disassembleInstruction(bus, address)).toBe('PUSH BC');
            });
            it('returns POP BC', () => {
                const { bus, address } = setup([0xc1]);
                expect(disassembleInstruction(bus, address)).toBe('POP BC');
            });
        });
        describe('with first imm8io value and second reg8 value', () => {
            it('returns LD (FF00 + a8), A', () => {
                const { bus, address } = setup([0xe0, 0x44]);
                expect(disassembleInstruction(bus, address)).toBe('LD (FF00 + 0x44), A');
            });
        });
        describe('with first reg8 value and second imm8 value', () => {
            it('returns LD B, d8', () => {
                const { bus, address } = setup([0x06, 0xc8]);
                expect(disassembleInstruction(bus, address)).toBe('LD B, 0xc8');
            });
            it('returns LD C, d8', () => {
                const { bus, address } = setup([0x0e, 0xc8]);
                expect(disassembleInstruction(bus, address)).toBe('LD C, 0xc8');
            });
        });
        describe('with first reg8 value and second imm8io value', () => {
            it('returns LD A, (FF00 + a8)', () => {
                const { bus, address } = setup([0xf0, 0x44]);
                expect(disassembleInstruction(bus, address)).toBe('LD A, (FF00 + 0x44)');
            });
        });
        describe('with first reg8 value and second reg8 value', () => {
            it('returns LD C, B', () => {
                const { bus, address } = setup([0x48]);
                expect(disassembleInstruction(bus, address)).toBe('LD C, B');
            });
        });
        describe('with first reg8 value and second reg8io value', () => {
            it('returns LD A, (FF00 + C)', () => {
                const { bus, address } = setup([0xf2]);
                expect(disassembleInstruction(bus, address)).toBe('LD A, (FF00 + C)');
            });
        });
        describe('with first reg8 value and second imm16ind8 value', () => {
            it('returns LD A, (a16)', () => {
                const { bus, address } = setup([0xfa, 0xce, 0xc0]);
                expect(disassembleInstruction(bus, address)).toBe('LD A, (0xc0ce)');
            });
        });
        describe('with first reg8 value and second reg16ind8 value', () => {
            it('returns LDI A, (HL)', () => {
                const { bus, address } = setup([0x2a, 0xc8]);
                expect(disassembleInstruction(bus, address)).toBe('LDI A, (HL)');
            });
            it('returns LDD A, (HL)', () => {
                const { bus, address } = setup([0x3a, 0xc8]);
                expect(disassembleInstruction(bus, address)).toBe('LDD A, (HL)');
            });
        });
        describe('with first reg8io value and second reg8 value', () => {
            it('returns LD (FF00 + C), A', () => {
                const { bus, address } = setup([0xe2]);
                expect(disassembleInstruction(bus, address)).toBe('LD (FF00 + C), A');
            });
        });
        describe('with first imm16ind8 value and second reg8 value', () => {
            it('returns LD (a16), A', () => {
                const { bus, address } = setup([0xea, 0xce, 0xc0]);
                expect(disassembleInstruction(bus, address)).toBe('LD (0xc0ce), A');
            });
        });
        describe('with first reg16ind8 value and second reg8 value', () => {
            it('returns LDI (HL), A', () => {
                const { bus, address } = setup([0x22, 0xc8]);
                expect(disassembleInstruction(bus, address)).toBe('LDI (HL), A');
            });
            it('returns LDD (HL), A', () => {
                const { bus, address } = setup([0x32, 0xc8]);
                expect(disassembleInstruction(bus, address)).toBe('LDD (HL), A');
            });
        });
        describe('with first reg16ind8 value and second imm8 value', () => {
            it('returns LD (HL), d8', () => {
                const { bus, address } = setup([0x36, 0xff]);
                expect(disassembleInstruction(bus, address)).toBe('LD (HL), 0xff');
            });
        });
        describe('with first reg16 value and second imm16 value', () => {
            it('returns LD BC, d16', () => {
                const { bus, address } = setup([0x01, 0xff, 0xff]);
                expect(disassembleInstruction(bus, address)).toBe('LD BC, 0xffff');
            });
        });
        xdescribe('prefix cb', () => {
            it('returns CB d8', () => {
                const { bus, address } = setup([0xcb, 0x94]);
                expect(disassembleInstruction(bus, address)).toBe('CB 0x94');
            });
        });
    });

    describe('consistency checks', () => {
        function cyclesForMode(mode: AddressingMode): number {
            switch (mode) {
                case AddressingMode.implicit:
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
                    throw new Error('bad addressing mode');
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
