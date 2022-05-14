import { ReadHandler, WriteHandler } from '../bus';

import { Bus } from './../bus';
import { Savestate } from './../savestate';
import { cnst } from './definitions';

export const enum reg {
    nrX0_onoff = 0x00,
    nrX1_length = 0x01,
    nrX2_level = 0x02,
    nrX3_freq_lo = 0x03,
    nrX4_ctrl_freq_hi = 0x04,
}

const SAVESTATE_VERSION = 0x00;

export class ChannelWave {
    constructor(_reg: Uint8Array) {
        this.reg = _reg;
    }

    save(savestate: Savestate): void {
        savestate
            .startChunk(SAVESTATE_VERSION)
            .write16(this.sample)
            .writeBool(this.isActive)
            .writeBuffer(this.waveRam)
            .write16(this.counter)
            .write16(this.freqCtr)
            .write16(this.samplePoint);
    }

    load(savestate: Savestate): void {
        savestate.validateChunk(SAVESTATE_VERSION);

        this.sample = savestate.read16();
        this.isActive = savestate.readBool();
        this.waveRam.set(savestate.readBuffer(this.waveRam.length));
        this.counter = savestate.read16();
        this.freqCtr = savestate.read16();
        this.samplePoint = savestate.read16();
    }

    reset(): void {
        this.softReset();

        this.waveRam.fill(0);
    }

    softReset(): void {
        this.isActive = false;
        this.counter = 0;
        this.freqCtr = 0;
        this.samplePoint = 0;
        this.sample = 0;
    }

    install(bus: Bus, base: number): void {
        for (let i = 0xff30; i <= 0xff3f; i++) {
            bus.map(i, this.waveRamRead, this.waveRamWrite);
        }

        bus.map(base + reg.nrX0_onoff, this.readNRX0, this.writeNRX0);
        bus.map(base + reg.nrX4_ctrl_freq_hi, this.readNRX4, this.writeNRX4);
    }

    cycle(cpuClocks: number, lengthCtrClocks: number): void {
        if ((this.reg[reg.nrX0_onoff] & 0x80) === 0) {
            this.sample = 0;
            return;
        }

        this.sample = 0x0f;
        if (!(this.reg[reg.nrX0_onoff] & 0x80 && this.isActive)) return;

        if (this.reg[reg.nrX4_ctrl_freq_hi] & 0x40) {
            this.counter += lengthCtrClocks;
            if (this.counter >= 256 - this.reg[reg.nrX1_length]) {
                this.isActive = false;

                return;
            }
        }

        const level = (this.reg[reg.nrX2_level] & 0x60) >> 5;
        if (level === 0) return;

        const freq = (0x0800 - ((this.reg[reg.nrX3_freq_lo] | (this.reg[reg.nrX4_ctrl_freq_hi] << 8)) & 0x07ff)) >>> 1;
        this.freqCtr += cpuClocks;

        this.samplePoint += (this.freqCtr / freq) | 0;
        this.samplePoint %= 32;

        this.freqCtr = this.freqCtr % freq;

        let sample = this.waveRam[this.samplePoint >>> 1];
        if (this.samplePoint % 2 === 0) sample >>>= 4;
        else sample &= 0x0f;

        // It would be more correct to replace this with an average like for the wave
        // channels, but I know of now example to test this.
        if (((131072 / freq) | 0) > cnst.CUTOFF_HZ) return;
        this.sample -= 2 * (sample >>> (level - 1));
    }

    private waveRamRead: ReadHandler = (address) => this.waveRam[address - 0xff30];
    private waveRamWrite: WriteHandler = (address, value) => (this.waveRam[address - 0xff30] = value);

    private readNRX0: ReadHandler = () => this.reg[reg.nrX0_onoff];
    private writeNRX0: WriteHandler = (_, value) => {
        this.reg[reg.nrX0_onoff] = value;

        if ((value & 0x80) === 0x00) this.isActive = false;
    };

    private readNRX4: ReadHandler = () => this.reg[reg.nrX4_ctrl_freq_hi] | 0xbf;
    private writeNRX4: WriteHandler = (_, value) => {
        this.reg[reg.nrX4_ctrl_freq_hi] = value;

        if (value & 0x80 && this.reg[reg.nrX0_onoff] & 0x80) {
            this.isActive = true;
            this.counter = 0;
            this.freqCtr = 0;
            this.samplePoint = 0;
        }
    };

    sample = 0;
    isActive = false;

    private reg: Uint8Array;
    private waveRam = new Uint8Array(0x0f);

    private counter = 0;
    private freqCtr = 0;
    private samplePoint = 0;
}
