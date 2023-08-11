import 'jquery.terminal';
import 'jquery.terminal/css/jquery.terminal.min.css';

import { Emulator, PreferredModel } from 'yagb-core/src/emulator/emulator';
import { Palette, paletteName } from 'yagb-core/src/emulator/ppu/palette-compat';
import { Scheduler, Statistics } from 'yagb-core/src/emulator/scheduler';
import { hex16, hex8 } from 'yagb-core/src//helper/format';

import $ from 'jquery';
import { AudioDriver } from 'yagb-core/src/emulator/apu/audio-driver';
import { FileHandler } from 'yagb-core/src/helper/fileHandler';
import { GamepadDriver } from './gamepad-driver';
import { Mode } from 'yagb-core/src/emulator/mode';
import { Repository } from './repository';
import { RomSettings } from './repository/romSettings';
import { VideoDriver } from './video-driver';
import { key } from 'yagb-core/src/emulator/joypad';
import md5 from 'md5';
import { ppuFrameOperation } from 'yagb-core/src/emulator/ppu';

const DEFAULT_VOLUME = 0.6;
const CARTRIDGE_FILE_SIZE_LIMIT = 512 * 1024 * 1024;
const KEY_AUDIO_WORKLET = 'audio-worklet';

const fileHandler = new FileHandler();
const audioDriver = new AudioDriver(localStorage.getItem(KEY_AUDIO_WORKLET) === '1');
const videoDriver = new VideoDriver(document.getElementById('canvas') as HTMLCanvasElement, 160, 144);
const gamepadDriver = new GamepadDriver();

const repository = new Repository();

let emulator: Emulator | undefined;
let scheduler: Scheduler;
let stateOnStep = false;
let lastFrame = -1;
let romHash = '';
let cartName = '';
let preferredModel: PreferredModel = PreferredModel.auto;
const shiftKeys = new Set<string>();

function print(msg: string): void {
    terminal.echo(msg);
}

function uintval<T>(value: T): number | undefined;
function uintval<T>(value: T, defaultValue: number): number;
function uintval<T>(value: T, defaultValue?: number | undefined): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return defaultValue;

    const parsed = value.startsWith('0x') ? parseInt(value.substring(2), 16) : parseInt(value, 10);

    return isNaN(parsed) || parsed < 0 ? defaultValue : parsed;
}

function floatval<T>(value: T): number | undefined;
function floatval<T>(value: T, defaultValue: number): number;
function floatval<T>(value: T, defaultValue?: number | undefined): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return defaultValue;

    const parsed = parseFloat(value);

    return isNaN(parsed) || parsed < 0 ? defaultValue : parsed;
}

async function reloadCartridge() {
    if (emulator) await loadCartridge(emulator.getCartridgeImage(), cartName);
}

