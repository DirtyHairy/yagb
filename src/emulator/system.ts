import { Event } from 'microevent.ts';

export const enum LogLevel {
    error = 0,
    warning = 1,
    info = 2,
}

export interface SystemInterface {
    log(message: string, level?: number): void;
    error(message: string): void;
    warning(message: string): void;
    info(message: string): void;

    break(message: string): void;
}

export class System implements SystemInterface {
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

    break(message: string): void {
        this.onBreak.dispatch(message);
    }

    readonly onBreak = new Event<string>();

    private logLevel = LogLevel.info;
}
