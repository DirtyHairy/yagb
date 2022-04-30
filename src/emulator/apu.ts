import { Bus, ReadHandler, WriteHandler } from './bus';

import { SampleQueue } from './apu/sample-queue';

const REG_INITIAL = new Uint8Array([
    0x80, 0xbf, 0xf3, 0xff, 0xbf, 0xff, 0x3f, 0x00, 0xff, 0xbf, 0x7f, 0xff, 0x9f, 0xff, 0xbf, 0xff, 0xff, 0x00, 0x00, 0xbf, 0x77, 0xf3, 0xf1,
]);

const WAVEFORMS = new Uint8Array([0x01, 0x03, 0x0f, 0xfc]);

const enum cnst {
    CLOCK = 1048576,
    CUTOFF_HZ = 20000,
}

const enum reg {
    base = 0xff10,

    nr10_sweep = 0x00,
    nr11_duty_length = 0x01,
    nr12_envelope = 0x02,
    nr13_freq_lo = 0x03,
    nr14_ctrl_freq_hi = 0x04,

    nr21_duty_length = 0x06,
    nr22_envelope = 0x07,
    nr23_freq_lo = 0x08,
    nr24_ctrl_freq_hi = 0x09,

    nr30_onoff = 0x0a,
    nr31_length = 0x0b,
    nr32_level = 0x0c,
    nr33_freq_lo = 0x0d,
    nr34_ctrl_freq_hi = 0x0e,

    nr41_length = 0x10,
    nr42_envelope = 0x11,
    nr43_poly = 0x12,
    nr44_ctrl = 0x13,

    nr50_volume = 0x14,
    nr51_terminal = 0x15,
    nr52_ctrl = 0x16,
}
export class Apu {
    setSampleQueue(sampleQueue: SampleQueue) {
        this.sampleQueue = sampleQueue;
        this.sampleRate = sampleQueue.sampleRate;
    }

    install(bus: Bus): void {
        for (let i = reg.base; i <= reg.base + 0x16; i++) {
            bus.map(i, this.regRead, this.regWrite);
        }

        for (let i = 0xff30; i <= 0xff3f; i++) {
            bus.map(i, this.waveRamRead, this.waveRamWrite);
        }

        bus.map(reg.base + reg.nr22_envelope, this.regRead, this.writeNR22);
        bus.map(reg.base + reg.nr24_ctrl_freq_hi, this.readNR24, this.writeNR24);

        bus.map(reg.base + reg.nr12_envelope, this.regRead, this.writeNR12);
        bus.map(reg.base + reg.nr14_ctrl_freq_hi, this.readNR14, this.writeNR14);

        bus.map(reg.base + reg.nr34_ctrl_freq_hi, this.readNR34, this.writeNR34);

        bus.map(reg.base + reg.nr42_envelope, this.regRead, this.writeNR42);
        bus.map(reg.base + reg.nr44_ctrl, this.readNR44, this.writeNR44);

        bus.map(reg.base + reg.nr52_ctrl, this.readNR52, this.writeNR52);

        bus.map(0xff15, this.unmappedRead, this.unmappedWrite);
        bus.map(0xff1f, this.unmappedRead, this.unmappedWrite);
    }

    reset(): void {
        this.reg.set(REG_INITIAL);
        this.waveRam.fill(0);
        this.acc = 0;
        this.accClocks = 0;
        this.accLengthCtr = 0;

        this.channel1Active = false;
        this.counterChannel1 = 0;
        this.freqCtrChannel1 = 0;
        this.samplePointChannel1 = 0;
        this.envelopeCtrChannel1 = 0;
        this.envelopeActiveChannel1 = false;
        this.sweepCtrChannel1 = 0;
        this.sweepOnChannel1 = false;

        this.channel2Active = false;
        this.counterChannel2 = 0;
        this.freqCtrChannel2 = 0;
        this.samplePointChannel2 = 0;
        this.envelopeCtrChannel2 = 0;
        this.envelopeActiveChannel2 = false;

        this.channel3Active = false;
        this.counterChannel3 = 0;
        this.freqCtrChannel3 = 0;
        this.samplePointChannel3 = 0;
        this.sampleChannel3 = 0;

        this.channel4Active = false;
        this.sampleChannel4 = 0;
        this.counterChannel4 = 0;
        this.freqCtrChannel4 = 0;
        this.volumeChannel4 = 0;
        this.envelopeCtrChannel4 = 0;
        this.envelopeActiveChannel4 = false;
        this.lfsr = 0;
    }

