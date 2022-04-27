import { Bus, ReadHandler, WriteHandler } from './bus';

const REG_INITIAL = new Uint8Array([
    0x80, 0xbf, 0xf3, 0xff, 0xbf, 0xff, 0x3f, 0x00, 0xff, 0xbf, 0x7f, 0xff, 0x9f, 0xff, 0xbf, 0xff, 0xff, 0x00, 0x00, 0xbf, 0x77, 0xf3, 0xf1,
]);

const enum reg {
    base = 0xff10,
    nr10 = 0x00,
    nr11 = 0x01,
    mr12 = 0x02,
    nr13 = 0x03,
    nr14 = 0x04,
    nr21 = 0x06,
    nr22 = 0x07,
    nr23 = 0x08,
    nr24 = 0x09,
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
    nr52_onoff = 0x16,
}
export class Audio {
    install(bus: Bus): void {
        for (let i = reg.base; i <= reg.base + 0x16; i++) {
            bus.map(i, this.regRead, this.regWrite);
        }

        for (let i = 0xff30; i <= 0xff3f; i++) {
            bus.map(i, this.waveRamRead, this.waveRamWrite);
        }

        bus.map(0xff15, this.unmappedRead, this.unmappedWrite);
        bus.map(0xff1f, this.unmappedRead, this.unmappedWrite);
    }

    reset(): void {
        this.reg.set(REG_INITIAL);
        this.waveRam.fill(0);
    }

    private unmappedRead: ReadHandler = () => 0xff;
    private unmappedWrite: WriteHandler = () => undefined;

    private regRead: ReadHandler = (address) => this.reg[address - reg.base];
    private regWrite: WriteHandler = (address, value) => (this.reg[address - reg.base] = value);

    private waveRamRead: ReadHandler = (address) => this.waveRam[address - 0xff30];
    private waveRamWrite: WriteHandler = (address, value) => (this.waveRam[address - 0xff30] = value);

    private reg = new Uint8Array(0x17);
    private waveRam = new Uint8Array(0x0f);
}
