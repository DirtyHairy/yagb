import { disassemleInstruction } from './instruction';
import { CpuState, r16 } from './cpu';
import { Bus } from './bus';
import { hex16 } from '../helper/format';

export class TraceEntry {
    constructor(private bus: Bus, private state: CpuState) {}

    print(): string {
        const disassembleAddress = this.state.p & 0xffff;
        const instruction = disassemleInstruction(this.bus, this.state.p);

        return `${hex16(disassembleAddress)}: ${instruction}\n${this.printState()}\n`;
    }


    private printState(): string {
        return `af=${hex16(this.state.r16[r16.af])} bc=${hex16(this.state.r16[r16.bc])} de=${hex16(this.state.r16[r16.de])} hl=${hex16(
            this.state.r16[r16.hl]
        )} s=${hex16(this.state.r16[r16.sp])} p=${hex16(this.state.p)} interrupts=${this.state.enableInterrupts ? 'on' : 'off'}`;
    }

}