    cycle(cpuClocks: number) {
        while (cpuClocks > 0) {
            cpuClocks -= this.consume(cpuClocks);
        }
    }

    private consume(clocks: number): number {
        if (this.acc + clocks * this.sampleRate >= cnst.CLOCK) {
            let consumed = ((cnst.CLOCK - this.acc) / this.sampleRate) | 0;
            if ((cnst.CLOCK - this.acc) % this.sampleRate !== 0) consumed++;

            this.acc = this.acc + consumed * this.sampleRate - cnst.CLOCK;

            this.clockChannels(this.accClocks + consumed);
            this.accClocks = 0;

            if (this.sampleQueue) {
                if (this.reg[reg.nr52_ctrl] & 0x80) {
                    const nr51 = this.reg[reg.nr51_terminal];

                    const signalLeft =
                        (nr51 & 0x80 ? this.sampleChannel4 : 0) +
                        (nr51 & 0x40 ? this.sampleChannel3 : 0) +
                        (nr51 & 0x20 ? this.sampleChannel2 : 0) +
                        (nr51 & 0x10 ? this.sampleChannel1 : 0);

                    const signalRight =
                        (nr51 & 0x08 ? this.sampleChannel4 : 0) +
                        (nr51 & 0x04 ? this.sampleChannel3 : 0) +
                        (nr51 & 0x02 ? this.sampleChannel2 : 0) +
                        (nr51 & 0x01 ? this.sampleChannel1 : 0);

                    const nr50 = this.reg[reg.nr50_volume];
                    this.sampleQueue.push((signalLeft * ((nr50 & 0x70) >>> 4)) / 420, (signalRight * (nr50 & 0x07)) / 420);
                } else {
                    this.sampleQueue.push(0, 0);
                }
            }

            return consumed;
        } else {
            this.acc += clocks * this.sampleRate;
            this.accClocks += clocks;
            return clocks;
        }
    }

    private clockChannels(clocks: number): void {
        if (!(this.reg[reg.nr52_ctrl] & 0x80)) return;

        this.accLengthCtr += clocks;

        // 1MHz / 4096 = 256Hz
        const lengthCtrClocks = (this.accLengthCtr / 4096) | 0;
        this.accLengthCtr %= 4096;

        this.clockChannel1(clocks, lengthCtrClocks);
        this.clockChannel2(clocks, lengthCtrClocks);
        this.clockChannel3(clocks, lengthCtrClocks);
        this.clockChannel4(clocks, lengthCtrClocks);
    }