async function loadCartridge(data: Uint8Array, name: string) {
    const autostart = !!scheduler?.isRunning();

    audioDriver.stop();
    scheduler?.stop();

    const oldHash = romHash;
    romHash = md5(data);

    if (oldHash && oldHash !== romHash && emulator) {
        await repository.removeSavestate(romHash);
    }

    const settings = await repository.getRomSettings(romHash);
    const savedRam = await repository.getNvsData(romHash);

    if (settings?.preferredModel !== undefined) {
        print(`preferred GameBoy model (ROM): ${settings.preferredModel}`);
    }

    try {
        emulator = new Emulator(data, settings?.preferredModel ?? preferredModel, print, savedRam);
    } catch (e) {
        print((e as Error).message);
        print('failed to initialize emulator');
        emulator = undefined;

        return;
    }

    cartName = name;
    const savestate = await repository.getSavestate(romHash, emulator.getMode());

    try {
        if (savestate) emulator.load(savestate);
    } catch (e) {
        console.error(e);
        print('failed to load savestate');
    }

    scheduler = new Scheduler(emulator);
    scheduler.onBeforeTimeslice.addHandler(() => emulator && gamepadDriver.update());
    scheduler.onTimesliceComplete.addHandler(() => videoDriver.render());
    scheduler.onEmitStatistics.addHandler(onStatistics(romHash));
    scheduler.onStart.addHandler(() => audioDriver.continue());
    scheduler.onStop.addHandler(() => audioDriver.pause());

    emulator.onTrap.addHandler((msg) => {
        if (scheduler.isRunning()) print(`Encountered trap: ${msg}. Stopping emulator.`);
        updatePrompt(undefined, undefined, false);
    });

    emulator.newFrameEvent.addHandler((operation) =>
        operation === ppuFrameOperation.blend ? videoDriver.addFrameWithBlending(emulator!.getFrameData()) : videoDriver.addFrame(emulator!.getFrameData())
    );
    videoDriver.addFrame(emulator.getFrameData());
    videoDriver.render();

    print(`loaded cartridge image: ${name}`);
    print(emulator.printCartridgeInfo());
    print(`running as ${emulator.getMode() === Mode.dmg ? 'DMG' : 'CGB'}`);

    audioDriver.start(emulator.startAudio(audioDriver.getSampleRate()));
    if (autostart) scheduler.start();
    else print('\nPress shift-enter or type "run" to start emulator.');

    updatePrompt();

    terminal.disable();
    setTimeout(() => document.getElementById('canvas')?.focus(), 10);
}

const onStatistics =
    (romHash: string) =>
    ({ hostSpeed, speed }: Statistics) => {
        if (!emulator) return;

        updatePrompt(speed, hostSpeed);

        if (repository.saveStateMutex.isLocked()) return;

        const ram = emulator.getNvData();
        const savestate = emulator.save();

        repository.saveState(romHash, savestate.getBuffer(), ram, emulator.getMode());
    };

async function onInit(): Promise<void> {
    await Promise.resolve();
    repository.onError.addHandler((msg) => print(`[[;red;]ERROR: ${msg}]`));

    if (localStorage.getItem(KEY_AUDIO_WORKLET) !== '1') {
        print('Audio uses the scriptprocessor driver.');
        print("If you experience jitter or random pops and clicks,\ntry switching to the worklet driver with 'audio-worklet 1'\n");
    } else {
        print('Audio uses the audio worklet driver.');
        print("If you experience jitter or random pops and clicks,\ntry switching to the scriptprocessor driver with 'audio-worklet 0'\n");
    }

    print("Type 'help' in order to show all commands.\n");

    const lastRom = await repository.getLastRom();

    if (!lastRom) {
        print('Type "load" in order to load a cartridge image.');
        return;
    }

    const mergeFrames = await repository.getMergeFrames();
    videoDriver.setMergeFrames(mergeFrames);
    print(`merge frames: ${mergeFrames ? 'enabled' : 'disabled'}`);

    preferredModel = (await repository.getPreferredModel()) ?? PreferredModel.auto;
    print(`preferred GameBoy model (global): ${preferredModel}`);

    try {
        loadCartridge(lastRom.data, lastRom.name);
    } catch (e) {
        print('failed to load cartridge data');
        console.error(e);
    }

    window.addEventListener('gamepadconnected', () => print('gamepad connected'));
    window.addEventListener('gamepaddisconnected', () => print('gamepad disconnected'));
}

function assertEmulator(emulator: Emulator | undefined): emulator is Emulator {
    if (!emulator) {
        print('emulator not initialized');
        return false;
    }

    return true;
}

function getKey(code: string): key | undefined {
    switch (code) {
        case 'Enter':
            return key.start;

        case ' ':
            return key.select;

        case 's':
        case 'x':
            return key.a;

        case 'a':
        case 'y':
        case 'z':
            return key.b;

        case 'ArrowLeft':
            return key.left;

        case 'ArrowRight':
            return key.right;

        case 'ArrowUp':
            return key.up;

        case 'ArrowDown':
            return key.down;

        default:
            return undefined;
    }
}

