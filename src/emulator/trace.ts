export class Trace {
    constructor(private size = 30) {
        this.entries = new Uint16Array(size);
    }

    add(address: number): void {
        this.entries[this.nextEntry] = address;
        if (this.length < this.size) {
            this.length++;
        }

        this.nextEntry = (this.nextEntry + 1) % this.size;
    }

    getTrace(): Array<number> {
        return new Array(this.length).fill(0).map((_, i) => this.entries[(this.size + this.nextEntry - this.length + i) % this.size]);
    }

    reset(): void {
        this.length = 0;
        this.nextEntry = 0;
    }

    private entries: Uint16Array;
    private length = 0;
    private nextEntry = 0;
}