    private clockChannel1(cpuClocks: number, lengthCtrClocks: number) {
        this.sampleChannel1 = 0;
        if (!this.channel1Active) return;

        if (this.reg[reg.nr14_ctrl_freq_hi] & 0x40) {
            this.counterChannel1 += lengthCtrClocks;
            if (this.counterChannel1 >= 64 - (this.reg[reg.nr11_duty_length] & 0x3f || 64)) {
                this.channel1Active = false;

                return;
            }
        }

        let freqX = (this.reg[reg.nr13_freq_lo] | (this.reg[reg.nr14_ctrl_freq_hi] << 8)) & 0x07ff;

        if (this.sweepOnChannel1) {
            this.sweepCtrChannel1 += lengthCtrClocks;

            const sweepPeriod = (this.reg[reg.nr10_sweep] & 0x70) >>> 4 || 8;
            const sweepSteps = (this.sweepCtrChannel1 / (2 * sweepPeriod)) | 0;
            this.sweepCtrChannel1 %= 2 * sweepPeriod;

            const sweepShift = this.reg[reg.nr10_sweep] & 0x07;
            if (sweepSteps > 0) {
                for (let i = 0; i < sweepSteps; i++) {
                    this.freqShadowChannel1 = this.calculateSweep();

                    if (this.freqShadowChannel1 > 0x07ff) {
                        this.channel1Active = false;
                        return;
                    }
                }

                if (sweepShift > 0) {
                    this.reg[reg.nr13_freq_lo] = this.freqShadowChannel1 & 0xff;
                    this.reg[reg.nr14_ctrl_freq_hi] = (this.reg[reg.nr14_ctrl_freq_hi] & 0xf8) | (this.freqShadowChannel1 >>> 8);

                    freqX = this.freqShadowChannel1;
                }
            }
        }

        if (this.envelopeActiveChannel1 && (this.reg[reg.nr12_envelope] & 0x07) > 0) {
            this.envelopeCtrChannel1 += lengthCtrClocks;
            const envelopeSteps = (this.envelopeCtrChannel1 / (4 * (this.reg[reg.nr12_envelope] & 0x07))) | 0;
            this.envelopeCtrChannel1 %= 4 * (this.reg[reg.nr12_envelope] & 0x07);

            this.volumeChannel1 = this.reg[reg.nr12_envelope] & 0x08 ? this.volumeChannel1 + envelopeSteps : this.volumeChannel1 - envelopeSteps;
            if (this.volumeChannel1 < 0) {
                this.volumeChannel1 = 0;
                this.envelopeActiveChannel1 = false;
            }

            if (this.volumeChannel1 > 0x0f) {
                this.volumeChannel1 = 0x0f;
                this.envelopeActiveChannel1 = false;
            }
        }

        if (this.volumeChannel1 === 0) return;

        const freq = 0x0800 - freqX;
        this.freqCtrChannel1 += cpuClocks;

        this.samplePointChannel1 += (this.freqCtrChannel1 / freq) | 0;
        this.samplePointChannel1 %= 8;

        this.freqCtrChannel1 = this.freqCtrChannel1 % freq;

        if (((131072 / freq) | 0) > cnst.CUTOFF_HZ) return;
        this.sampleChannel1 = WAVEFORMS[this.reg[reg.nr11_duty_length] >>> 6] & (1 << this.samplePointChannel1) ? this.volumeChannel1 : 0;
    }

    private clockChannel2(cpuClocks: number, lengthCtrClocks: number) {
        this.sampleChannel2 = 0;
        if (!this.channel2Active) return;

        if (this.reg[reg.nr24_ctrl_freq_hi] & 0x40) {
            this.counterChannel2 += lengthCtrClocks;
            if (this.counterChannel2 >= 64 - (this.reg[reg.nr21_duty_length] & 0x3f)) {
                this.channel2Active = false;

                return;
            }
        }

        if (this.envelopeActiveChannel2 && (this.reg[reg.nr22_envelope] & 0x07) > 0) {
            this.envelopeCtrChannel2 += lengthCtrClocks;
            const envelopeSteps = (this.envelopeCtrChannel2 / (4 * (this.reg[reg.nr22_envelope] & 0x07))) | 0;
            this.envelopeCtrChannel2 %= 4 * (this.reg[reg.nr22_envelope] & 0x07);

            this.volumeChannel2 = this.reg[reg.nr22_envelope] & 0x08 ? this.volumeChannel2 + envelopeSteps : this.volumeChannel2 - envelopeSteps;
            if (this.volumeChannel2 < 0) {
                this.volumeChannel2 = 0;
                this.envelopeActiveChannel2 = false;
            }

            if (this.volumeChannel2 > 0x0f) {
                this.volumeChannel2 = 0x0f;
                this.envelopeActiveChannel2 = false;
            }
        }

        if (this.volumeChannel2 === 0) return;

        const freq = 0x0800 - ((this.reg[reg.nr23_freq_lo] | (this.reg[reg.nr24_ctrl_freq_hi] << 8)) & 0x07ff);
        this.freqCtrChannel2 += cpuClocks;

        this.samplePointChannel2 += (this.freqCtrChannel2 / freq) | 0;
        this.samplePointChannel2 %= 8;

        this.freqCtrChannel2 = this.freqCtrChannel2 % freq;

        if (((131072 / freq) | 0) > cnst.CUTOFF_HZ) return;
        this.sampleChannel2 = WAVEFORMS[this.reg[reg.nr21_duty_length] >>> 6] & (1 << this.samplePointChannel2) ? this.volumeChannel2 : 0;
    }

