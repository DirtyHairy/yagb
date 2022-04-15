import { Bus } from './../src/emulator/bus';
import { Ram } from '../src/emulator/ram';
import { System } from './../src/emulator/system';
import { disassembleInstruction } from '../src/emulator/instruction';

const PAD = 20;

const system = new System((msg) => console.log(msg));
const bus = new Bus(system);
const ram = new Ram();

ram.install(bus);

for (let i = 0; i < 0x200; i++) {
    if (i > 0xff) {
        bus.write(0xc000 + i * 4, 0xcb);
        bus.write(0xc000 + i * 4 + 1, i);
    } else {
        bus.write(0xc000 + i * 4, i);
    }
}

console.log('\n\n');

for (let i = 0; i < 0x10; i++) {
    process.stdout.write(`0x${i.toString(16)}`.padEnd(PAD, ' '));
}

console.log();
console.log('-'.repeat(20 * 16));

for (let hi = 0; hi < 0x10; hi++) {
    process.stdout.write(`0x${hi.toString(16)} | `);

    for (let lo = 0; lo < 0x10; lo++) {
        process.stdout.write(disassembleInstruction(bus, 0xc000 + 4 * ((hi << 4) | lo)).padEnd(PAD, ' '));
    }

    process.stdout.write('\n');
}

console.log('\n\n');

for (let i = 0; i < 0x10; i++) {
    process.stdout.write(`0x${i.toString(16)}`.padEnd(PAD, ' '));
}

console.log();
console.log('-'.repeat(20 * 16));

for (let hi = 0; hi < 0x10; hi++) {
    process.stdout.write(`0x${hi.toString(16)} | `);

    for (let lo = 0; lo < 0x10; lo++) {
        process.stdout.write(disassembleInstruction(bus, 0xc000 + 1024 + 4 * ((hi << 4) | lo)).padEnd(PAD, ' '));
    }

    process.stdout.write('\n');
}

console.log('\n\n');
