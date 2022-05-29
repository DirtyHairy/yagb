import { Mutex } from 'async-mutex';
import { SampleQueue } from './sample-queue';

type AudioContextType = typeof AudioContext;

declare global {
    interface Window {
        webkitAudioContext: AudioContextType;
        AudioContext: AudioContextType;
    }
}

interface TransferBuffer {
    length: number;
    left: Float32Array;
    right: Float32Array;
}

const audioContextCtor = window.AudioContext || window.webkitAudioContext;

const INTERACTION_EVENTS = ['click', 'touchstart', 'keydown'];
const TRANSFER_BUFFER_POOL_CAPACITY = 10;

export class AudioDriver {
    constructor(useWorklet = true) {
        this.setup(useWorklet);
    }

    getSampleRate(): number {
        return this.context?.sampleRate || 0;
    }

    isValid(): boolean {
        return !!this.context;
    }

    start(sampleQueue: SampleQueue) {
        if (this.sampleQueue) this.sampleQueue.onNewSample.removeHandler(this.onNewSample);

        this.sampleQueue = sampleQueue;

        this.isRunning = true;
        if (this.contextHasStarted) this.context?.resume();
        if (this.sampleQueue) this.sampleQueue.reset();

        if (this.audioWorklet) this.sampleQueue.onNewSample.addHandler(this.onNewSample);

        console.log('audio started');
    }

    pause(): void {
        this.isRunning = false;
        if (this.contextHasStarted) this.context?.suspend();

        console.log('audio paused');
    }

    continue(): void {
        this.isRunning = true;
        if (this.contextHasStarted) this.context?.resume();
        if (this.sampleQueue) this.sampleQueue.reset();

        console.log('audio resumed');
    }

    stop(): void {
        this.isRunning = false;
        if (this.contextHasStarted) this.context?.suspend();

        console.log('audio stopped');
    }

    setVolume(volume: number): void {
        if (volume < 0 || volume > 1) return;

        this.volume = volume;
        if (this.gainNode) this.gainNode.gain.value = volume;
    }

    getVolume(): number {
        return this.volume;
    }

    private async setup(useWorklet: boolean): Promise<void> {
        try {
            this.context = new audioContextCtor();
            this.context.destination.channelCount = 2;
            this.context.destination.channelInterpretation = 'speakers';
        } catch (e) {
            console.warn('failed to initialize webaudio');
            return;
        }

        this.prebuffer = (this.context.sampleRate / 30) | 0;

        this.gainNode = this.context.createGain();
        this.gainNode.gain.value = this.volume;

        this.gainNode.connect(this.context.destination);

        this.lowpassNode = this.context.createBiquadFilter();
        this.lowpassNode.frequency.value = 15000;
        this.lowpassNode.type = 'lowpass';
        this.lowpassNode.Q.value = 0.1;
        this.lowpassNode.connect(this.gainNode);

        this.highpassNode = this.context.createBiquadFilter();
        this.highpassNode.frequency.value = 50;
        this.highpassNode.type = 'highpass';
        this.highpassNode.Q.value = 0.1;
        this.highpassNode.connect(this.lowpassNode);

        if (useWorklet) {
            try {
                this.audioWorklet = await this.setupWorklet(this.context);
                this.audioWorklet.connect(this.highpassNode);
            } catch (e) {
                console.warn(e);
                console.log('audio worklet not available, falling back to script processor');

                this.setupScriptProcessor(this.context).connect(this.highpassNode);
            }
        } else {
            this.scriptProcessor = this.setupScriptProcessor(this.context);
            this.scriptProcessor.connect(this.highpassNode);
        }

        this.waitForContext();
    }

    private async setupWorklet(context: AudioContext): Promise<AudioWorkletNode> {
        await context.audioWorklet.addModule('source-processor.js');

        const audioWorklet = new AudioWorkletNode(context, 'source-processor', {
            channelCount: 2,
            outputChannelCount: [2],
            processorOptions: {
                sampleRate: context.sampleRate,
                prebuffer: this.prebuffer,
            },
        });

        this.workletFragmentLength = (context.sampleRate / 100) | 0;

        audioWorklet.port.onmessage = (e) =>
            this.transferBufferPoolSize < TRANSFER_BUFFER_POOL_CAPACITY && (this.transferBufferPool[this.transferBufferPoolSize++] = e.data);

        if (this.sampleQueue) this.sampleQueue.onNewSample.addHandler(this.onNewSample);

        console.log('using audio worklet');

        return audioWorklet;
    }

    private setupScriptProcessor(context: AudioContext): ScriptProcessorNode {
        const scriptProcessor = context.createScriptProcessor(1024, 2, 2);
        scriptProcessor.onaudioprocess = this.onAudioprocess;

        console.log('using script processor');

        return scriptProcessor;
    }

    private waitForContext(): void {
        const mutex = new Mutex();

        const handler = (evt: Event) =>
            mutex.runExclusive(async () => {
                if (!this.context || this.contextHasStarted) return;

                try {
                    await new Promise((resolve, reject) => {
                        this.context?.resume().then(resolve);
                        setTimeout(reject, 100);
                    });

                    if (this.context.state !== 'running') {
                        throw new Error();
                    }
                } catch (e) {
                    return;
                }

                if (!this.isRunning) await this.context.suspend();
                else if (this.sampleQueue) this.sampleQueue.reset();

                this.contextHasStarted = true;
                INTERACTION_EVENTS.forEach((evt) => window.removeEventListener(evt, handler, true));

                console.log('context initialized');
            });

        INTERACTION_EVENTS.forEach((evt) => window.addEventListener(evt, handler, true));
    }

    private createTransferBuffer(): TransferBuffer {
        return {
            length: this.workletFragmentLength,
            left: new Float32Array(this.workletFragmentLength),
            right: new Float32Array(this.workletFragmentLength),
        };
    }

    private onAudioprocess = (evt: AudioProcessingEvent) => {
        if (!this.sampleQueue) return;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (this.sampleQueue.getLength() < evt.outputBuffer.length + this.prebuffer) {
            return;
        }

        this.sampleQueue.fill(evt.outputBuffer.getChannelData(0), evt.outputBuffer.getChannelData(1));
    };

    private onNewSample = () => {
        if (!this.audioWorklet || !this.sampleQueue) return;
        if (this.workletFragmentLength > this.sampleQueue.getLength()) return;

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const transferBuffer = this.transferBufferPoolSize > 0 ? this.transferBufferPool[--this.transferBufferPoolSize] : this.createTransferBuffer();

        this.sampleQueue.fill(transferBuffer.left, transferBuffer.right);
        this.audioWorklet.port.postMessage(transferBuffer, [transferBuffer.left.buffer, transferBuffer.right.buffer]);
    };

    private volume = 0.6;
    private context: AudioContext | undefined = undefined;
    private gainNode: GainNode | undefined = undefined;
    private lowpassNode: BiquadFilterNode | undefined = undefined;
    private highpassNode: BiquadFilterNode | undefined = undefined;
    private scriptProcessor: ScriptProcessorNode | undefined = undefined;
    private audioWorklet: AudioWorkletNode | undefined = undefined;

    private transferBufferPool = new Array<TransferBuffer>(TRANSFER_BUFFER_POOL_CAPACITY);
    private transferBufferPoolSize = 0;

    private isRunning = false;
    private contextHasStarted = false;

    private sampleQueue: SampleQueue | undefined = undefined;
    private prebuffer = 0;
    private workletFragmentLength = 0;
}