function updatePrompt(speed?: number, hostSpeed?: number, isRunning = !!scheduler?.isRunning()) {
    terminal.set_prompt(
        `${isRunning ? 'running' : 'stopped'}${speed !== undefined && isRunning ? ' gb@' + speed.toFixed(2) + 'x' : ''}${
            hostSpeed !== undefined && isRunning ? ' host@' + hostSpeed.toFixed(2) + 'x' : ''
        } > `
    );
}

async function completion(this: JQueryTerminal): Promise<Array<string>> {
    switch (terminal.get_command().split(' ')[0]) {
        case 'snapshot-save':
        case 'snapshot-load':
        case 'snapshot-delete':
            return (await repository.listSnapshots(romHash)) || [];
            break;

        default:
            return Object.keys(interpreter);
    }
}

const interpreter = {
    help(): void {
        print(`Available commands:

help                                    Show help
clear                                   Clear screen
load                                    Load cartridge
run                                     Run the emulator continuosly
stop                                    Stop the emulator
speed <speed>                           Set emulator speed
reset                                   Reset system
preferred-model-global <auto|dmg|cgb>   Change preferred GameBoy model (global value)
preferred-model <auto|dmg|cgb|default>  Change preferred GameBoy model per ROM
palette <0-11 | default>                Switch palette (DMG games on CGB only)
wipe                                    Reset and remove nonvolatile data
volume [volume0]                        Get or set volume (range 0 - 100)
snapshot-save <name>                    Save a snapshot
snapshot-load <name>                    Restore a snapshot
snapshot-delete <name>                  Delete a snapshot
snapshot-list                           List snapshots
merge-frames [1|0]                      Merge consecutive frames to reduce flicker
audio-worklet [1|0]                     Use scriptprocessor even if audio worklet is available.
                                        May reduce jitter for high sample rates.

disassemble [count] [address=p]         Disassemble count bytes at address
step [count=1]                          Step count instructions
state                                   Print state
breakpoint-add [address, ...]           Add a breakpoint
breakpoint-clear <address>              Clear a breakpoint
breakpoint-clear-all                    Clear all breakpoints
breakpoint-list                         List breakpoints
scanline-trap-add [line, ...]           Add a scanline trap
scanline-trap-clear <line>              Clear a scanline trap
scanline-trap-clear-all                 Clear all scanline traps
scanline-trap-list                      List scanline traps
trap-read-add <address, ...>            Add a read trap
trap-write-add <address, ...>           Add a write trap
trap-clear <address>                    Remove traps at address
trap-clear-all                          Remove all traps
trap-list                               List traps
trace [count]                           Prints trace
dump address [count=16]                 Dump bus
context                                 Show context summary (trace + disassembly + state)
state-on-step [0|1]                     Print state on every step

Keyboard controls (click the canvas to give it focus):

* arrows: d-pad, a/y/z: B, s/x: A, space: select, enter: start
* shift-enter: run / stop
* +/-: adjust volume
* Page up / down: adjust speed
* l: load cartridge
* shift-space: reset
* hold down shift to switch palettes for DMG games running in CGB
  mode with d-pad and A/B combos. Shift-d switches to the default
  palette.
`);
    },
    load(): void {
        fileHandler.openFile(async (data, name) => {
            if (data.length > CARTRIDGE_FILE_SIZE_LIMIT) {
                print(`${name} is not a cartridge image`);
            }

            await repository.setLastRom({ name, data });

            loadCartridge(data, name);
        }, '.gb,.gbc');
    },
    disassemble(count?: string, address?: string): void {
        if (!assertEmulator(emulator)) return;

        print(emulator.disassemble(uintval(count, 10), uintval(address)).join('\n'));
    },
    step(count?: string): void {
        if (!assertEmulator(emulator)) return;

        const cycles = emulator.step(uintval(count, 1));
        videoDriver.render();

        if (emulator.isTrap()) print(emulator.lastTrapMessage());
        print(`done in ${cycles} cycles\n`);

        if (stateOnStep) {
            interpreter.state();
            print('\n');
        }

        print(' > ' + emulator.disassemble(1).join('\n').replace(/^\s+/, ''));
    },
    state(): void {
        if (!assertEmulator(emulator)) return;

        print(emulator.printState());
    },
    reset(): void {
        if (!assertEmulator(emulator)) return;

        emulator.reset();
        lastFrame = -1;
        videoDriver.render();
        print('system reset');
    },
    wipe(): void {
        if (!assertEmulator(emulator)) return;

        emulator.reset();
        emulator.clearCartridgeRam();
        lastFrame = -1;
        videoDriver.render();
        print('system reset, nonvolatile data wiped');
    },
    'breakpoint-add': function (...args: Array<string | number | undefined>) {
        if (!assertEmulator(emulator)) return;

        if (args.length === 0) {
            args = [emulator.getCpu().state.p];
        }

        args.forEach((address) => {
            if (!emulator) return;

            const addressInt = uintval(address);
            if (addressInt === undefined) {
                print(`invalid address ${address}`);
                return;
            }

            emulator.addBreakpoint(addressInt);
        });
    },
    'breakpoint-clear': function (address?: string) {
        if (!assertEmulator(emulator)) return;

        const addressInt = uintval(address);
        if (addressInt === undefined) {
            print('invalid address');
            return;
        }

        emulator.clearBreakpoint(addressInt);
    },
    'breakpoint-clear-all': function () {
        if (!assertEmulator(emulator)) return;

        emulator.clearBreakpoints();
    },
    'breakpoint-list': function () {
        if (!assertEmulator(emulator)) return;

        const breakpoints = emulator.getBreakpoints();

        print(breakpoints.length === 0 ? 'no breakpoints' : breakpoints.map((x) => `* ${hex16(x)}`).join('\n'));
    },
    'scanline-trap-add': function (...args: Array<string | number | undefined>) {
        if (!assertEmulator(emulator)) return;

        if (args.length === 0) {
            args = [emulator.getScanline()];
        }

        args.forEach((scanline) => {
            if (!emulator) return;

            const scanlineInt = uintval(scanline);
            if (scanlineInt === undefined) {
                print(`invalid scanline ${scanline}`);
                return;
            }

            emulator.addScanlineTrap(scanlineInt);
        });
    },
    'scanline-trap-clear': function (address?: string) {
        if (!assertEmulator(emulator)) return;

        const scanline = uintval(address);
        if (scanline === undefined) {
            print('invalid scanline');
            return;
        }

        emulator.clearScanlineTrap(scanline);
    },
    'scanline-trap-clear-all': function () {
        if (!assertEmulator(emulator)) return;

        emulator.clearScahnlineTraps();
    },
    'scanline-trap-list': function () {
        if (!assertEmulator(emulator)) return;

        const scanlines = emulator.getScanlineTraps();

        print(scanlines.length === 0 ? 'no scanline traps' : scanlines.join('\n'));
    },
    'trap-read-add': function (...args: Array<string | number | undefined>) {
        if (!assertEmulator(emulator)) return;
        if (args.length === 0) {
            print('no trap address given');
            return;
        }

        args.forEach((address) => {
            if (!emulator) return;

            const addressInt = uintval(address);
            if (addressInt === undefined) {
                print(`invalid address ${address}`);
                return;
            }

            emulator.addTrapRead(addressInt);
        });
    },
    'trap-write-add': function (...args: Array<string | number | undefined>) {
        if (!assertEmulator(emulator)) return;

        if (args.length === 0) {
            print('no trap address given');
            return;
        }

        args.forEach((address) => {
            if (!emulator) return;

            const addressInt = uintval(address);
            if (addressInt === undefined) {
                print(`invalid address ${address}`);
                return;
            }

            emulator.addTrapWrite(addressInt);
        });
    },
    'trap-clear': function (address?: string) {
        if (!assertEmulator(emulator)) return;

        const addressInt = uintval(address);
        if (addressInt === undefined) {
            print('invalid address');
            return;
        }

        emulator.clearRWTrap(addressInt);
    },
    'trap-clear-all': function () {
        if (!assertEmulator(emulator)) return;

        emulator.clearRWTraps();
    },

    'trap-list': function () {
        if (!assertEmulator(emulator)) return;

        print(
            emulator
                .getTraps()
                .map(({ address, trapRead, trapWrite }) => ` * ${hex16(address)} [${trapRead ? 'R' : ''}${trapWrite ? 'W' : ''}]`)
                .join('\n')
        );
    },
    trace(count?: string): void {
        if (!assertEmulator(emulator)) return;

        print(emulator.getTrace(uintval(count, 10)));
    },
    dump(address?: string, count?: string): void {
        if (!assertEmulator(emulator)) return;

        const addr = uintval(address);
        if (addr === undefined) {
            print('invalid address');
            return;
        }

        const cnt = uintval(count, 16);
        const bus = emulator.getBus();

        for (let i = 0; i < cnt; i++) {
            const a = (addr + i) & 0xffff;

            print(`${hex16(a)}: ${hex8(bus.read(a))}`);
        }
    },
    context(): void {
        interpreter.trace('5');
        print('---');
        interpreter.disassemble('5', undefined);
        print('');
        interpreter.state();
    },
    'state-on-step': function (toggle: string) {
        const parsed = uintval(toggle);
        if ([0, 1].includes(parsed as number)) stateOnStep = !!parsed;

        print(stateOnStep ? 'printing state on every step' : 'not printing state on every step');
    },
    run() {
        if (scheduler.isRunning()) {
            print('emulator already running');
            return;
        }

        scheduler.start();
        print('emulator running');

        updatePrompt();
    },
    stop() {
        if (!scheduler.isRunning()) {
            print('emulator already stopped');
            return;
        }

        scheduler.stop();
        print('emulator stopped');

        updatePrompt();
    },
    speed(speed: string) {
        const parsed = floatval(speed);
        if (parsed !== undefined && parsed > 0) {
            scheduler.setSpeed(parsed);
        }

        print(`speed: ${scheduler.getSpeed().toFixed(2)}`);
    },
    volume(volume: string) {
        const parsed = uintval(volume);
        if (parsed !== undefined) {
            const value = Math.max(Math.min(parsed, 100), 0) / 100;

            audioDriver.setVolume(value);
            repository.setVolume(value);
        }

        print(`volume: ${Math.floor(audioDriver.getVolume() * 100)}`);
    },
    'snapshot-save': async function (name: string): Promise<string> {
        if (!assertEmulator(emulator)) return '';

        if (name === undefined) {
            return 'please supply a name';
        }

        try {
            await repository.saveSnapshot(romHash, name, emulator.save().getBuffer().slice());
            return 'snapshot saved';
        } catch (e) {
            console.error(e);

            return 'snapshot failed';
        }
    },
    'snapshot-load': async function (name: string): Promise<string> {
        if (!assertEmulator(emulator)) return '';

        if (name === undefined) {
            return 'please supply a name';
        }

        const snapshotData = await repository.getSnapshot(romHash, name);

        if (!snapshotData) {
            return 'no such snapshot';
        }

        try {
            emulator.load(snapshotData);
            return 'snapshot restored';
        } catch (e) {
            console.error(e);

            return 'restore failed';
        }
    },
    'snapshot-list': function () {
        repository.listSnapshots(romHash).then((snapshots) => snapshots.forEach(print));
    },
    'snapshot-delete': function (name: string): void {
        if (!assertEmulator(emulator)) return;

        if (!name) {
            print('please supply a name');
            return;
        }

        repository.deleteSnapshot(romHash, name);
    },
    'audio-worklet': function (toggle: string | number) {
        switch (toggle) {
            case '1':
            case '0':
            case 1:
            case 0:
                localStorage.setItem(KEY_AUDIO_WORKLET, toggle + '');
                print('Changed audio driver. Please reload for the change to take effect.');
                break;

            case undefined:
                break;

            default:
                print('invalid setting');
        }

        if (localStorage.getItem(KEY_AUDIO_WORKLET) === '1') {
            print('using worklet audio driver');
        } else {
            print('using script processor audio driver');
        }
    },
    'preferred-model-global': async function (value?: string): Promise<string> {
        switch (value) {
            case PreferredModel.auto:
            case PreferredModel.cgb:
            case PreferredModel.dmg:
                print(`preferred GameBoy model (global): ${value}`);
                if (value === preferredModel) return '';

                preferredModel = value;
                await repository.setPreferredModel(value);

                reloadCartridge();
                break;

            case undefined:
                print(`preferred GameBoy model (global): ${preferredModel}`);
                break;

            default:
                print(`invalid value: ${value}. Valid values are: auto, cgb, dmg`);
                break;
        }

        return '';
    },
    'preferred-model': async function (value?: string): Promise<string> {
        if (!romHash) {
            print('no ROM loaded');
            return '';
        }

        const settings: RomSettings = (await repository.getRomSettings(romHash)) || { rom: romHash };

        switch (value) {
            case PreferredModel.auto:
            case PreferredModel.cgb:
            case PreferredModel.dmg:
            case 'default': {
                const preferredModelCurrent = settings?.preferredModel;
                const preferredModel = value === 'default' ? undefined : value;

                print(`preferred GameBoy model (ROM): ${value ?? 'default'}`);

                if (preferredModel === preferredModelCurrent) return '';
                await repository.saveRomSettings({ ...settings, preferredModel });

                reloadCartridge();

                break;
            }

            case undefined:
                print(`preferred model GameBox (ROM): ${settings?.preferredModel ?? 'default'}`);
                break;

            default:
                print(`invalid value: ${value}. Valid values are: auto, cgb, dmg, default`);
                break;
        }

        return '';
    },
    palette: function (value?: string | number) {
        if (!emulator) return;

        if (emulator?.getMode() !== Mode.cgbcompat) {
            print('Not applicable for this ROM and device');
            return;
        }

        if (typeof value === 'string' && value === 'default') {
            emulator.setPalette(Palette.default);
        } else if (typeof value === 'number' && value >= 0 && value < 12) {
            emulator.setPalette(value);
        } else if (value !== undefined) {
            print(`Invalid palette '${value}'. Valid values are 0-11 and default.`);
            return;
        }

        print(`using palette: ${paletteName(emulator.getPalette())}`);
    },
    'merge-frames': async function (toggle: string | number): Promise<string> {
        let mergeFrames = await repository.getMergeFrames();

        switch (toggle) {
            case '1':
            case 1:
                mergeFrames = true;
                break;

            case '0':
            case 0:
                mergeFrames = false;
                break;

            case undefined:
                break;

            default:
                print('invalid setting');
        }

        videoDriver.setMergeFrames(mergeFrames);
        print(`merge frames: ${mergeFrames ? 'enabled' : 'disabled'}`);

        return '';
    },
};

