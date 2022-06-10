import { Event } from 'microevent.ts';

export const enum LogLevel {
    error = 0,
    warning = 1,
    info = 2,
}

export class System {
    constructor(private printCb: (message: string) => void) {}

    log(message: string, level = LogLevel.info): void {
        if (level > this.logLevel) return;

        this.printCb(message);
    }

    error(message: string): void {
        this.log(message, LogLevel.error);
    }

    warning(message: string): void {
        this.log(message, LogLevel.warning);
    }

    info(message: string): void {
        this.log(message, LogLevel.info);
    }

    trap(message: string): void {
        this.isTrap = true;
        this.breakMessage = message;

        this.onTrap.dispatch(message);
    }

    getTrapMessage(): string {
        return this.breakMessage;
    }

    clearTrap(): void {
        this.isTrap = false;
    }

    readonly onTrap = new Event<string>();
    isTrap = false;

    private breakMessage = '';

    private logLevel = LogLevel.info;
}
