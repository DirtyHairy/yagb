import 'jquery.terminal';
import 'jquery.terminal/css/jquery.terminal.min.css';

import { decodeBase64, encodeBase64 } from './base64';

import $ from 'jquery';
import { Emulator } from './emulator/emulator';
import { FileHandler } from './fileHandler';

const CARTRIDGE_FILE_SIZE_LIMIT = 512 * 1024 * 1024;
const STORAGE_KEY_YAGB_CARTERIDGE_DATA = 'yagb-cartridge-data';
const STORAGE_KEY_YAGB_CARTERIDGE_NAME = 'yagb-cartridge-name';

const fileHandler = new FileHandler();
let emulator: Emulator;

function print(msg: string): void {
    terminal.echo(msg);
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

const terminal = $('#terminal').terminal(
    {
        help(this: JQueryTerminal): void {
            this.echo(`
help                        Show help
clear                       Clear screen
load                        Load cartridge
disassemble [count=10]      Disassemble next count bytes
step [count=1]              Step count instructions
state                       Print state
            `);
        },
        load(this: JQueryTerminal): void {
            fileHandler.openFile(async (data, name) => {
                if (data.length > CARTRIDGE_FILE_SIZE_LIMIT) {
                    print(`${name} is not a cartridge image`);
                }

                localStorage.setItem(STORAGE_KEY_YAGB_CARTERIDGE_DATA, await encodeBase64(data));
                localStorage.setItem(STORAGE_KEY_YAGB_CARTERIDGE_NAME, name);

                loadCartridge(data, name);
            });
        },
        disassemble(this: JQueryTerminal): void {
            this.echo('TODO');
        },
        step(this: JQueryTerminal): void {
            this.echo('TODO');
        },
        state(this: JQueryTerminal): void {
            this.echo('TODO');
        },
    },
    { greetings: " ___\n|[_]|\n|+ ;|\n`---'\n", completion: true, exit: false, onInit: () => void onInit() }
);
