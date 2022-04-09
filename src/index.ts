import 'jquery.terminal';
import 'jquery.terminal/css/jquery.terminal.min.css';

import { decodeBase64, encodeBase64 } from './helper/base64';

import $ from 'jquery';
import { Emulator } from './emulator/emulator';
import { FileHandler } from './helper/fileHandler';
import { hex16 } from './helper/format';

const CARTRIDGE_FILE_SIZE_LIMIT = 512 * 1024 * 1024;
const STORAGE_KEY_YAGB_CARTERIDGE_DATA = 'yagb-cartridge-data';
const STORAGE_KEY_YAGB_CARTERIDGE_NAME = 'yagb-cartridge-name';

const fileHandler = new FileHandler();
let emulator: Emulator;

function print(msg: string): void {
    terminal.echo(msg);
}

function intval<T>(value: T): number | undefined;
function intval<T>(value: T, defaultValue: number): number;
function intval<T>(value: T, defaultValue?: number | undefined): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return defaultValue;

    const parsed = value.startsWith('0x') ? parseInt(value.substring(2), 16) : parseInt(value, 10);

    return isNaN(parsed) ? defaultValue : parsed;
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

const terminal = $('#terminal').terminal(
    {
        help(): void {
            print(`Available commands:

help                                    Show help
clear                                   Clear screen
load                                    Load cartridge
disassemble [count=15] [address=p]      Disassemble count bytes at address
step [count=1]                          Step count instructions
state                                   Print state
reset                                   Reset system
breakpoint-add <address, ...>           Add a breakpoint
breakpoint-clear <address>              Clear a breakpoint
breakpoint-clear-all                    Clear all breakpoints
breakpoint-list                         List breakpoints
trace                                   Prints last 30 executed operations`);
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
        disassemble(count, address): void {
            if (!assertEmulator()) return;

            print(emulator.disassemble(intval(count, 15), intval(address)).join('\n'));
        },
        step(count): void {
            if (!assertEmulator()) return;

            const [isBreak, cycles] = emulator.step(intval(count, 1));

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
        'breakpoint-add': function (...args) {
            if (!assertEmulator()) return;

            if (args.length === 0) {
                args = [emulator.getCpu().state.p];
            }

            args.forEach((address) => {
                const addressInt = intval(address);
                if (addressInt === undefined) {
                    print(`invalid address ${address}`);
                    return;
                }

                emulator.addBreakpoint(addressInt);
            });
        },
        'breakpoint-clear': function (address) {
            if (!assertEmulator()) return;

            const addressInt = intval(address);
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
        trace(): void {
            if (!assertEmulator()) return;

            const traces = emulator.getTraces()

            print(traces.length === 0 ? 'no trace entries' : traces.map((x) => x.print()).join('\n'));
        }
    },
    {
        greetings: " ___\n|[_]|\n|+ ;|\n`---'\n",
        completion: true,
        exit: false,
        onInit: () => void onInit(),
        prompt: '\n> ',
        checkArity: false,
    }
);
