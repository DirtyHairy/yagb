import 'jquery.terminal';
import 'jquery.terminal/css/jquery.terminal.min.css';

import { decodeBase64, encodeBase64 } from './helper/base64';
import { hex16, hex8 } from './helper/format';

import $ from 'jquery';
import { AudioDriver } from './emulator/apu/audio-driver';
import { Emulator } from './emulator/emulator';
import { FileHandler } from './helper/fileHandler';
import { Scheduler } from './emulator/scheduler';
import { key } from './emulator/joypad';
import md5 from 'md5';

const CARTRIDGE_FILE_SIZE_LIMIT = 512 * 1024 * 1024;
const STORAGE_KEY_YAGB_CARTERIDGE_DATA = 'yagb-cartridge-data';
const STORAGE_KEY_YAGB_CARTERIDGE_NAME = 'yagb-cartridge-name';

const fileHandler = new FileHandler();
const audioDriver = new AudioDriver();

let emulator: Emulator;
let scheduler: Scheduler;
let savedRamKey = '';
let stateOnStep = false;
let lastFrame = -1;

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

async function loadCartridge(data: Uint8Array, name: string) {
    const newSavedRamKey = `ram_${md5(data)}`;

    let savedRam: Uint8Array | undefined;
    try {
        savedRam = await decodeBase64(localStorage.getItem(newSavedRamKey) || '');
        // eslint-disable-next-line no-empty
    } catch (e) {}

    let newEmulator: Emulator;
    try {
        newEmulator = new Emulator(data, print, savedRam);
    } catch (e) {
        print((e as Error).message);
        print('failed to initialize emulator');

        return;
    }

    emulator = newEmulator;
    savedRamKey = newSavedRamKey;

    const autostart = !!scheduler?.isRunning();

    audioDriver.stop();
    scheduler?.stop();
    scheduler = new Scheduler(emulator);

    scheduler.onTimesliceComplete.addHandler(() => updateCanvas());

    scheduler.onEmitStatistics.addHandler(async ({ hostSpeed, speed }) => {
        updatePrompt(speed, hostSpeed);

        const ram = emulator.getCartridgeRam();
        if (ram) localStorage.setItem(savedRamKey, await encodeBase64(ram));
    });

    scheduler.onStart.addHandler(() => audioDriver.continue());
    scheduler.onStop.addHandler(() => audioDriver.pause());

    emulator.onTrap.addHandler((msg) => {
        if (scheduler.isRunning()) print(`Encountered trap: ${msg}. Stopping emulator.`);
        updatePrompt(undefined, undefined, false);
    });

    updateCanvas();
    print(`running cartridge image: ${name}`);
    print(emulator.printCartridgeInfo());

    audioDriver.start(emulator.startAudio(audioDriver.getSampleRate()));
    if (autostart) scheduler.start();
    updatePrompt();
}

async function onInit(): Promise<void> {
    const cartridgeData = localStorage.getItem(STORAGE_KEY_YAGB_CARTERIDGE_DATA);
    const cartridgeName = localStorage.getItem(STORAGE_KEY_YAGB_CARTERIDGE_NAME);

    if (cartridgeData === null || cartridgeName === null) return;

    try {
        loadCartridge(await decodeBase64(cartridgeData), cartridgeName);
    } catch (e) {
        print('failed to load cartridge data');
        console.error(e);
    }
}

function assertEmulator(): boolean {
    if (!emulator) {
        print('emulator not initialized');
        return false;
    }

    return true;
}

function updateCanvas(): void {
    if (!assertEmulator()) return;
    if (emulator.getFrameIndex() === lastFrame) return;

    const canvas: HTMLCanvasElement | null = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');

    if (!ctx) {
        throw new Error('unable to retrieve rendering context');
    }

    const imageData = new ImageData(new Uint8ClampedArray(emulator.getFrameData()), 160, 144);

    ctx.putImageData(imageData, 0, 0);
    lastFrame = emulator.getFrameIndex();
}

function getKey(code: string): key | undefined {
    switch (code) {
        case 'Enter':
            return key.start;

        case ' ':
            return key.select;

        case 's':
            return key.a;

        case 'a':
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
        `\n${isRunning ? 'running' : 'stopped'}${speed !== undefined && isRunning ? ' gb@' + speed.toFixed(2) + 'x' : ''}${
            hostSpeed !== undefined && isRunning ? ' host@' + hostSpeed.toFixed(2) + 'x' : ''
        } > `
    );
}

