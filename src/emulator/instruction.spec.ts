import { Bus, ReadHandler, WriteHandler } from './bus';

import { System } from './system';
import { disassembleInstruction } from './instruction';

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
            it('returns CPL', () => {
                const { bus, address } = setup([0x2f]);
                expect(disassembleInstruction(bus, address)).toBe('CPL');
            });
        });
        describe('with one imm8 value', () => {
            it('returns JR NZ, d8', () => {
                const { bus, address } = setup([0x20, 0x08]);
                expect(disassembleInstruction(bus, address)).toBe('JR NZ, 0x08');
            });
            it('returns CP d8', () => {
                const { bus, address } = setup([0xfe, 0x94]);
                expect(disassembleInstruction(bus, address)).toBe('CP 0x94');
            });
        });
        describe('with one reg8 value', () => {
            it('returns AND A', () => {
                const { bus, address } = setup([0xa7, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('AND A');
            });
            it('returns AND B', () => {
                const { bus, address } = setup([0xa0, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('AND B');
            });
            it('returns XOR A', () => {
                const { bus, address } = setup([0xaf, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('XOR A');
            });
            it('returns XOR B', () => {
                const { bus, address } = setup([0xa8, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('XOR B');
            });
            it('returns OR A', () => {
                const { bus, address } = setup([0xb7, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('OR A');
            });
            it('returns OR B', () => {
                const { bus, address } = setup([0xb0, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('OR B');
            });
            it('returns INC B', () => {
                const { bus, address } = setup([0x04, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('INC B');
            });
            it('returns DEC B', () => {
                const { bus, address } = setup([0x05, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('DEC B');
            });
        });
        describe('with one ind8 value', () => {
            it('returns AND (HL)', () => {
                const { bus, address } = setup([0xa6, 0x03]);
                expect(disassembleInstruction(bus, address)).toBe('AND (HL)');
            });
            it('returns XOR (HL)', () => {
                const { bus, address } = setup([0xae, 0x03]);
                expect(disassembleInstruction(bus, address)).toBe('XOR (HL)');
            });
            it('returns OR (HL)', () => {
                const { bus, address } = setup([0xb6, 0x03]);
                expect(disassembleInstruction(bus, address)).toBe('OR (HL)');
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
            it('PUSH BC', () => {
                const { bus, address } = setup([0xc5]);
                expect(disassembleInstruction(bus, address)).toBe('PUSH BC');
            });
            it('POP BC', () => {
                const { bus, address } = setup([0xc1]);
                expect(disassembleInstruction(bus, address)).toBe('POP BC');
            });
        });
        describe('with first imm8ind value and second reg8 value', () => {
            it('returns LD (a8), A', () => {
                const { bus, address } = setup([0xea, 0xce, 0xc0]);
                expect(disassembleInstruction(bus, address)).toBe('LD (0xc0ce), A');
            });
        });
        describe('with first imm8io value and second reg8 value', () => {
            it('returns LD (FF00 + a8), A', () => {
                const { bus, address } = setup([0xe0, 0x44]);
                expect(disassembleInstruction(bus, address)).toBe('LD (FF00 + 0x44), A');
            });
        });
        describe('with first ind8 value and second imm8 value', () => {
            it('returns LD (HL), d8', () => {
                const { bus, address } = setup([0x36, 0xff]);
                expect(disassembleInstruction(bus, address)).toBe('LD (HL), 0xff');
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
        describe('with first reg8 value and second ind8 value', () => {
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
        describe('with first ind8 value and second reg8 value', () => {
            it('returns LDI (HL), A', () => {
                const { bus, address } = setup([0x22, 0xc8]);
                expect(disassembleInstruction(bus, address)).toBe('LDI (HL), A');
            });
            it('returns LDD (HL), A', () => {
                const { bus, address } = setup([0x32, 0xc8]);
                expect(disassembleInstruction(bus, address)).toBe('LDD (HL), A');
            });
        });
        describe('with first reg16 value and second imm16 value', () => {
            it('returns LD BC, d16', () => {
                const { bus, address } = setup([0x01, 0xff, 0xff]);
                expect(disassembleInstruction(bus, address)).toBe('LD BC, 0xffff');
            });
        });
    });
});
