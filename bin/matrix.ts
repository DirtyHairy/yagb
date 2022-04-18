import { Bus } from '../src/emulator/bus';
import { Ram } from '../src/emulator/ram';
import { System } from '../src/emulator/system';
import { disassembleInstruction } from '../src/emulator/instruction';

const PAD = 20;

const newEnvironment = function (): Bus {
    const system = new System((msg) => console.log(msg));
    const bus = new Bus(system);
    const ram = new Ram();

    ram.install(bus);

    for (let i = 0; i < 0x200; i++) {
        if (i > 0xff) {
            bus.write16(0xc000 + i * 4, (0xcb << 8) + i)
        } else {
            bus.write(0xc000 + i * 4, i);
        }
    }

    return bus;
};

const printHeader = function () {
    console.log(`\n      --${'-'.repeat((PAD + 2) * 16)}`);
    process.stdout.write('      | ');
    for (let i = 0; i < 0x10; i++) {
        process.stdout.write(`0x${i.toString(16)}`.padEnd(PAD, ' '));
        process.stdout.write(' |');
    }
    process.stdout.write('\n');
    console.log(`--------${'-'.repeat((PAD + 2) * 16)}`);
};

const printFooter = function () {
    console.log(`--------${'-'.repeat((PAD + 2) * 16)}`);
    console.log();
};

const printTable = function (bus: Bus, offset: number) {
    for (let hi = 0; hi < 0x10; hi++) {
        process.stdout.write(`| 0x${hi.toString(16)} `);
        for (let lo = 0; lo < 0x10; lo++) {
            process.stdout.write('| ');
            process.stdout.write(disassembleInstruction(bus, 0xc000 + offset + 4 * ((hi << 4) | lo)).padEnd(PAD, ' '));
        }
        process.stdout.write(' |\n');
    }
};

const bus = newEnvironment();

console.log();

printHeader();
printTable(bus, 0);
printFooter();

printHeader();
printTable(bus, 1024);
printFooter();

console.log();
