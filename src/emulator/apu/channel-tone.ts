import { Bus, ReadHandler, WriteHandler } from '../bus';
import { WAVEFORMS, cnst } from './definitions';

export const enum reg {
    nrx0_sweep = 0x00,
    nrx1_duty_length = 0x01,
    nrx2_envelope = 0x02,
    nrx3_freq_lo = 0x03,
    nrx4_ctrl_freq_hi = 0x04,
}

export class ChannelTone {
    constructor(_reg: Uint8Array) {
        this.reg = _reg;
    }

    install(bus: Bus, base: number) {
        bus.map(base + reg.nrx2_envelope, this.readNRX2, this.writeNRX2);
        bus.map(base + reg.nrx4_ctrl_freq_hi, this.readNRX4, this.writeNRX4);
    }

    reset(): void {
        this.isActive = false;
        this.counter = 0;
        this.freqCtr = 0;
        this.samplePoint = 0;
        this.envelopeCtr = 0;
        this.envelopeActive = false;
        this.volume = 0;
        this.sample = 0;
    }

    cycle(cpuClocks: number, lengthCtrClocks: number): void {
        if ((this.reg[reg.nrx2_envelope] & 0xf8) === 0) {
            this.sample = 0;
            return;
        }

        this.sample = 0x0f + this.volume;
        if (!(this.reg[reg.nrx2_envelope] & 0xf8 && this.isActive)) return;

        this.cycleLengthCtr(lengthCtrClocks);
        if (!this.isActive) return;

        this.cycleEnvelope(lengthCtrClocks);
        if (this.volume === 0) return;

        this.cycleFreqCtrAndSample(cpuClocks);
    }

    protected cycleLengthCtr(lengthCtrClocks: number): void {
        if (this.reg[reg.nrx4_ctrl_freq_hi] & 0x40) {
            this.counter += lengthCtrClocks;

            if (this.counter >= 64 - (this.reg[reg.nrx1_duty_length] & 0x3f)) this.isActive = false;
        }
    }

    protected cycleEnvelope(lengthCtrClocks: number): void {
        if (this.envelopeActive && (this.reg[reg.nrx2_envelope] & 0x07) > 0) {
            this.envelopeCtr += lengthCtrClocks;
            const envelopeSteps = (this.envelopeCtr / (4 * (this.reg[reg.nrx2_envelope] & 0x07))) | 0;
            this.envelopeCtr %= 4 * (this.reg[reg.nrx2_envelope] & 0x07);

            this.volume = this.reg[reg.nrx2_envelope] & 0x08 ? this.volume + envelopeSteps : this.volume - envelopeSteps;
            if (this.volume < 0) {
                this.volume = 0;
                this.envelopeActive = false;
            }

            if (this.volume > 0x0f) {
                this.volume = 0x0f;
                this.envelopeActive = false;
            }
        }
    }

    protected cycleFreqCtrAndSample(cpuClocks: number): void {
        const freq = 0x0800 - ((this.reg[reg.nrx3_freq_lo] | (this.reg[reg.nrx4_ctrl_freq_hi] << 8)) & 0x07ff);
        this.freqCtr += cpuClocks;

        this.samplePoint += (this.freqCtr / freq) | 0;
        this.samplePoint %= 8;

        this.freqCtr = this.freqCtr % freq;

        // We discard sounds above a threshold (20kHz). This avoids high-pitched
        // aliasing artifacts from otherwise inaudible sounds.
        if (((131072 / freq) | 0) > cnst.CUTOFF_HZ) return;

        this.sample -= WAVEFORMS[this.reg[reg.nrx1_duty_length] >>> 6] & (1 << this.samplePoint) ? 2 * this.volume : 0;
    }

    protected trigger(): void {
        this.counter = 0;
        this.envelopeCtr = 0;
        this.sample = 0;
        this.volume = this.reg[reg.nrx2_envelope] >>> 4;
        this.envelopeActive = true;

        if (!this.isActive) this.freqCtr = 0;

        this.isActive = true;
    }

    protected readNRX2: ReadHandler = () => this.reg[reg.nrx2_envelope];
    protected writeNRX2: WriteHandler = (_, value) => {
        const oldValue = this.reg[reg.nrx2_envelope];
        this.reg[reg.nrx2_envelope] = value;

        // The following is based on the description of zombie mode in the gbdev wiki,
        // with some details taken from Sameboy. This is only an approximation (as
        // the channel state is usually not in sync with the main clock), but it is
        // good enough for Prehistorik Man.
        if (!this.isActive) return;

        let preventTick = false;

        if ((value ^ oldValue) & 0x08) {
            if (value & 0x08) {
                if (!(oldValue & 0x07) && this.envelopeActive) this.volume ^= 0x0f;
                else this.volume = 0x0e - this.volume;

                preventTick = true;
            } else {
                this.volume = 0x0f - this.volume;
            }

            this.volume &= 0x0f;
        }

        if (this.envelopeActive && ((value | oldValue) & 0x07) === 0 && !preventTick) {
            this.volume = (this.volume + (value & 0x08 ? 1 : -1)) & 0x0f;
        }
    };

    protected readNRX4: ReadHandler = () => this.reg[reg.nrx4_ctrl_freq_hi] | 0xbf;
    protected writeNRX4: WriteHandler = (_, value) => {
        this.reg[reg.nrx4_ctrl_freq_hi] = value;

        if (value & 0x80) this.trigger();
    };

    isActive = false;
    sample = 0;

    protected counter = 0;
    protected freqCtr = 0;
    protected samplePoint = 0;
    protected volume = 0;
    protected envelopeCtr = 0;
    protected envelopeActive = false;

    protected reg: Uint8Array;
}
