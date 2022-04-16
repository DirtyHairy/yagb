import { Bus } from '../../src/emulator/bus';
import { disassembleInstruction } from '../../src/emulator/instruction';
import { newEnvironment } from '../support/_helper';

describe('The opcode instructions', () => {
    function setup(code: ArrayLike<number>): { bus: Bus; address: number } {
        const env = newEnvironment(code);

        return { bus: env.bus, address: env.cpu.state.p };
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
        describe('with one implicit value', () => {
            it('returns RST 0x00', () => {
                const { bus, address } = setup([0xc7]);
                expect(disassembleInstruction(bus, address)).toBe('RST 0x00');
            });
            it('returns RST 0x08', () => {
                const { bus, address } = setup([0xcf]);
                expect(disassembleInstruction(bus, address)).toBe('RST 0x08');
            });
            it('returns RST 0x10', () => {
                const { bus, address } = setup([0xd7]);
                expect(disassembleInstruction(bus, address)).toBe('RST 0x10');
            });
            it('returns RST 0x18', () => {
                const { bus, address } = setup([0xdf]);
                expect(disassembleInstruction(bus, address)).toBe('RST 0x18');
            });
            it('returns RST 0x20', () => {
                const { bus, address } = setup([0xe7]);
                expect(disassembleInstruction(bus, address)).toBe('RST 0x20');
            });
            it('returns RST 0x28', () => {
                const { bus, address } = setup([0xef]);
                expect(disassembleInstruction(bus, address)).toBe('RST 0x28');
            });
            it('returns RST 0x30', () => {
                const { bus, address } = setup([0xf7]);
                expect(disassembleInstruction(bus, address)).toBe('RST 0x30');
            });
            it('returns RST 0x38', () => {
                const { bus, address } = setup([0xff]);
                expect(disassembleInstruction(bus, address)).toBe('RST 0x38');
            });
        });
        describe('with one imm8 value', () => {
            it('returns SUB d8', () => {
                const { bus, address } = setup([0xd6, 0x08]);
                expect(disassembleInstruction(bus, address)).toBe('SUB 0x08');
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
            it('returns CP d8', () => {
                const { bus, address } = setup([0xfe, 0x94]);
                expect(disassembleInstruction(bus, address)).toBe('CP 0x94');
            });
            it('returns JR d8', () => {
                const { bus, address } = setup([0x18, 0x08]);
                expect(disassembleInstruction(bus, address)).toBe('JR 0x08');
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
            it('returns SUB B', () => {
                const { bus, address } = setup([0x90, 0x01]);
                expect(disassembleInstruction(bus, address)).toBe('SUB B');
            });
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
            it('returns ADD A, d8', () => {
                const { bus, address } = setup([0xc6, 0xc8]);
                expect(disassembleInstruction(bus, address)).toBe('ADD A, 0xc8');
            });
            it('returns ADC A, d8', () => {
                const { bus, address } = setup([0xce, 0xc8]);
                expect(disassembleInstruction(bus, address)).toBe('ADC A, 0xc8');
            });
            it('returns SBC A, d8', () => {
                const { bus, address } = setup([0xde, 0xc8]);
                expect(disassembleInstruction(bus, address)).toBe('SBC A, 0xc8');
            });
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
            it('returns ADD A, B', () => {
                const { bus, address } = setup([0x80]);
                expect(disassembleInstruction(bus, address)).toBe('ADD A, B');
            });
            it('returns ADC A, B', () => {
                const { bus, address } = setup([0x88]);
                expect(disassembleInstruction(bus, address)).toBe('ADC A, B');
            });
            it('returns SBC A, B', () => {
                const { bus, address } = setup([0x98]);
                expect(disassembleInstruction(bus, address)).toBe('SBC A, B');
            });
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
        describe('prefix cb', () => {
            it('returns BIT 0, B', () => {
                const { bus, address } = setup([0xcb, 0x40]);
                expect(disassembleInstruction(bus, address)).toBe('BIT 0, B');
            });
            it('returns BIT 0, A', () => {
                const { bus, address } = setup([0xcb, 0x47]);
                expect(disassembleInstruction(bus, address)).toBe('BIT 0, A');
            });
            it('returns BIT 0, (HL))', () => {
                const { bus, address } = setup([0xcb, 0x46]);
                expect(disassembleInstruction(bus, address)).toBe('BIT 0, (HL)');
            });
            it('returns RES 0, B', () => {
                const { bus, address } = setup([0xcb, 0x80]);
                expect(disassembleInstruction(bus, address)).toBe('RES 0, B');
            });
            it('returns RES 0, A', () => {
                const { bus, address } = setup([0xcb, 0x87]);
                expect(disassembleInstruction(bus, address)).toBe('RES 0, A');
            });
            it('returns RES 0, (HL))', () => {
                const { bus, address } = setup([0xcb, 0x86]);
                expect(disassembleInstruction(bus, address)).toBe('RES 0, (HL)');
            });
            it('returns SET 0, B', () => {
                const { bus, address } = setup([0xcb, 0xc0]);
                expect(disassembleInstruction(bus, address)).toBe('SET 0, B');
            });
            it('returns SET 0, A', () => {
                const { bus, address } = setup([0xcb, 0xc7]);
                expect(disassembleInstruction(bus, address)).toBe('SET 0, A');
            });
            it('returns SET 0, (HL))', () => {
                const { bus, address } = setup([0xcb, 0xc6]);
                expect(disassembleInstruction(bus, address)).toBe('SET 0, (HL)');
            });
            it('returns RLC B', () => {
                const { bus, address } = setup([0xcb, 0x00]);
                expect(disassembleInstruction(bus, address)).toBe('RLC B');
            });
            it('returns RLC A', () => {
                const { bus, address } = setup([0xcb, 0x07]);
                expect(disassembleInstruction(bus, address)).toBe('RLC A');
            });
            it('returns RLC (HL))', () => {
                const { bus, address } = setup([0xcb, 0x06]);
                expect(disassembleInstruction(bus, address)).toBe('RLC (HL)');
            });
            it('returns RL B', () => {
                const { bus, address } = setup([0xcb, 0x10]);
                expect(disassembleInstruction(bus, address)).toBe('RL B');
            });
            it('returns RL A', () => {
                const { bus, address } = setup([0xcb, 0x17]);
                expect(disassembleInstruction(bus, address)).toBe('RL A');
            });
            it('returns RL (HL))', () => {
                const { bus, address } = setup([0xcb, 0x16]);
                expect(disassembleInstruction(bus, address)).toBe('RL (HL)');
            });
            it('returns SLA B', () => {
                const { bus, address } = setup([0xcb, 0x20]);
                expect(disassembleInstruction(bus, address)).toBe('SLA B');
            });
            it('returns SLA A', () => {
                const { bus, address } = setup([0xcb, 0x27]);
                expect(disassembleInstruction(bus, address)).toBe('SLA A');
            });
            it('returns SLA (HL))', () => {
                const { bus, address } = setup([0xcb, 0x26]);
                expect(disassembleInstruction(bus, address)).toBe('SLA (HL)');
            });
            it('returns SWAP B', () => {
                const { bus, address } = setup([0xcb, 0x30]);
                expect(disassembleInstruction(bus, address)).toBe('SWAP B');
            });
            it('returns SWAP A', () => {
                const { bus, address } = setup([0xcb, 0x37]);
                expect(disassembleInstruction(bus, address)).toBe('SWAP A');
            });
            it('returns SWAP (HL))', () => {
                const { bus, address } = setup([0xcb, 0x36]);
                expect(disassembleInstruction(bus, address)).toBe('SWAP (HL)');
            });
            it('returns RRC B', () => {
                const { bus, address } = setup([0xcb, 0x08]);
                expect(disassembleInstruction(bus, address)).toBe('RRC B');
            });
            it('returns RRC A', () => {
                const { bus, address } = setup([0xcb, 0x0f]);
                expect(disassembleInstruction(bus, address)).toBe('RRC A');
            });
            it('returns RRC (HL))', () => {
                const { bus, address } = setup([0xcb, 0x0e]);
                expect(disassembleInstruction(bus, address)).toBe('RRC (HL)');
            });
            it('returns RR B', () => {
                const { bus, address } = setup([0xcb, 0x18]);
                expect(disassembleInstruction(bus, address)).toBe('RR B');
            });
            it('returns RR A', () => {
                const { bus, address } = setup([0xcb, 0x1f]);
                expect(disassembleInstruction(bus, address)).toBe('RR A');
            });
            it('returns RR (HL))', () => {
                const { bus, address } = setup([0xcb, 0x1e]);
                expect(disassembleInstruction(bus, address)).toBe('RR (HL)');
            });
            it('returns SRA B', () => {
                const { bus, address } = setup([0xcb, 0x28]);
                expect(disassembleInstruction(bus, address)).toBe('SRA B');
            });
            it('returns SRA A', () => {
                const { bus, address } = setup([0xcb, 0x2f]);
                expect(disassembleInstruction(bus, address)).toBe('SRA A');
            });
            it('returns SRA (HL))', () => {
                const { bus, address } = setup([0xcb, 0x2e]);
                expect(disassembleInstruction(bus, address)).toBe('SRA (HL)');
            });
            it('returns SRL B', () => {
                const { bus, address } = setup([0xcb, 0x38]);
                expect(disassembleInstruction(bus, address)).toBe('SRL B');
            });
            it('returns SRL A', () => {
                const { bus, address } = setup([0xcb, 0x3f]);
                expect(disassembleInstruction(bus, address)).toBe('SRL A');
            });
            it('returns SRL (HL))', () => {
                const { bus, address } = setup([0xcb, 0x3e]);
                expect(disassembleInstruction(bus, address)).toBe('SRL (HL)');
            });
        });
    });
});
