import { Event } from 'microevent.ts';

export class SampleQueue {
    constructor(public readonly sampleRate: number) {
        this.capacity = sampleRate / 5;

        this.channelLeftData = new Float32Array(this.capacity);
        this.channelRightData = new Float32Array(this.capacity);
    }

    reset(): void {
        this.length = 0;
    }

    push(left: number, right: number): void {
        this.channelLeftData[this.nextSample] = left;
        this.channelRightData[this.nextSample] = right;

        if (this.length < this.capacity) {
            this.length++;
        }

        this.nextSample = (this.nextSample + 1) % this.capacity;

        this.onNewSample.dispatch();
    }

    getLength(): number {
        return this.length;
    }

    fill(channelLeft: Float32Array, channelRight: Float32Array): void {
        const length = channelLeft.length;
        if (length !== channelRight.length) return;

        let iIn = (this.nextSample - this.length + this.capacity) % this.capacity;

        for (let iOut = 0; iOut < length && this.length > 0; iOut++) {
            channelLeft[iOut] = this.channelLeftData[iIn];
            channelRight[iOut] = this.channelRightData[iIn];

            iIn = (iIn + 1) % this.capacity;
            this.length--;
        }
    }

    onNewSample = new Event<void>();

    private channelLeftData: Float32Array;
    private channelRightData: Float32Array;

    private length = 0;
    private nextSample = 0;

    private capacity: number;
}
