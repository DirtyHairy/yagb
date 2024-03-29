import { Bus, ReadHandler, WriteHandler } from './bus';

import { ChannelNoise } from './apu/channel-noise';
import { ChannelSweep } from './apu/channel-sweep';
import { ChannelTone } from './apu/channel-tone';
import { ChannelWave } from './apu/channel-wave';
import { SampleQueue } from './apu/sample-queue';
import { Savestate } from './savestate';
import { cnst } from './apu/definitions';

const REG_INITIAL = new Uint8Array([
    0x80, 0xbf, 0xf3, 0xff, 0xbf, 0xff, 0x3f, 0x00, 0xff, 0xbf, 0x7f, 0xff, 0x9f, 0xff, 0xbf, 0xff, 0xff, 0x00, 0x00, 0xbf, 0x77, 0xf3, 0xf1,
]);

export const enum reg {
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

const SAVESTATE_VERSION = 0x00;

/**
 * GENERAL NOTES
 *
 * - The Gameboy APU is capable of producing samples at the rate of 1MHz, while the
 *   host system (Web Audio) sample rate is much smaller (typically 48kHz). This
 *   means that some kind of downsampling has to take place.
 *
 * - YAGB batches cycles in the APU and keeps track of the time thus accumulated.
 *   Once enough cycles have accumulated to generate another (host) sample, the
 *   channels are stepped by the accumulated amount of clocks. This is designed to
 *   calculate the effect of all accumulated clocks in a single step.
 *
 * - After the channels have stepped, the channels are sampled and mixed, and a
 *   host sample is pushed to the sample queue.
 *
 * - This design implies that the APU cannot be cycle exact; the granularity in
 *   which time passes is determined by the host sample rate.
 *
 * - This algorithm corresponds to nearest-neightbour downsampling, which introduces
 *   aliasing artifacts. Those turn out to be almost inadible for most sound effects
 *   and tunes (a faint ringing can be heard for some high-pitched noises).
 */

export class Apu {
    save(savestate: Savestate): void {
        savestate.startChunk(SAVESTATE_VERSION).writeBuffer(this.reg).write16(this.acc).write16(this.accClocks).write16(this.accLengthCtr);

        this.channel1.save(savestate);
        this.channel2.save(savestate);
        this.channel3.save(savestate);
        this.channel4.save(savestate);
    }

    load(savestate: Savestate): void {
        savestate.validateChunk(SAVESTATE_VERSION);

        this.reg.set(savestate.readBuffer(this.reg.length));
        this.acc = savestate.read16();
        this.accClocks = savestate.read16();
        this.accLengthCtr = savestate.read16();

        this.channel1.load(savestate);
        this.channel2.load(savestate);
        this.channel3.load(savestate);
        this.channel4.load(savestate);
    }

    setSampleQueue(sampleQueue: SampleQueue) {
        this.sampleQueue = sampleQueue;
        this.sampleRate = sampleQueue.sampleRate;
    }

    install(bus: Bus): void {
        for (let i = reg.base; i <= reg.base + 0x16; i++) {
            bus.map(i, this.regRead, this.regWrite);
        }

        this.channel1.install(bus, reg.base);
        this.channel2.install(bus, reg.base + reg.nr21_duty_length - 1);
        this.channel3.install(bus, reg.base + reg.nr30_onoff);
        this.channel4.install(bus, reg.base + reg.nr41_length - 1);

        bus.map(reg.base + reg.nr52_ctrl, this.readNR52, this.writeNR52);

        bus.map(0xff15, this.unmappedRead, this.unmappedWrite);
        bus.map(0xff1f, this.unmappedRead, this.unmappedWrite);
    }

    reset(): void {
        // initial values taken from the Mooneye suite
        this.reg.set(REG_INITIAL);
        this.acc = 0;
        this.accClocks = 0;
        this.accLengthCtr = 0;

        this.channel1.reset();
        this.channel2.reset();
        this.channel3.reset();
        this.channel4.reset();
    }

    cycle(cpuClocks: number) {
        while (cpuClocks > 0) {
            // call consume until all cycles are accounted for.
            cpuClocks -= this.consume(cpuClocks);
        }
    }

    private consume(clocks: number): number {
        // This is the tricky part. acc accumulates the time that has not yet
        // been accounted for by clocking the channels. In order to get away
        // with integer arithmetics, acc is premultiplied with the clock (1MHz)
        // and with the sample rate. In order to interpret the next lines,
        // divide the equations by clock and sample rate.

        // enough clocks to generate the next sample?
        if (this.acc + clocks * this.sampleRate >= cnst.CLOCK) {
            // calculate the clocks required for the next sample
            let consumed = 0;
            let divAcc = 0;
            while (cnst.CLOCK - this.acc > divAcc) {
                divAcc += this.sampleRate;
                consumed++;
            }

            // keep track of any excess time that we are accumulating (usually,
            // the consumed clocks will place us a bit after the next sample
            // on the timeline)
            this.acc = this.acc + consumed * this.sampleRate - cnst.CLOCK;

            const apuEnabled = (this.reg[reg.nr52_ctrl] & 0x80) !== 0;

            // process the clocks that we have accumulated
            if (apuEnabled) this.clockChannels(this.accClocks + consumed);
            this.accClocks = 0;

            if (this.sampleQueue) {
                if (apuEnabled) {
                    const nr51 = this.reg[reg.nr51_terminal];

                    const signalLeft =
                        (nr51 & 0x80 ? this.channel4.sample : 0) +
                        (nr51 & 0x40 ? this.channel3.sample : 0) +
                        (nr51 & 0x20 ? this.channel2.sample : 0) +
                        (nr51 & 0x10 ? this.channel1.sample : 0);

                    const signalRight =
                        (nr51 & 0x08 ? this.channel4.sample : 0) +
                        (nr51 & 0x04 ? this.channel3.sample : 0) +
                        (nr51 & 0x02 ? this.channel2.sample : 0) +
                        (nr51 & 0x01 ? this.channel1.sample : 0);

                    const nr50 = this.reg[reg.nr50_volume];
                    this.sampleQueue.push(
                        (signalLeft * ((nr50 & 0x70) >>> 4)) / cnst.SAMPLE_NORMALIZATION,
                        (signalRight * (nr50 & 0x07)) / cnst.SAMPLE_NORMALIZATION
                    );
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
        const lengthCtrClocks = this.accLengthCtr >>> 12;
        this.accLengthCtr &= 0x0fff;

        this.channel1.cycle(clocks, lengthCtrClocks);
        this.channel2.cycle(clocks, lengthCtrClocks);
        this.channel3.cycle(clocks, lengthCtrClocks);
        this.channel4.cycle(clocks, lengthCtrClocks);
    }

    private unmappedRead: ReadHandler = () => 0xff;
    private unmappedWrite: WriteHandler = () => undefined;

    private regRead: ReadHandler = (address) => this.reg[address - reg.base];
    private regWrite: WriteHandler = (address, value) => (this.reg[address - reg.base] = value);

    private readNR52: ReadHandler = () =>
        this.reg[reg.nr52_ctrl] & 0x80
            ? 0xf0 |
              (this.channel1.isActive ? 0x01 : 0x00) |
              (this.channel2.isActive ? 0x02 : 0x00) |
              (this.channel3.isActive ? 0x04 : 0x00) |
              (this.channel4.isActive ? 0x08 : 0x00)
            : 0x70;

    private writeNR52: WriteHandler = (_, value) => {
        this.reg[reg.nr52_ctrl] = value;

        // reset channels if enable is cleared
        if (~value & 0x80) {
            this.reg.subarray(0, reg.nr52_ctrl).fill(0);
            this.acc = 0;
            this.accLengthCtr = 0;
            this.channel1.reset();
            this.channel2.reset();
            this.channel3.softReset();
            this.channel4.reset();
        }
    };

    private reg = new Uint8Array(0x17);

    private acc = 0;
    private accClocks = 0;
    private accLengthCtr = 0;

    private channel1 = new ChannelSweep(this.reg);
    private channel2 = new ChannelTone(this.reg.subarray(reg.nr21_duty_length - 1));
    private channel3 = new ChannelWave(this.reg.subarray(reg.nr30_onoff));
    private channel4 = new ChannelNoise(this.reg.subarray(reg.nr41_length - 1));

    private sampleQueue: SampleQueue | undefined = undefined;
    private sampleRate = 44100;
}
