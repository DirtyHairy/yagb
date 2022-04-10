import 'jquery.terminal';
import 'jquery.terminal/css/jquery.terminal.min.css';

import { decodeBase64, encodeBase64 } from './helper/base64';
import { hex16, hex8 } from './helper/format';

import $ from 'jquery';
import { Emulator } from './emulator/emulator';
import { FileHandler } from './helper/fileHandler';

const CARTRIDGE_FILE_SIZE_LIMIT = 512 * 1024 * 1024;
const STORAGE_KEY_YAGB_CARTERIDGE_DATA = 'yagb-cartridge-data';
const STORAGE_KEY_YAGB_CARTERIDGE_NAME = 'yagb-cartridge-name';

const fileHandler = new FileHandler();
let emulator: Emulator;

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

function loadCartridge(data: Uint8Array, name: string) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        emulator = new Emulator(data, print);
        print(`loaded cartridge image: ${name}`);
    } catch (e) {
        print((e as Error).message);
        print('failed to initialize emulator');
    }
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
context                                 Show context summary (trace + disassembly + state)`);
    },
    load(): void {
        fileHandler.openFile(async (data, name) => {
            if (data.length > CARTRIDGE_FILE_SIZE_LIMIT) {
                print(`${name} is not a cartridge image`);
            }

            localStorage.setItem(STORAGE_KEY_YAGB_CARTERIDGE_DATA, await encodeBase64(data));
            localStorage.setItem(STORAGE_KEY_YAGB_CARTERIDGE_NAME, name);

            loadCartridge(data, name);
        });
    },
    disassemble(count?: string, address?: string): void {
        if (!assertEmulator()) return;

        print(emulator.disassemble(uintval(count, 10), uintval(address)).join('\n'));
    },
    step(count?: string): void {
        if (!assertEmulator()) return;

        const [isBreak, cycles] = emulator.step(uintval(count, 1));

        if (!isBreak) print(emulator.lastBreakMessage());
        print(`done in ${cycles} cycles\n`);

        print(emulator.disassemble(1).join('\n'));
    },
    state(): void {
        if (!assertEmulator()) return;

        print(emulator.printState());
    },
    reset(): void {
        if (!assertEmulator()) return;

        emulator.reset();
        print('system reset');
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

        emulator.clearTrap(addressInt);
    },
    'trap-clear-all': function () {
        if (!assertEmulator()) return;

        emulator.clearTraps();
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
};

const terminal = $('#terminal').terminal(interpreter as JQueryTerminal.Interpreter, {
    greetings: " ___\n|[_]|\n|+ ;|\n`---'\n",
    completion: true,
    exit: false,
    onInit: () => void onInit(),
    prompt: '\n> ',
    checkArity: false,
});
