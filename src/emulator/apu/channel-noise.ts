import { ChannelTone } from './channel-tone';
import { Savestate } from './../savestate';
import { WriteHandler } from '../bus';

const enum reg {
    nrx1_length = 0x01,
    nrx2_envelope = 0x02,
    nrx3_poly = 0x03,
    nrx4_ctrl = 0x04,
}

const SAVESTATE_VERSION = 0x00;

export class ChannelNoise extends ChannelTone {
    save(savestate: Savestate): void {
        super.save(savestate);

        savestate.startChunk(SAVESTATE_VERSION).write16(this.lfsr);
    }

    load(savestate: Savestate): void {
        super.load(savestate);

        savestate.validateChunk(SAVESTATE_VERSION);

        this.lfsr = savestate.read16();
    }

    reset(): void {
        super.reset();

        this.lfsr = 0xffff;
    }

    protected cycleFreqCtrAndSample(cpuClocks: number): void {
        const poly = this.reg[reg.nrx3_poly];
        const divisorCode = poly & 0x07;
        const divisor = divisorCode === 0 ? 8 : divisorCode * 16;

        const freq = divisor << (poly >>> 4);
        this.freqCtr += 4 * cpuClocks;

        const lfsrCycles = (this.freqCtr / freq) | 0;
        this.freqCtr = this.freqCtr % freq;

        if (poly & 0x80) {
            for (let i = 0; i < lfsrCycles; i++) {
                const xor = ((this.lfsr >>> 1) ^ this.lfsr) & 0x01;
                this.lfsr = ((this.lfsr >>> 1) & 0x3f) | (xor << 6);
            }

            this.sample -= this.lfsr & 0x01 ? 0 : 2 * this.volume;
        } else {
            for (let i = 0; i < lfsrCycles; i++) {
                const xor = ((this.lfsr >>> 1) ^ this.lfsr) & 0x01;
                this.lfsr = ((this.lfsr >>> 1) & 0x3fff) | (xor << 14);
            }

            this.sample -= this.lfsr & 0x01 ? 0 : 2 * this.volume;
        }
    }

    protected writeNRX4: WriteHandler = (_, value) => {
        this.reg[reg.nrx4_ctrl] = value;

        if (value & 0x80) {
            this.trigger();

            this.lfsr = 0xffff;
        }
    };

    private lfsr = 0;
}