const terminal = $('#terminal').terminal(interpreter as JQueryTerminal.Interpreter, {
    greetings: " ___\n|[_]|\n|+ ;|\n`---'\n",
    completion,
    exit: false,
    onInit: () => void onInit(),
    checkArity: false,
});

updatePrompt();

const canvas = document.getElementById('canvas') as HTMLCanvasElement;

function keyboardAction(e: KeyboardEvent): boolean {
    switch (e.key) {
        case 'Enter':
            if (!e.shiftKey || !scheduler) return false;

            scheduler.isRunning() ? interpreter.stop() : interpreter.run();
            return true;

        case '+': {
            const volume = audioDriver.getVolume();
            interpreter.volume('' + Math.min((Math.floor(volume * 10) + 1) * 10, 100));

            return true;
        }
        case '-': {
            const volume = audioDriver.getVolume();
            interpreter.volume('' + Math.max((Math.floor(volume * 10) - 1) * 10, 0));

            return true;
        }
        case 'PageUp':
            if (!scheduler) return false;
            interpreter.speed('' + (Math.floor(scheduler.getSpeed() / 2.5) + 1) * 2.5);

            return true;

        case 'PageDown':
            if (!scheduler) return false;
            interpreter.speed('' + Math.max((Math.floor(scheduler.getSpeed() / 2.5) - 1) * 2.5, 1));

            return true;

        case ' ':
            if (!e.shiftKey) return false;
            interpreter.reset();

            return true;

        case 'l':
            interpreter.load();
            return true;
    }

    return false;
}

