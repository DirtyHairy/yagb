export class SampleQueue {
    constructor(capacity) {
        this.capacity = capacity;

        this.channelLeftData = new Float32Array(this.capacity);
        this.channelRightData = new Float32Array(this.capacity);

        this.length = 0;
        this.nextSample = 0;
    }

    push(left, right) {
        this.channelLeftData[this.nextSample] = left;
        this.channelRightData[this.nextSample] = right;

        if (this.length < this.capacity) {
            this.length++;
        }

        this.nextSample = (this.nextSample + 1) % this.capacity;
    }

    fill(channelLeft, channelRight) {
        const length = channelLeft.length;
        if (length !== channelRight.length) return;

        let iIn = (this.nextSample - this.length + this.capacity) % this.capacity;

        for (let iOut = 0; iOut < length && this.length > 0; iOut++) {
            if (this.length > 0) {
                channelLeft[iOut] = this.channelLeftData[iIn];
                channelRight[iOut] = this.channelRightData[iIn];

                iIn = (iIn + 1) % this.capacity;
                this.length--;
            }
        }
    }
}

class SourceProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();

        this.sampleRate = options.processorOptions.sampleRate;
        this.prebuffer = options.processorOptions.prebuffer;
        this.queue = new SampleQueue(2 * this.prebuffer + 256);

        this.lastSampleLeft = this.lastSampleRight = 0;

        this.port.onmessage = (e) => {
            const payload = e.data;

            for (let i = 0; i < payload.length; i++) this.queue.push(payload.left[i], payload.right[i]);

            this.port.postMessage(payload, [payload.left.buffer, payload.right.buffer]);
        };
    }

    process(_, outputs) {
        if (outputs.length !== 1 || outputs[0].length !== 2) return true;

        if (this.queue.length < this.prebuffer + outputs[0][0].length) {
            outputs[0][0].fill(this.lastSampleLeft);
            outputs[0][1].fill(this.lastSampleRight);

            return true;
        }

        this.queue.fill(outputs[0][0], outputs[0][1]);

        this.lastSampleLeft = outputs[0][1][outputs[0][1].length - 1];
        this.lastSampleRight = outputs[0][1][outputs[0][1].length - 1];

        return true;
    }
}

registerProcessor('source-processor', SourceProcessor);
