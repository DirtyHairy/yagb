import $ from 'jquery';
import 'jquery.terminal';
import 'jquery.terminal/css/jquery.terminal.min.css';

$('#terminal').terminal(
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
            this.echo('TODO');
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
    { greetings: " ___\n|[_]|\n|+ ;|\n`---'\n", completion: true }
);
