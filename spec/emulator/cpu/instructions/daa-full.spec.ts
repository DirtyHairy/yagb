import { Environment, newEnvironment } from '../../../support/_helper';
import { flag, r8 } from '../../../../src/emulator/cpu';

type Operand = Array<{ operand1: number; operand2: number }>;

const expectedResult = (value: number): number => {
    const result = (0 > value ? 100 + value : value).toString();
    return Number(`0x${result.substring(result.length - 2)}`);
};

describe('The glorious CPU', () => {
    function setup(operand1: number, operand2: number, substraction = false): Environment {
        const env = newEnvironment([0x27, 0x00]);

        // prettier-ignore
        const result = !substraction
            ? operand1 + operand2
            : operand1 - operand2;

        // prettier-ignore
        const flagZ = !substraction
            ? (((result & 0xff) === 0) ? flag.z : 0x00)
            : (((result & 0xff) === 0) ? flag.z : 0x00);

        // prettier-ignore
        const flagN = !substraction
            ? 0x00
            : flag.n;

        // prettier-ignore
        const flagH = !substraction
            ? ((((operand1 & 0xf) + (operand2 & 0xf)) > 0xf) ? flag.h : 0x00)
            : ((((operand1 & 0xf) - (operand2 & 0xf)) < 0) ? flag.h : 0x00);

        // prettier-ignore
        const flagC = !substraction
            ? ((result > 0xff) ? flag.c : 0x00)
            : ((result < 0) ? flag.c : 0x00);

        env.cpu.state.r8[r8.a] = result & 0xff;

        env.cpu.state.r8[r8.f] = flagZ | flagN | flagH | flagC;

        return env;
    }

    describe.each(
        Array.from(
            { length: 100 },
            (_, i) => {
                return Array.from(
                    { length: 100 },
                    (_, k) => {
                        return {
                            operand1: i,
                            operand2: k,
                        };
                    },
                    [] as Operand
                );
            },
            [] as Operand
        )
            .reduce((acc, entry) => {
                return acc.concat(entry);
            }, [] as Array<Operand>)
            .reverse()
    )('$#. 0x$operand1 vs. 0x$operand2', ({ operand1, operand2 }) => {
        it(`0x${operand1} + 0x${operand2} = 0x${expectedResult(operand1 + operand2).toString(16)}`, () => {
            const { cpu } = setup(Number(`0x${operand1.toString()}`), Number(`0x${operand2.toString()}`), false);

            cpu.step(1);

            expect(cpu.state.r8[r8.a]).toBe(expectedResult(operand1 + operand2));
        });
        it(`0x${operand1} - 0x${operand2} = 0x${expectedResult(operand1 - operand2).toString(16)}`, () => {
            const { cpu } = setup(Number(`0x${operand1.toString()}`), Number(`0x${operand2.toString()}`), true);

            cpu.step(1);

            expect(cpu.state.r8[r8.a]).toBe(expectedResult(operand1 - operand2));
        });
        describe('sets Z correctly', () => {
            it('addition', () => {
                const { cpu } = setup(Number(`0x${operand1.toString()}`), Number(`0x${operand2.toString()}`), false);

                const expectedValue = expectedResult(operand1 + operand2) === 0x00 ? flag.z : 0x00;

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.z).toBe(expectedValue);
            })
            it('subtraction', () => {
                const { cpu } = setup(Number(`0x${operand1.toString()}`), Number(`0x${operand2.toString()}`), true);

                const expectedValue = expectedResult(operand1 - operand2) === 0x00 ? flag.z : 0x00;

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.z).toBe(expectedValue);
            })
        });
        describe('does not affect N', () => {
            it('addition', () => {
                const { cpu } = setup(Number(`0x${operand1.toString()}`), Number(`0x${operand2.toString()}`), false);

                const expectedValue = cpu.state.r8[r8.f] & flag.n;

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.n).toBe(expectedValue);
            })
            it('subtraction', () => {
                const { cpu } = setup(Number(`0x${operand1.toString()}`), Number(`0x${operand2.toString()}`), true);

                const expectedValue = cpu.state.r8[r8.f] & flag.n;

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.n).toBe(expectedValue);
            })
        });
        it('clears H', () => {
            const { cpu } = setup(Number(`0x${operand1.toString()}`), Number(`0x${operand2.toString()}`), false);

            cpu.step(1);

            expect(cpu.state.r8[r8.a] & flag.h).toBe(0);
        });
        describe('sets C correctly', () => {
            it('addition', () => {
                const { cpu } = setup(Number(`0x${operand1.toString()}`), Number(`0x${operand2.toString()}`), false);

                const expectedValue = operand1 + operand2 > 99 ? flag.c : 0x00;

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.c).toBe(expectedValue);
            })
            it('subtraction', () => {
                const { cpu } = setup(Number(`0x${operand1.toString()}`), Number(`0x${operand2.toString()}`), true);

                const expectedValue = operand1 - operand2 < 0 ? flag.c : 0x00;

                cpu.step(1);

                expect(cpu.state.r8[r8.f] & flag.c).toBe(expectedValue);
            })
        });
    });
});
