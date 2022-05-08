import { ChannelTone } from './channel-tone';
import { WriteHandler } from '../bus';
import { cnst } from './definitions';

const enum reg {
    nrx1_length = 0x01,
    nrx2_envelope = 0x02,
    nrx3_poly = 0x03,
    nrx4_ctrl = 0x04,
}

// https://en.wikipedia.org/wiki/Xorshift
function xorshift(x: number): number {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;

    return x;
}

export class ChannelNoise extends ChannelTone {
    reset(): void {
        super.reset();

        this.rng = cnst.RNG_SEED;
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
            // Use the original 8bit LFSR for "warm" mode...
            for (let i = 0; i < lfsrCycles; i++) {
                const xor = ((this.lfsr >>> 1) ^ this.lfsr) & 0x01;
                this.lfsr = ((this.lfsr >>> 1) & ~0x40) | (xor << 15) | (xor << 6);
            }

            this.sample -= this.lfsr & 0x01 ? 0 : 2 * this.volume;
        } else {
            // ... and use XORSHIFT for 16bit mode (see apu.ts for an explanation).
            // Assuming a truly random distribution, sampling the generator multiple
            // times will not lead to a different result distribution, so we just
            // sample once.
            if (lfsrCycles >= 1) this.rng = xorshift(this.rng);

            this.sample -= this.rng & 0x01 ? 0 : 2 * this.volume;
        }
    }

    protected writeNRX4: WriteHandler = (_, value) => {
        this.reg[reg.nrx4_ctrl] = value;

        if (value & 0x80) {
            this.trigger();

            this.rng = cnst.RNG_SEED;
            this.lfsr = 0xffff;
        }
    };

    private rng = 0;
    private lfsr = 0;
}
