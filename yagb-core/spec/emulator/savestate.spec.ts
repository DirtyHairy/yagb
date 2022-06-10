import { Savestate } from '../../src/emulator/savestate';
describe('Savestate', () => {
    it('starts empty', () => {
        const savestate = new Savestate(new Uint8Array(128));

        expect(savestate.getBuffer().length).toBe(0);
    });

    describe('startChunk', () => {
        it('writes a single word', () => {
            const savestate = new Savestate(new Uint8Array(128));

            savestate.startChunk(0);
            expect(savestate.getBuffer().length).toBe(2);
        });

        it('throws if the capacity is exceeded', () => {
            const savestate = new Savestate(new Uint8Array(2));

            savestate.write16(0);

            expect(() => savestate.startChunk(0)).toThrow();
        });
    });

    describe('validateChunk', () => {
        it('returns the chunk version', () => {
            const savestate = new Savestate(new Uint8Array(128));
            savestate.startChunk(0);

            const buffer = savestate.getBuffer();
            expect(new Savestate(buffer).validateChunk(0)).toBe(0);
        });

        it('throws if the chunk version does not match', () => {
            const savestate = new Savestate(new Uint8Array(128));
            savestate.startChunk(1);

            const buffer = savestate.getBuffer();
            expect(() => new Savestate(buffer).validateChunk(0)).toThrow();
        });

        it('throws if magic or ID does not match', () => {
            const savestate = new Savestate(new Uint8Array(128));
            savestate.write16(1);

            const buffer = savestate.getBuffer();
            expect(() => new Savestate(buffer).validateChunk(0)).toThrow();
        });
    });

    describe('write16', () => {
        it('writes a single word', () => {
            const savestate = new Savestate(new Uint8Array(128));

            savestate.write16(0x12ab);
            expect(savestate.getBuffer().length).toBe(2);
        });

        it('throws if the capacity is exceeded', () => {
            const savestate = new Savestate(new Uint8Array(2));

            savestate.write16(0);

            expect(() => savestate.write16(0)).toThrow();
        });
    });

    describe('read16', () => {
        it('reads back a single word', () => {
            const savestate = new Savestate(new Uint8Array(128));

            savestate.write16(0x12ab);

            const buffer = savestate.getBuffer();
            expect(new Savestate(buffer).read16()).toBe(0x12ab);
        });

        it('throws if the capacity is exceeded', () => {
            const savestate = new Savestate(new Uint8Array(2));

            savestate.read16();

            expect(() => savestate.read16()).toThrow();
        });
    });

    describe('write32', () => {
        it('writes two words', () => {
            const savestate = new Savestate(new Uint8Array(128));

            savestate.write32(0x12345678);
            expect(savestate.getBuffer().length).toBe(4);
        });

        it('throws if the capacity is exceeded', () => {
            const savestate = new Savestate(new Uint8Array(6));

            savestate.write32(0);

            expect(() => savestate.write32(0)).toThrow();
        });
    });

    describe('read32', () => {
        it('reads back 32bit', () => {
            const savestate = new Savestate(new Uint8Array(128));

            savestate.write32(0x12345678);

            const buffer = savestate.getBuffer();
            expect(new Savestate(buffer).read32()).toBe(0x12345678);
        });

        it('throws if the capacity is exceeded', () => {
            const savestate = new Savestate(new Uint8Array(6));

            savestate.read32();

            expect(() => savestate.read32()).toThrow();
        });
    });

    describe('writeBool', () => {
        it('writes a single word', () => {
            const savestate = new Savestate(new Uint8Array(128));

            savestate.writeBool(true);
            expect(savestate.getBuffer().length).toBe(2);
        });

        it('throws if the capacity is exceeded', () => {
            const savestate = new Savestate(new Uint8Array(2));

            savestate.writeBool(true);

            expect(() => savestate.writeBool(true)).toThrow();
        });
    });

    describe('readBool', () => {
        it('reads back a boolean', () => {
            const savestate = new Savestate(new Uint8Array(128));

            savestate.writeBool(true);
            savestate.writeBool(false);

            const buffer = savestate.getBuffer();
            const savestateLoaded = new Savestate(buffer);

            expect(savestateLoaded.readBool()).toBe(true);
            expect(savestateLoaded.readBool()).toBe(false);
        });

        it('throws if the capacity is exceeded', () => {
            const savestate = new Savestate(new Uint8Array(2));

            savestate.readBool();

            expect(() => savestate.readBool()).toThrow();
        });
    });

    describe('writeBuffer', () => {
        it('uses a multiple of two bytes', () => {
            const savestate = new Savestate(new Uint8Array(128));

            savestate.writeBuffer(new Uint8Array(4));
            expect(savestate.getBuffer().length).toBe(4);

            savestate.writeBuffer(new Uint8Array(5));
            expect(savestate.getBuffer().length).toBe(10);
        });

        it('throws if the capcity is exceeded', () => {
            const savestate = new Savestate(new Uint8Array(2));

            expect(() => savestate.writeBuffer(new Uint8Array(3))).toThrow();
        });
    });

    describe('readBuffer', () => {
        it('reads back a buffer', () => {
            const savestate = new Savestate(new Uint8Array(128));
            const fixture = new Uint8Array([1, 3, 2]);

            savestate.writeBuffer(fixture);

            const buffer = savestate.getBuffer();
            expect(new Savestate(buffer).readBuffer(fixture.length)).toStrictEqual(fixture);
        });

        it('throws if the capacity is exceeded', () => {
            const savestate = new Savestate(new Uint8Array(4));

            expect(() => savestate.readBuffer(5)).toThrow();
        });
    });
});
