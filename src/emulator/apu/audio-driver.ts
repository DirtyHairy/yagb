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

        try {
            if (!useWorklet) {
                throw new Error('worklet audio disabled');
            }

            await this.context.audioWorklet.addModule('source-processor.js');

            this.audioWorklet = new AudioWorkletNode(this.context, 'source-processor', { channelCount: 2, outputChannelCount: [2] });
            const length = this.context.sampleRate / 30;
            this.audioWorklet.port.onmessage = (e) => (this.transferBuffer = e.data);

            this.transferBuffer = {
                length,
                left: new Float32Array(length),
                right: new Float32Array(length),
            };

            this.audioWorklet.connect(this.highpassNode);
            if (this.sampleQueue) this.sampleQueue.onNewSample.addHandler(this.onNewSample);

            console.log('audio worklet initialized');
        } catch (e) {
            console.error(e);
            console.log('audio worklet not available, falling back to script processor');

            this.scriptProcessor = this.context.createScriptProcessor(1024, 2, 2);
            this.scriptProcessor.connect(this.highpassNode);
            this.scriptProcessor.onaudioprocess = this.onAudioprocess;
        }

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

    private onAudioprocess = (evt: AudioProcessingEvent) => {
        if (!this.sampleQueue) return;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (this.sampleQueue.getLength() < evt.outputBuffer.length + this.context!.sampleRate / 30) {
            return;
        }

        this.sampleQueue.fill(evt.outputBuffer.getChannelData(0), evt.outputBuffer.getChannelData(1));
    };

    private onNewSample = () => {
        if (!(this.audioWorklet && this.transferBuffer && this.sampleQueue && this.transferBuffer.length <= this.sampleQueue.getLength())) return;

        this.sampleQueue.fill(this.transferBuffer.left, this.transferBuffer.right);
        this.audioWorklet.port.postMessage(this.transferBuffer, [this.transferBuffer.left.buffer, this.transferBuffer.right.buffer]);

        this.transferBuffer = undefined;
    };

    private volume = 0.6;
    private context: AudioContext | undefined = undefined;
    private gainNode: GainNode | undefined = undefined;
    private lowpassNode: BiquadFilterNode | undefined = undefined;
    private highpassNode: BiquadFilterNode | undefined = undefined;

    private scriptProcessor: ScriptProcessorNode | undefined = undefined;

    private audioWorklet: AudioWorkletNode | undefined = undefined;
    private transferBuffer: TransferBuffer | undefined = undefined;

    private isRunning = false;
    private contextHasStarted = false;

    private sampleQueue: SampleQueue | undefined = undefined;
}
