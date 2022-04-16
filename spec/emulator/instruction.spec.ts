import { Bus } from '../../src/emulator/bus';
import { disassembleInstruction } from '../../src/emulator/instruction';
import { newEnvironment } from '../support/_helper';

describe('The opcode instructions', () => {
    function setup(code: ArrayLike<number>): { bus: Bus; address: number } {
        const env = newEnvironment(code);

        return { bus: env.bus, address: env.cpu.state.p };
    }

    describe('disassembleInstruction', () => {
        describe.each([
            {
                description: 'not existing opcode',
                entries: [
                    { op: 'DB d8', expected: 'DB 0xd3', opcode: 0xd3, par1: 0x00, par2: 0x00 },
                    { op: 'DB d8', expected: 'DB 0xdb', opcode: 0xdb, par1: 0x00, par2: 0x00 },
                    { op: 'DB d8', expected: 'DB 0xdd', opcode: 0xdd, par1: 0x00, par2: 0x00 },
                    { op: 'DB d8', expected: 'DB 0xe3', opcode: 0xe3, par1: 0x00, par2: 0x00 },
                    { op: 'DB d8', expected: 'DB 0xe4', opcode: 0xe4, par1: 0x00, par2: 0x00 },
                    { op: 'DB d8', expected: 'DB 0xeb', opcode: 0xeb, par1: 0x00, par2: 0x00 },
                    { op: 'DB d8', expected: 'DB 0xec', opcode: 0xec, par1: 0x00, par2: 0x00 },
                    { op: 'DB d8', expected: 'DB 0xed', opcode: 0xed, par1: 0x00, par2: 0x00 },
                    { op: 'DB d8', expected: 'DB 0xf4', opcode: 0xf4, par1: 0x00, par2: 0x00 },
                    { op: 'DB d8', expected: 'DB 0xfc', opcode: 0xfc, par1: 0x00, par2: 0x00 },
                    { op: 'DB d8', expected: 'DB 0xfd', opcode: 0xfd, par1: 0x00, par2: 0x00 },
                ],
            },
            {
                description: 'with no parameters',
                entries: [
                    { op: 'NOP', expected: 'NOP', opcode: 0x00, par1: 0x00, par2: 0x00 },
                    { op: 'DI', expected: 'DI', opcode: 0xf3, par1: 0x00, par2: 0x00 },
                    { op: 'EI', expected: 'EI', opcode: 0xfb, par1: 0x00, par2: 0x00 },
                    { op: 'RET', expected: 'RET', opcode: 0xc9, par1: 0x00, par2: 0x00 },
                    { op: 'RETI', expected: 'RETI', opcode: 0xd9, par1: 0x00, par2: 0x00 },
                    { op: 'CPL', expected: 'CPL', opcode: 0x2f, par1: 0x00, par2: 0x00 },
                ],
            },
            {
                description: 'with no parameters and condition',
                entries: [
                    { op: 'RET', expected: 'RET', opcode: 0xc9, par1: 0x00, par2: 0x00 },
                    { op: 'RET NZ', expected: 'RET NZ', opcode: 0xc0, par1: 0x00, par2: 0x00 },
                    { op: 'RET Z', expected: 'RET Z', opcode: 0xc8, par1: 0x00, par2: 0x00 },
                    { op: 'RET NC', expected: 'RET NC', opcode: 0xd0, par1: 0x00, par2: 0x00 },
                    { op: 'RET C', expected: 'RET C', opcode: 0xd8, par1: 0x00, par2: 0x00 },
                ],
            },
            {
                description: 'with one implicit value',
                entries: [
                    { op: 'RST 0x00', expected: 'RST 0x00', opcode: 0xc7, par1: 0x00, par2: 0x00 },
                    { op: 'RST 0x08', expected: 'RST 0x08', opcode: 0xcf, par1: 0x00, par2: 0x00 },
                    { op: 'RST 0x10', expected: 'RST 0x10', opcode: 0xd7, par1: 0x00, par2: 0x00 },
                    { op: 'RST 0x18', expected: 'RST 0x18', opcode: 0xdf, par1: 0x00, par2: 0x00 },
                    { op: 'RST 0x20', expected: 'RST 0x20', opcode: 0xe7, par1: 0x00, par2: 0x00 },
                    { op: 'RST 0x28', expected: 'RST 0x28', opcode: 0xef, par1: 0x00, par2: 0x00 },
                    { op: 'RST 0x30', expected: 'RST 0x30', opcode: 0xf7, par1: 0x00, par2: 0x00 },
                    { op: 'RST 0x38', expected: 'RST 0x38', opcode: 0xff, par1: 0x00, par2: 0x00 },
                ],
            },
            {
                description: 'with one imm8 value',
                entries: [
                    { op: 'SUB d8', expected: 'SUB 0x08', opcode: 0xd6, par1: 0x08, par2: 0x00 },
                    { op: 'AND d8', expected: 'AND 0x08', opcode: 0xe6, par1: 0x08, par2: 0x00 },
                    { op: 'OR d8', expected: 'OR 0x08', opcode: 0xf6, par1: 0x08, par2: 0x00 },
                    { op: 'XOR d8', expected: 'XOR 0x08', opcode: 0xee, par1: 0x08, par2: 0x00 },
                    { op: 'CP d8', expected: 'CP 0x08', opcode: 0xfe, par1: 0x08, par2: 0x00 },
                    { op: 'JR d8', expected: 'JR 0x08', opcode: 0x18, par1: 0x08, par2: 0x00 },
                ],
            },
            {
                description: 'with one imm8 value and condition',
                entries: [
                    { op: 'JR NZ, d8', expected: 'JR NZ, 0x08', opcode: 0x20, par1: 0x08, par2: 0x00 },
                    { op: 'JR Z, d8', expected: 'JR Z, 0x08', opcode: 0x28, par1: 0x08, par2: 0x00 },
                    { op: 'JR NC, d8', expected: 'JR NC, 0x08', opcode: 0x30, par1: 0x08, par2: 0x00 },
                    { op: 'JR C, d8', expected: 'JR C, 0x08', opcode: 0x38, par1: 0x08, par2: 0x00 },
                ],
            },
            {
                description: 'with one reg8 value',
                entries: [
                    { op: 'SUB B', expected: 'SUB B', opcode: 0x90, par1: 0x00, par2: 0x00 },
                    { op: 'AND B', expected: 'AND B', opcode: 0xa0, par1: 0x00, par2: 0x00 },
                    { op: 'OR B', expected: 'OR B', opcode: 0xb0, par1: 0x00, par2: 0x00 },
                    { op: 'XOR B', expected: 'XOR B', opcode: 0xa8, par1: 0x00, par2: 0x00 },
                    { op: 'INC B', expected: 'INC B', opcode: 0x04, par1: 0x00, par2: 0x00 },
                    { op: 'DEC B', expected: 'DEC B', opcode: 0x05, par1: 0x00, par2: 0x00 },
                    { op: 'CP B', expected: 'CP B', opcode: 0xb8, par1: 0x00, par2: 0x00 },
                    { op: 'SUB A', expected: 'SUB A', opcode: 0x97, par1: 0x00, par2: 0x00 },
                    { op: 'AND A', expected: 'AND A', opcode: 0xa7, par1: 0x00, par2: 0x00 },
                    { op: 'OR A', expected: 'OR A', opcode: 0xb7, par1: 0x00, par2: 0x00 },
                    { op: 'XOR A', expected: 'XOR A', opcode: 0xaf, par1: 0x00, par2: 0x00 },
                    { op: 'INC A', expected: 'INC A', opcode: 0x3c, par1: 0x00, par2: 0x00 },
                    { op: 'DEC A', expected: 'DEC A', opcode: 0x3d, par1: 0x00, par2: 0x00 },
                    { op: 'CP A', expected: 'CP A', opcode: 0xbf, par1: 0x00, par2: 0x00 },
                ],
            },
            {
                description: 'with one reg16 value',
                entries: [
                    { op: 'JP HL', expected: 'JP HL', opcode: 0xe9, par1: 0x00, par2: 0x00 },
                ],
            },
            {
                description: 'with one reg16ind8 value',
                entries: [
                    { op: 'AND (HL)', expected: 'AND (HL)', opcode: 0xa6, par1: 0x00, par2: 0x00 },
                    { op: 'OR (HL)', expected: 'OR (HL)', opcode: 0xb6, par1: 0x00, par2: 0x00 },
                    { op: 'XOR (HL)', expected: 'XOR (HL)', opcode: 0xae, par1: 0x00, par2: 0x00 },
                    { op: 'INC (HL)', expected: 'INC (HL)', opcode: 0x34, par1: 0x00, par2: 0x00 },
                    { op: 'DEC (HL)', expected: 'DEC (HL)', opcode: 0x35, par1: 0x00, par2: 0x00 },
                    { op: 'CP (HL)', expected: 'CP (HL)', opcode: 0xbe, par1: 0x00, par2: 0x00 },
                ],
            },
            {
                description: 'with one imm16 value',
                entries: [
                    { op: 'CALL a16', expected: 'CALL 0x2000', opcode: 0xcd, par1: 0x00, par2: 0x20 },
                    { op: 'JP a16', expected: 'JP 0x2000', opcode: 0xc3, par1: 0x00, par2: 0x20 },
                ],
            },
            {
                description: 'with one reg16 value',
                entries: [
                    { op: 'INC BC', expected: 'INC BC', opcode: 0x03, par1: 0x00, par2: 0x00 },
                    { op: 'DEC BC', expected: 'DEC BC', opcode: 0x0b, par1: 0x00, par2: 0x00 },
                    { op: 'PUSH BC', expected: 'PUSH BC', opcode: 0xc5, par1: 0x00, par2: 0x00 },
                    { op: 'POP BC', expected: 'POP BC', opcode: 0xc1, par1: 0x00, par2: 0x00 },
                ],
            },
            {
                description: 'with first imm8io value and second reg8 value',
                entries: [{ op: 'LD (FF00 + a8), A', expected: 'LD (FF00 + 0x00), A', opcode: 0xe0, par1: 0x00, par2: 0x00 }],
            },
            {
                description: 'with first reg8 value and second imm8 value',
                entries: [
                    { op: 'ADD A, d8', expected: 'ADD A, 0x00', opcode: 0xc6, par1: 0x00, par2: 0x00 },
                    { op: 'ADC A, d8', expected: 'ADC A, 0x00', opcode: 0xce, par1: 0x00, par2: 0x00 },
                    { op: 'SBC A, d8', expected: 'SBC A, 0x00', opcode: 0xde, par1: 0x00, par2: 0x00 },
                    { op: 'LD B, d8', expected: 'LD B, 0x00', opcode: 0x06, par1: 0x00, par2: 0x00 },
                    { op: 'LD C, d8', expected: 'LD C, 0x00', opcode: 0x0e, par1: 0x00, par2: 0x00 },
                ],
            },
            {
                description: 'with first reg8 value and second imm8io value',
                entries: [{ op: 'LD A, (FF00 + a8)', expected: 'LD A, (FF00 + 0x00)', opcode: 0xf0, par1: 0x00, par2: 0x00 }],
            },
            {
                description: 'with first reg8 value and second reg8 value',
                entries: [
                    { op: 'ADD A, B', expected: 'ADD A, B', opcode: 0x80, par1: 0x00, par2: 0x00 },
                    { op: 'ADC A, B', expected: 'ADC A, B', opcode: 0x88, par1: 0x00, par2: 0x00 },
                    { op: 'SBC A, B', expected: 'SBC A, B', opcode: 0x98, par1: 0x00, par2: 0x00 },
                    { op: 'LD C, B', expected: 'LD C, B', opcode: 0x48, par1: 0x00, par2: 0x00 },
                ],
            },
            {
                description: 'with first reg8 value and second reg8io value',
                entries: [{ op: 'LD A, (FF00 + C)', expected: 'LD A, (FF00 + C)', opcode: 0xf2, par1: 0x00, par2: 0x00 }],
            },
            {
                description: 'with first reg8 value and second imm16ind8 value',
                entries: [{ op: 'LD A, (a16)', expected: 'LD A, (0x0000)', opcode: 0xfa, par1: 0x00, par2: 0x00 }],
            },
            {
                description: 'with first reg8 value and second reg16ind8 value',
                entries: [
                    { op: 'LDI A, (HL)', expected: 'LDI A, (HL)', opcode: 0x2a, par1: 0x00, par2: 0x00 },
                    { op: 'LDD A, (HL)', expected: 'LDD A, (HL)', opcode: 0x3a, par1: 0x00, par2: 0x00 },
                ],
            },
            {
                description: 'with first reg8io value and second reg8 value',
                entries: [{ op: 'LD (FF00 + C), A', expected: 'LD (FF00 + C), A', opcode: 0xe2, par1: 0x00, par2: 0x00 }],
            },
            {
                description: 'with first imm16ind8 value and second reg8 value',
                entries: [{ op: 'LD (a16), A', expected: 'LD (0x0000), A', opcode: 0xea, par1: 0x00, par2: 0x00 }],
            },
            {
                description: 'with first reg16ind8 value and second reg8 value',
                entries: [
                    { op: 'LDI (HL), A', expected: 'LDI (HL), A', opcode: 0x22, par1: 0x00, par2: 0x00 },
                    { op: 'LDD (HL), A', expected: 'LDD (HL), A', opcode: 0x32, par1: 0x00, par2: 0x00 },
                ],
            },
            {
                description: 'with first reg16 value and second imm16 value',
                entries: [{ op: 'LD BC, d16', expected: 'LD BC, 0x0000', opcode: 0x01, par1: 0x00, par2: 0x00 }],
            },
            {
                description: 'with first reg16 value and second reg16 value',
                entries: [
                    { op: 'ADD HL, BC', expected: 'ADD HL, BC', opcode: 0x09, par1: 0x00, par2: 0x00 },
                    { op: 'ADD HL, DE', expected: 'ADD HL, DE', opcode: 0x19, par1: 0x00, par2: 0x00 },
                    { op: 'ADD HL, HL', expected: 'ADD HL, HL', opcode: 0x29, par1: 0x00, par2: 0x00 },
                    { op: 'ADD HL, SP', expected: 'ADD HL, SP', opcode: 0x39, par1: 0x00, par2: 0x00 },
                ],
            },
            {
                description: 'with first reg16ind8 value and second imm8 value',
                entries: [{ op: 'LD (HL), d8', expected: 'LD (HL), 0x00', opcode: 0x36, par1: 0x00, par2: 0x00 }],
            },
            {
                description: 'prefix cb',
                entries: [
                    { op: 'BIT 0, B', expected: 'BIT 0, B', opcode: 0xcb, par1: 0x40, par2: 0x00 },
                    { op: 'BIT 0, A', expected: 'BIT 0, A', opcode: 0xcb, par1: 0x47, par2: 0x00 },
                    { op: 'BIT 0, (HL)', expected: 'BIT 0, (HL)', opcode: 0xcb, par1: 0x46, par2: 0x00 },
                    { op: 'RES 0, B', expected: 'RES 0, B', opcode: 0xcb, par1: 0x80, par2: 0x00 },
                    { op: 'RES 0, A', expected: 'RES 0, A', opcode: 0xcb, par1: 0x87, par2: 0x00 },
                    { op: 'RES 0, (HL)', expected: 'RES 0, (HL)', opcode: 0xcb, par1: 0x86, par2: 0x00 },
                    { op: 'SET 0, B', expected: 'SET 0, B', opcode: 0xcb, par1: 0xc0, par2: 0x00 },
                    { op: 'SET 0, A', expected: 'SET 0, A', opcode: 0xcb, par1: 0xc7, par2: 0x00 },
                    { op: 'SET 0, (HL)', expected: 'SET 0, (HL)', opcode: 0xcb, par1: 0xc6, par2: 0x00 },
                    { op: 'RLC B', expected: 'RLC B', opcode: 0xcb, par1: 0x00, par2: 0x00 },
                    { op: 'RLC A', expected: 'RLC A', opcode: 0xcb, par1: 0x07, par2: 0x00 },
                    { op: 'RLC (HL)', expected: 'RLC (HL)', opcode: 0xcb, par1: 0x06, par2: 0x00 },
                    { op: 'RL B', expected: 'RL B', opcode: 0xcb, par1: 0x10, par2: 0x00 },
                    { op: 'RL A', expected: 'RL A', opcode: 0xcb, par1: 0x17, par2: 0x00 },
                    { op: 'RL (HL)', expected: 'RL (HL)', opcode: 0xcb, par1: 0x16, par2: 0x00 },
                    { op: 'SLA B', expected: 'SLA B', opcode: 0xcb, par1: 0x20, par2: 0x00 },
                    { op: 'SLA A', expected: 'SLA A', opcode: 0xcb, par1: 0x27, par2: 0x00 },
                    { op: 'SLA (HL)', expected: 'SLA (HL)', opcode: 0xcb, par1: 0x26, par2: 0x00 },
                    { op: 'SWAP B', expected: 'SWAP B', opcode: 0xcb, par1: 0x30, par2: 0x00 },
                    { op: 'SWAP A', expected: 'SWAP A', opcode: 0xcb, par1: 0x37, par2: 0x00 },
                    { op: 'SWAP (HL)', expected: 'SWAP (HL)', opcode: 0xcb, par1: 0x36, par2: 0x00 },
                    { op: 'RRC B', expected: 'RRC B', opcode: 0xcb, par1: 0x08, par2: 0x00 },
                    { op: 'RRC A', expected: 'RRC A', opcode: 0xcb, par1: 0x0f, par2: 0x00 },
                    { op: 'RRC (HL)', expected: 'RRC (HL)', opcode: 0xcb, par1: 0x0e, par2: 0x00 },
                    { op: 'RR B', expected: 'RR B', opcode: 0xcb, par1: 0x18, par2: 0x00 },
                    { op: 'RR A', expected: 'RR A', opcode: 0xcb, par1: 0x1f, par2: 0x00 },
                    { op: 'RR (HL)', expected: 'RR (HL)', opcode: 0xcb, par1: 0x1e, par2: 0x00 },
                    { op: 'SRA B', expected: 'SRA B', opcode: 0xcb, par1: 0x28, par2: 0x00 },
                    { op: 'SRA A', expected: 'SRA A', opcode: 0xcb, par1: 0x2f, par2: 0x00 },
                    { op: 'SRA (HL)', expected: 'SRA (HL)', opcode: 0xcb, par1: 0x2e, par2: 0x00 },
                    { op: 'SRL B', expected: 'SRL B', opcode: 0xcb, par1: 0x38, par2: 0x00 },
                    { op: 'SRL A', expected: 'SRL A', opcode: 0xcb, par1: 0x3f, par2: 0x00 },
                    { op: 'SRL (HL)', expected: 'SRL (HL)', opcode: 0xcb, par1: 0x3e, par2: 0x00 },
                ],
            },
        ])('$description', ({ description, entries }) => {
            it.each(entries)('returns $op', ({ op, expected, opcode, par1, par2 }) => {
                const { bus, address } = setup([opcode, par1, par2]);
                expect(disassembleInstruction(bus, address)).toBe(expected);
            });
        });
    });
});