    private clockChannel3(cpuClocks: number, lengthCtrClocks: number) {
        this.sampleChannel3 = 0;
        if (!this.channel3Active || !(this.reg[reg.nr30_onoff] & 0x80)) return;

        if (this.reg[reg.nr34_ctrl_freq_hi] & 0x40) {
            this.counterChannel3 += lengthCtrClocks;
            if (this.counterChannel3 >= 256 - this.reg[reg.nr31_length]) {
                this.channel3Active = false;

                return;
            }
        }

        const level = (this.reg[reg.nr32_level] & 0x60) >> 5;
        if (level === 0) return;

        const freq = (0x0800 - ((this.reg[reg.nr33_freq_lo] | (this.reg[reg.nr34_ctrl_freq_hi] << 8)) & 0x07ff)) >>> 1;
        this.freqCtrChannel3 += cpuClocks;

        this.samplePointChannel3 += (this.freqCtrChannel3 / freq) | 0;
        this.samplePointChannel3 %= 32;

        this.freqCtrChannel3 = this.freqCtrChannel3 % freq;

        let sample = this.waveRam[this.samplePointChannel3 >>> 1];
        if (this.samplePointChannel3 % 2 === 0) sample >>>= 4;
        else sample &= 0x0f;

        if (((131072 / freq) | 0) > cnst.CUTOFF_HZ) return;
        this.sampleChannel3 = sample >>> (level - 1);
    }

    private clockChannel4(cpuClocks: number, lengthCtrClocks: number) {
        this.sampleChannel4 = 0;
        if (!this.channel4Active) return;

        if (this.reg[reg.nr44_ctrl] & 0x40) {
            this.counterChannel4 += lengthCtrClocks;
            if (this.counterChannel4 >= 64 - (this.reg[reg.nr41_length] & 0x3f)) {
                this.channel4Active = false;

                return;
            }
        }

        if (this.envelopeActiveChannel4 && (this.reg[reg.nr42_envelope] & 0x07) > 0) {
            this.envelopeCtrChannel4 += lengthCtrClocks;
            const envelopeSteps = (this.envelopeCtrChannel4 / (4 * (this.reg[reg.nr42_envelope] & 0x07))) | 0;
            this.envelopeCtrChannel4 %= 4 * (this.reg[reg.nr42_envelope] & 0x07);

            this.volumeChannel4 = this.reg[reg.nr42_envelope] & 0x08 ? this.volumeChannel4 + envelopeSteps : this.volumeChannel4 - envelopeSteps;
            if (this.volumeChannel4 < 0) {
                this.volumeChannel4 = 0;
                this.envelopeActiveChannel4 = false;
            }

            if (this.volumeChannel4 > 0x0f) {
                this.volumeChannel4 = 0x0f;
                this.envelopeActiveChannel4 = false;
            }
        }

        if (this.volumeChannel4 === 0) return;

        const poly = this.reg[reg.nr43_poly];
        const divisorCode = poly & 0x07;
        const divisor = divisorCode === 0 ? 8 : divisorCode * 16;

        const freq = divisor << (poly >>> 4);
        this.freqCtrChannel4 += 4 * cpuClocks;

        const lfsrCycles = (this.freqCtrChannel4 / freq) | 0;
        this.freqCtrChannel4 = this.freqCtrChannel4 % freq;

        if (poly & 0x80) {
            for (let i = 0; i < lfsrCycles; i++) {
                const xor = ((this.lfsr >>> 1) ^ this.lfsr) & 0x01;
                this.lfsr = ((this.lfsr >>> 1) & ~0x40) | (xor << 15) | (xor << 6);
            }
        } else {
            for (let i = 0; i < lfsrCycles; i++) {
                const xor = ((this.lfsr >>> 1) ^ this.lfsr) & 0x01;
                this.lfsr = (this.lfsr >>> 1) | (xor << 15);
            }
        }

        if ((((4 * 1024 * 1024) / freq) | 0) > this.sampleRate >>> 2) {
            this.sampleChannel4 = (this.sampleChannel4 + (this.lfsr & 0x01 ? 0 : this.volumeChannel4)) >>> 1;
        } else {
            this.sampleChannel4 = this.lfsr & 0x01 ? 0 : this.volumeChannel4;
        }
    }