const interpreter = {
    help(): void {
        print(`Available commands:

help                                    Show help
clear                                   Clear screen
load                                    Load cartridge
disassemble [count] [address=p]         Disassemble count bytes at address
step [count=1]                          Step count instructions
state                                   Print state
reset                                   Reset system
wipe                                    Reset and remove saved RAM state
breakpoint-add [address, ...]           Add a breakpoint
breakpoint-clear <address>              Clear a breakpoint
breakpoint-clear-all                    Clear all breakpoints
breakpoint-list                         List breakpoints
trap-add-read <address, ...>            Add a read trap
trap-add-write <address, ...>           Add a write trap
trep-clear <address>                    Remove traps at address
trap-clear-all                          Remove all traps
trap-list                               List traps
trace [count]                           Prints trace
dump address [count=16]                 Dump bus
context                                 Show context summary (trace + disassembly + state)
state-on-step [0|1]                     Print state on every step
run                                     Run the emulator continuosly
stop                                    Stop the emulator
speed <speed>                           Set emulator speed
volume [volume0]                        Get or set volume (range 0 - 100)

Keyboard controls (canvas needs focus): arrows = joypad, a/s = b/a, space = select, enter = start`);
    },
    load(): void {
        fileHandler.openFile(async (data, name) => {
            if (data.length > CARTRIDGE_FILE_SIZE_LIMIT) {
                print(`${name} is not a cartridge image`);
            }

            localStorage.setItem(STORAGE_KEY_YAGB_CARTERIDGE_DATA, await encodeBase64(data));
            localStorage.setItem(STORAGE_KEY_YAGB_CARTERIDGE_NAME, name);

            loadCartridge(data, name);
        }, '.gb');
    },
    disassemble(count?: string, address?: string): void {
        if (!assertEmulator()) return;

        print(emulator.disassemble(uintval(count, 10), uintval(address)).join('\n'));
    },
    step(count?: string): void {
        if (!assertEmulator()) return;

        const cycles = emulator.step(uintval(count, 1));
        updateCanvas();

        if (emulator.isTrap()) print(emulator.lastTrapMessage());
        print(`done in ${cycles} cycles\n`);

        if (stateOnStep) {
            interpreter.state();
            print('\n');
        }

        print(' > ' + emulator.disassemble(1).join('\n').replace(/^\s+/, ''));
    },
    state(): void {
        if (!assertEmulator()) return;

        print(emulator.printState());
    },
    reset(): void {
        if (!assertEmulator()) return;

        emulator.reset();
        lastFrame = -1;
        updateCanvas();
        print('system reset');
    },
    wipe(): void {
        if (!assertEmulator()) return;

        emulator.reset();
        emulator.clearCartridgeRam();
        lastFrame = -1;
        updateCanvas();
        print('system reset, RAM wiped');
    },
    'breakpoint-add': function (...args: Array<string | number | undefined>) {
        if (!assertEmulator()) return;

        if (args.length === 0) {
            args = [emulator.getCpu().state.p];
        }

        args.forEach((address) => {
            const addressInt = uintval(address);
            if (addressInt === undefined) {
                print(`invalid address ${address}`);
                return;
            }

            emulator.addBreakpoint(addressInt);
        });
    },
    'breakpoint-clear': function (address?: string) {
        if (!assertEmulator()) return;

        const addressInt = uintval(address);
        if (addressInt === undefined) {
            print('invalid address');
            return;
        }

        emulator.clearBreakpoint(addressInt);
    },
    'breakpoint-clear-all': function () {
        if (!assertEmulator()) return;

        emulator.clearBreakpoints();
    },
    'breakpoint-list': function () {
        if (!assertEmulator()) return;

        const breakpoints = emulator.getBreakpoints();

        print(breakpoints.length === 0 ? 'no breakpoints' : breakpoints.map((x) => `* ${hex16(x)}`).join('\n'));
    },
    'trap-read-add': function (...args: Array<string | number | undefined>) {
        if (!assertEmulator()) return;
        if (args.length === 0) {
            print('no trap address given');
            return;
        }

        args.forEach((address) => {
            const addressInt = uintval(address);
            if (addressInt === undefined) {
                print(`invalid address ${address}`);
                return;
            }

            emulator.addTrapRead(addressInt);
        });
    },
    'trap-write-add': function (...args: Array<string | number | undefined>) {
        if (!assertEmulator()) return;
        if (args.length === 0) {
            print('no trap address given');
            return;
        }

        args.forEach((address) => {
            const addressInt = uintval(address);
            if (addressInt === undefined) {
                print(`invalid address ${address}`);
                return;
            }

            emulator.addTrapWrite(addressInt);
        });
    },
    'trap-clear': function (address?: string) {
        if (!assertEmulator()) return;

        const addressInt = uintval(address);
        if (addressInt === undefined) {
            print('invalid address');
            return;
        }

        emulator.clearRWTrap(addressInt);
    },
    'trap-clear-all': function () {
        if (!assertEmulator()) return;

        emulator.clearRWTraps();
    },

    'trap-list': function () {
        if (!assertEmulator()) return;

        print(
            emulator
                .getTraps()
                .map(({ address, trapRead, trapWrite }) => ` * ${hex16(address)} [${trapRead ? 'R' : ''}${trapWrite ? 'W' : ''}]`)
                .join('\n')
        );
    },
    trace(count?: string): void {
        if (!assertEmulator()) return;

        print(emulator.getTrace(uintval(count, 10)));
    },
    dump(address?: string, count?: string): void {
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
        if (parsed === undefined || parsed <= 0) {
            print('invalid speed');
            return;
        }

        scheduler.setSpeed(parsed);
    },
    volume(volume: string) {
        const parsed = uintval(volume);
        if (parsed !== undefined) audioDriver.setVolume(Math.max(Math.min(parsed, 100), 0) / 100);

        print(`volume: ${Math.floor(audioDriver.getVolume() * 100)}`);
    },
};

const terminal = $('#terminal').terminal(interpreter as JQueryTerminal.Interpreter, {
    greetings: " ___\n|[_]|\n|+ ;|\n`---'\n",
    completion: true,
    exit: false,
    onInit: () => void onInit(),
    checkArity: false,
});

updatePrompt();

const canvas = document.getElementById('canvas') as HTMLCanvasElement;

canvas.addEventListener('keydown', (e) => {
    const key = getKey(e.key);

    if (key !== undefined && emulator !== undefined) {
        emulator.keyDown(key);
        e.preventDefault();
    }
});

canvas.addEventListener('keyup', (e) => {
    const key = getKey(e.key);

    if (key !== undefined && emulator !== undefined) {
        emulator.keyUp(key);
        e.preventDefault();
    }
});

canvas.addEventListener('blur', () => emulator.clearKeys());
