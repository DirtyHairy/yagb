import { Bus, ReadHandler, WriteHandler } from './bus';

import { SampleQueue } from './apu/sample-queue';

const REG_INITIAL = new Uint8Array([
    0x80, 0xbf, 0xf3, 0xff, 0xbf, 0xff, 0x3f, 0x00, 0xff, 0xbf, 0x7f, 0xff, 0x9f, 0xff, 0xbf, 0xff, 0xff, 0x00, 0x00, 0xbf, 0x77, 0xf3, 0xf1,
]);

const WAVEFORMS = new Uint8Array([0x01, 0x03, 0x0f, 0xfc]);

const enum cnst {
    CLOCK = 1048576,
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
    nr30 = 0x0a,
    nr31 = 0x0b,
    nr32 = 0x0c,
    nr33 = 0x0d,
    nr34 = 0x0e,
    nr41 = 0x10,
    nr42 = 0x11,
    nr43 = 0x12,
    nr44 = 0x13,
    nr50_volume = 0x14,
    nr51_terminal = 0x15,
    nr52_ctrl = 0x16,
}
export class Apu {
    constructor() {}

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
        bus.map(reg.base + reg.nr52_ctrl, this.readNR52, this.writeNR52);

        bus.map(0xff15, this.unmappedRead, this.unmappedWrite);
        bus.map(0xff1f, this.unmappedRead, this.unmappedWrite);
    }

    reset(): void {
        this.reg.set(REG_INITIAL);
        this.waveRam.fill(0);
        this.acc = 0;
        this.accLengthCtr = 0;

        this.channel2Active = false;
        this.counterChannel2 = 0;
        this.freqCtrChannel2 = 0;
        this.samplePointChannel2 = 0;
        this.envelopeCtrChannel2 = 0;

        this.channel1Active = false;
        this.counterChannel1 = 0;
        this.freqCtrChannel1 = 0;
        this.samplePointChannel1 = 0;
        this.envelopeCtrChannel1 = 0;
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

            const oldAcc = this.acc;
            this.acc = this.acc + consumed * this.sampleRate - cnst.CLOCK;

            this.clockChannels((((oldAcc - this.acc) / this.sampleRate) | 0) + consumed);

            if (this.sampleQueue) {
                if (this.reg[reg.nr52_ctrl] & 0x80) {
                    this.sampleQueue.push((this.sampleChannel2 + this.sampleChannel1) / 0x3c, (this.sampleChannel2 + this.sampleChannel1) / 0x3c);
                } else {
                    this.sampleQueue.push(0, 0);
                }
            }

            return consumed;
        } else {
            this.acc += clocks * this.sampleRate;
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
    }

    private clockChannel1(cpuClocks: number, lengthCtrClocks: number) {
        this.sampleChannel1 = 0;
        if (!this.channel1Active) return;

        if (this.reg[reg.nr14_ctrl_freq_hi] & 0x40) {
            this.counterChannel1 += lengthCtrClocks;
            if (this.counterChannel1 >= (this.reg[reg.nr21_duty_length] & 0x3f)) {
                this.channel1Active = false;

                return;
            }
        }

        if ((this.reg[reg.nr12_envelope] & 0x07) > 0) {
            this.envelopeCtrChannel1 += lengthCtrClocks;
            const envelopeSteps = (this.envelopeCtrChannel1 / (4 * (this.reg[reg.nr12_envelope] & 0x07))) | 0;
            this.envelopeCtrChannel1 %= 4 * (this.reg[reg.nr12_envelope] & 0x07);

            this.volumeChannel1 = this.reg[reg.nr12_envelope] & 0x08 ? this.volumeChannel1 + envelopeSteps : this.volumeChannel1 - envelopeSteps;
            if (this.volumeChannel1 < 0) this.volumeChannel1 = 0;
            if (this.volumeChannel1 > 0x0f) this.volumeChannel1 = 0x0f;
        }

        if (this.volumeChannel1 === 0) return;

        const freq = 0x0800 - ((this.reg[reg.nr13_freq_lo] | (this.reg[reg.nr14_ctrl_freq_hi] << 8)) & 0x07ff);
        this.freqCtrChannel1 += cpuClocks;

        this.samplePointChannel1 += (this.freqCtrChannel1 / freq) | 0;
        this.samplePointChannel1 %= 8;

        this.freqCtrChannel1 = this.freqCtrChannel1 % freq;

        this.sampleChannel1 = WAVEFORMS[this.reg[reg.nr11_duty_length] >>> 6] & (1 << this.samplePointChannel1) ? this.volumeChannel1 : 0;
    }

    private clockChannel2(cpuClocks: number, lengthCtrClocks: number) {
        this.sampleChannel2 = 0;
        if (!this.channel2Active) return;

        if (this.reg[reg.nr24_ctrl_freq_hi] & 0x40) {
            this.counterChannel2 += lengthCtrClocks;
            if (this.counterChannel2 >= (this.reg[reg.nr21_duty_length] & 0x3f)) {
                this.sampleChannel2 = 0;
                this.channel2Active = false;

                return;
            }
        }

        if ((this.reg[reg.nr22_envelope] & 0x07) > 0) {
            this.envelopeCtrChannel2 += lengthCtrClocks;
            const envelopeSteps = (this.envelopeCtrChannel2 / (4 * (this.reg[reg.nr22_envelope] & 0x07))) | 0;
            this.envelopeCtrChannel2 %= 4 * (this.reg[reg.nr22_envelope] & 0x07);

            this.volumeChannel2 = this.reg[reg.nr22_envelope] & 0x08 ? this.volumeChannel2 + envelopeSteps : this.volumeChannel2 - envelopeSteps;
            if (this.volumeChannel2 < 0) this.volumeChannel2 = 0;
            if (this.volumeChannel2 > 0x0f) this.volumeChannel2 = 0x0f;
        }

        if (this.volumeChannel2 === 0) return;

        const freq = 0x0800 - ((this.reg[reg.nr23_freq_lo] | (this.reg[reg.nr24_ctrl_freq_hi] << 8)) & 0x07ff);
        this.freqCtrChannel2 += cpuClocks;

        this.samplePointChannel2 += (this.freqCtrChannel2 / freq) | 0;
        this.samplePointChannel2 %= 8;

        this.freqCtrChannel2 = this.freqCtrChannel2 % freq;

        this.sampleChannel2 = WAVEFORMS[this.reg[reg.nr21_duty_length] >>> 6] & (1 << this.samplePointChannel2) ? this.volumeChannel2 : 0;
    }

    private unmappedRead: ReadHandler = () => 0xff;
    private unmappedWrite: WriteHandler = () => undefined;

    private regRead: ReadHandler = (address) => this.reg[address - reg.base];
    private regWrite: WriteHandler = (address, value) => (this.reg[address - reg.base] = value);

    private waveRamRead: ReadHandler = (address) => this.waveRam[address - 0xff30];
    private waveRamWrite: WriteHandler = (address, value) => (this.waveRam[address - 0xff30] = value);

    private writeNR22: WriteHandler = (_, value) => {
        this.reg[reg.nr22_envelope] = value;
        this.volumeChannel2 = this.reg[reg.nr22_envelope] >>> 4;
        this.envelopeCtrChannel2 = 0;
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
        }
    };

    private writeNR12: WriteHandler = (_, value) => {
        this.reg[reg.nr12_envelope] = value;
        this.volumeChannel1 = this.reg[reg.nr12_envelope] >>> 4;
        this.envelopeCtrChannel1 = 0;
    };

    private readNR14: ReadHandler = () => this.reg[reg.nr14_ctrl_freq_hi] | 0xbf;
    private writeNR14: WriteHandler = (_, value) => {
        this.reg[reg.nr14_ctrl_freq_hi] = value;

        if (value & 0x80) {
            this.channel1Active = true;
            this.counterChannel1 = 0;
            this.freqCtrChannel1 = 0;
            this.samplePointChannel1 = 0;
            this.envelopeCtrChannel1 = 0;
        }
    };

    private readNR52: ReadHandler = () => (this.reg[reg.nr52_ctrl] & 0x80) | 0x70 | (this.channel2Active ? 0x02 : 0x00);
    private writeNR52: WriteHandler = (_, value) => {
        this.reg[reg.nr52_ctrl] = value;

        if (~value & 0x80) {
            this.reg.subarray(0, reg.nr52_ctrl).fill(0);
            this.acc = 0;
            this.accLengthCtr = 0;
        }
    };

    private reg = new Uint8Array(0x17);
    private waveRam = new Uint8Array(0x0f);

    private acc = 0;
    private accLengthCtr = 0;

    private channel2Active = false;
    private sampleChannel2 = 0;
    private counterChannel2 = 0;
    private freqCtrChannel2 = 0;
    private samplePointChannel2 = 0;
    private volumeChannel2 = 0;
    private envelopeCtrChannel2 = 0;

    private channel1Active = false;
    private sampleChannel1 = 0;
    private counterChannel1 = 0;
    private freqCtrChannel1 = 0;
    private samplePointChannel1 = 0;
    private volumeChannel1 = 0;
    private envelopeCtrChannel1 = 0;

    private sampleQueue: SampleQueue | undefined = undefined;
    private sampleRate = 44100;
}