    private calculateSweep(): number {
        return this.reg[reg.nr10_sweep] & 0x08
            ? this.freqShadowChannel1 - (this.freqShadowChannel1 >>> (this.reg[reg.nr10_sweep] & 0x07))
            : this.freqShadowChannel1 + (this.freqShadowChannel1 >>> (this.reg[reg.nr10_sweep] & 0x07));
    }

    private unmappedRead: ReadHandler = () => 0xff;
    private unmappedWrite: WriteHandler = () => undefined;

    private regRead: ReadHandler = (address) => this.reg[address - reg.base];
    private regWrite: WriteHandler = (address, value) => (this.reg[address - reg.base] = value);

    private waveRamRead: ReadHandler = (address) => this.waveRam[address - 0xff30];
    private waveRamWrite: WriteHandler = (address, value) => (this.waveRam[address - 0xff30] = value);

    private writeNR12: WriteHandler = (_, value) => {
        const oldValue = this.reg[reg.nr12_envelope];
        this.reg[reg.nr12_envelope] = value;

        if (this.envelopeActiveChannel1 && (oldValue & 0x07) === 0) {
            this.volumeChannel1 = (this.volumeChannel1 + (oldValue & 0x08 ? 1 : 2)) & 0x0f;
        }
    };

    private readNR14: ReadHandler = () => this.reg[reg.nr14_ctrl_freq_hi] | 0xbf;
    private writeNR14: WriteHandler = (_, value) => {
        this.reg[reg.nr14_ctrl_freq_hi] = value;

        this.sweepCtrChannel1 = 0;
        this.freqShadowChannel1 = (this.reg[reg.nr13_freq_lo] | (this.reg[reg.nr14_ctrl_freq_hi] << 8)) & 0x07ff;

        if (value & 0x80) {
            this.channel1Active = true;
            this.counterChannel1 = 0;
            this.freqCtrChannel1 = 0;
            this.samplePointChannel1 = 0;
            this.envelopeCtrChannel1 = 0;
            this.volumeChannel1 = this.reg[reg.nr12_envelope] >>> 4;
            this.envelopeActiveChannel1 = true;

            this.sweepCtrChannel1 = 0;
            this.freqShadowChannel1 = (this.reg[reg.nr13_freq_lo] | (this.reg[reg.nr14_ctrl_freq_hi] << 8)) & 0x07ff;
            this.sweepOnChannel1 = (this.reg[reg.nr10_sweep] & 0x77) !== 0;
            if ((this.reg[reg.nr10_sweep] & 0x07) > 0 && this.calculateSweep() > 0x07ff) this.channel1Active = false;
        }
    };

    private writeNR22: WriteHandler = (_, value) => {
        const oldValue = this.reg[reg.nr22_envelope];
        this.reg[reg.nr22_envelope] = value;

        if (this.envelopeActiveChannel2 && (oldValue & 0x07) === 0) {
            this.volumeChannel2 = (this.volumeChannel2 + (oldValue & 0x08 ? 1 : 2)) & 0x0f;
        }
    };

