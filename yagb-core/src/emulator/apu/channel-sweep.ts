import { ChannelTone, reg } from './channel-tone';

import { Savestate } from './../savestate';
import { WriteHandler } from '../bus';

const SAVESTATE_VERSION = 0x00;

export class ChannelSweep extends ChannelTone {
    reset(): void {
        super.reset();

        this.sweepCtr = 0;
        this.freqShadow = 0;
        this.sweepOn = false;
    }

    save(savestate: Savestate): void {
        super.save(savestate);

        savestate.startChunk(SAVESTATE_VERSION).write16(this.sweepCtr).write16(this.freqShadow).writeBool(this.sweepOn);
    }

    load(savestate: Savestate): void {
        super.load(savestate);

        savestate.validateChunk(SAVESTATE_VERSION);

        this.sweepCtr = savestate.read16();
        this.freqShadow = savestate.read16();
        this.sweepOn = savestate.readBool();
    }

    cycle(cpuClocks: number, lengthCtrClocks: number): void {
        if ((this.reg[reg.nrx2_envelope] & 0xf8) === 0) {
            this.sample = 0;
            return;
        }

        this.sample = 0x0f;
        if (!(this.reg[reg.nrx2_envelope] & 0xf8 && this.isActive)) return;

        this.cycleLengthCtr(lengthCtrClocks);
        if (!this.isActive) return;

        this.cycleSweep(lengthCtrClocks);
        if (!this.isActive) return;

        this.cycleEnvelope(lengthCtrClocks);
        if (this.volume === 0) return;

        this.cycleFreqCtrAndSample(cpuClocks);
    }

    protected writeNRX4: WriteHandler = (_, value) => {
        this.reg[reg.nrx4_ctrl_freq_hi] = value;

        if (value & 0x80) {
            this.trigger();

            this.sweepCtr = 0;
            this.freqShadow = (this.reg[reg.nrx3_freq_lo] | (this.reg[reg.nrx4_ctrl_freq_hi] << 8)) & 0x07ff;
            this.sweepOn = (this.reg[reg.nrx0_sweep] & 0x77) !== 0;
            if ((this.reg[reg.nrx0_sweep] & 0x07) > 0 && this.calculateSweep() > 0x07ff) this.isActive = false;
        }
    };

    private cycleSweep(lengthCtrClocks: number): void {
        if (this.sweepOn) {
            this.sweepCtr += lengthCtrClocks;

            const sweepPeriod = (this.reg[reg.nrx0_sweep] & 0x70) >>> 4 || 8;
            const sweepSteps = (this.sweepCtr / (2 * sweepPeriod)) | 0;
            this.sweepCtr %= 2 * sweepPeriod;

            if (sweepPeriod === 8) return;

            const sweepShift = this.reg[reg.nrx0_sweep] & 0x07;
            if (sweepSteps > 0) {
                for (let i = 0; i < sweepSteps; i++) {
                    this.freqShadow = this.calculateSweep();

                    if (this.freqShadow > 0x07ff) {
                        this.isActive = false;
                        return;
                    }
                }

                if (sweepShift > 0) {
                    this.reg[reg.nrx3_freq_lo] = this.freqShadow & 0xff;
                    this.reg[reg.nrx4_ctrl_freq_hi] = (this.reg[reg.nrx4_ctrl_freq_hi] & 0xf8) | (this.freqShadow >>> 8);

                    if (this.freqShadow > 0x07ff) this.isActive = false;
                }
            }
        }
    }

    private calculateSweep(): number {
        return this.reg[reg.nrx0_sweep] & 0x08
            ? this.freqShadow - (this.freqShadow >>> (this.reg[reg.nrx0_sweep] & 0x07))
            : this.freqShadow + (this.freqShadow >>> (this.reg[reg.nrx0_sweep] & 0x07));
    }

    private sweepCtr = 0;
    private freqShadow = 0;
    private sweepOn = false;
}