function handleShiftKey(code: string): void {
    if (emulator?.getMode() !== Mode.cgbcompat) return;

    if (shiftKeys.size === 1 && (shiftKeys.has('S') || shiftKeys.has('X'))) {
        switch (code) {
            case 'ArrowRight':
                interpreter.palette(Palette.a_right);
                return;

            case 'ArrowLeft':
                interpreter.palette(Palette.a_left);
                return;

            case 'ArrowUp':
                interpreter.palette(Palette.a_up);
                return;

            case 'ArrowDown':
                interpreter.palette(Palette.a_down);
                return;
        }
    }

    if (shiftKeys.size === 1 && (shiftKeys.has('A') || shiftKeys.has('Y') || shiftKeys.has('Z'))) {
        switch (code) {
            case 'ArrowRight':
                interpreter.palette(Palette.b_right);
                return;

            case 'ArrowLeft':
                interpreter.palette(Palette.b_left);
                return;

            case 'ArrowUp':
                interpreter.palette(Palette.b_up);
                return;

            case 'ArrowDown':
                interpreter.palette(Palette.b_down);
                return;
        }
    }

    if (shiftKeys.size === 0) {
        switch (code) {
            case 'ArrowRight':
                interpreter.palette(Palette.right);
                return;

            case 'ArrowLeft':
                interpreter.palette(Palette.left);
                return;

            case 'ArrowUp':
                interpreter.palette(Palette.up);
                return;

            case 'ArrowDown':
                interpreter.palette(Palette.down);
                return;

            case 'D':
                interpreter.palette('default');
                return;
        }
    }
}

canvas.addEventListener('keydown', (e) => {
    if (e.repeat) return;

    if (e.shiftKey && e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Shift') {
        handleShiftKey(e.key);
        shiftKeys.add(e.key);

        return;
    }

    if (keyboardAction(e)) {
        e.preventDefault();
        return;
    }

    const key = getKey(e.key);

    if (key !== undefined && emulator !== undefined) {
        emulator.keyDown(key);
        e.preventDefault();
    }
});

canvas.addEventListener('keyup', (e) => {
    if (shiftKeys.has(e.key)) {
        shiftKeys.delete(e.key);
        return;
    }

    const key = getKey(e.key);

    if (key !== undefined && emulator !== undefined) {
        emulator.keyUp(key);
        e.preventDefault();
    }
});

canvas.addEventListener('blur', () => emulator?.clearKeys());

repository.getVolume().then((volume) => audioDriver.setVolume(volume ?? DEFAULT_VOLUME));

gamepadDriver.onKeyDown.addHandler((key) => emulator && emulator.keyDown(key));
gamepadDriver.onKeyUp.addHandler((key) => emulator && emulator.keyUp(key));