    private readNR24: ReadHandler = () => this.reg[reg.nr24_ctrl_freq_hi] | 0xbf;
    private writeNR24: WriteHandler = (_, value) => {
        this.reg[reg.nr24_ctrl_freq_hi] = value;

        if (value & 0x80) {
            this.channel2Active = true;
            this.counterChannel2 = 0;
            this.freqCtrChannel2 = 0;
            this.samplePointChannel2 = 0;
            this.envelopeCtrChannel2 = 0;
            this.volumeChannel2 = this.reg[reg.nr22_envelope] >>> 4;
            this.envelopeActiveChannel2 = true;
        }
    };

    private readNR34: ReadHandler = () => this.reg[reg.nr34_ctrl_freq_hi] | 0xbf;
    private writeNR34: WriteHandler = (_, value) => {
        this.reg[reg.nr34_ctrl_freq_hi] = value;

        if (value & 0x80 && this.reg[reg.nr30_onoff] & 0x80) {
            this.channel3Active = true;
            this.counterChannel3 = 0;
            this.freqCtrChannel3 = 0;
            this.samplePointChannel3 = 0;
        }
    };

    private writeNR42: WriteHandler = (_, value) => {
        const oldValue = this.reg[reg.nr42_envelope];
        this.reg[reg.nr42_envelope] = value;

        if (this.envelopeActiveChannel4 && (oldValue & 0x07) === 0) {
            this.volumeChannel4 = (this.volumeChannel4 + (oldValue & 0x08 ? 1 : 2)) & 0x0f;
        }
    };

    private readNR44: ReadHandler = () => this.reg[reg.nr44_ctrl] | 0xbf;
    private writeNR44: WriteHandler = (_, value) => {
        this.reg[reg.nr44_ctrl] = value;

        if (value & 0x80) {
            this.channel4Active = true;
            this.counterChannel4 = 0;
            this.freqCtrChannel4 = 0;
            this.envelopeCtrChannel4 = 0;
            this.volumeChannel4 = this.reg[reg.nr42_envelope] >>> 4;
            this.envelopeActiveChannel4 = true;
            this.lfsr = 0xffff;
        }
    };

    private readNR52: ReadHandler = () => (this.reg[reg.nr52_ctrl] & 0x80) | 0x70 | (this.channel2Active ? 0x02 : 0x00);
    private writeNR52: WriteHandler = (_, value) => {
        this.reg[reg.nr52_ctrl] = value;

        if (~value & 0x80) {
            this.reg.subarray(0, reg.nr52_ctrl).fill(0);
            this.acc = 0;
            this.accLengthCtr = 0;
            this.channel1Active = false;
            this.channel2Active = false;
            this.channel3Active = false;
            this.channel4Active = false;
        }
    };

    private reg = new Uint8Array(0x17);
    private waveRam = new Uint8Array(0x0f);

    private acc = 0;
    private accClocks = 0;
    private accLengthCtr = 0;

    private channel2Active = false;
    private sampleChannel2 = 0;
    private counterChannel2 = 0;
    private freqCtrChannel2 = 0;
    private samplePointChannel2 = 0;
    private volumeChannel2 = 0;
    private envelopeCtrChannel2 = 0;
    private envelopeActiveChannel2 = false;

    private channel1Active = false;
    private sampleChannel1 = 0;
    private counterChannel1 = 0;
    private freqCtrChannel1 = 0;
    private samplePointChannel1 = 0;
    private volumeChannel1 = 0;
    private envelopeCtrChannel1 = 0;
    private sweepCtrChannel1 = 0;
    private freqShadowChannel1 = 0;
    private sweepOnChannel1 = false;
    private envelopeActiveChannel1 = false;

    private channel3Active = false;
    private counterChannel3 = 0;
    private freqCtrChannel3 = 0;
    private samplePointChannel3 = 0;
    private sampleChannel3 = 0;

    private channel4Active = false;
    private sampleChannel4 = 0;
    private counterChannel4 = 0;
    private freqCtrChannel4 = 0;
    private volumeChannel4 = 0;
    private envelopeCtrChannel4 = 0;
    private envelopeActiveChannel4 = false;
    private lfsr = 0;

    private sampleQueue: SampleQueue | undefined = undefined;
    private sampleRate = 44100;
}
