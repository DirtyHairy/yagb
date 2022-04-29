import { SampleQueue } from './sample-queue';

type AudioContextType = typeof AudioContext;

declare global {
    interface Window {
        webkitAudioContext: AudioContextType;
        AudioContext: AudioContextType;
    }
}

const audioContextCtor = window.AudioContext || window.webkitAudioContext;

const INTERACTION_EVENTS = ['click', 'touchstart', 'keydown'];

export class AudioDriver {
    constructor() {
        try {
            this.context = new audioContextCtor();
            this.context.destination.channelCount = 2;
            this.context.destination.channelInterpretation = 'speakers';
        } catch (e) {
            console.warn('failed to initialize webaudio');
            return;
        }

        this.gainNode = this.context.createGain();
        this.gainNode.gain.value = 0.75;

        this.gainNode.connect(this.context.destination);

        this.filterNode = this.context.createBiquadFilter();
        this.filterNode.frequency.value = 15000;
        this.filterNode.type = 'lowpass';
        this.filterNode.Q.value = 0.1;
        this.filterNode.connect(this.gainNode);

        this.scriptProcessor = this.context.createScriptProcessor();
        this.scriptProcessor.connect(this.filterNode);
        this.scriptProcessor.onaudioprocess = this.onAudioprocess;

        const handler = async () => {
            INTERACTION_EVENTS.forEach((evt) => window.removeEventListener(evt, handler, true));

            if (!this.context) return;

            await this.context.resume();
            if (!this.isRunning) await this.context.suspend();
            else if (this.sampleQueue) this.sampleQueue.reset();

            this.contextHasStarted = true;
            console.log('context initialized');
        };

        INTERACTION_EVENTS.forEach((evt) => window.addEventListener(evt, handler, true));
    }

    getSampleRate(): number {
        return this.context?.sampleRate || 0;
    }

    isValid(): boolean {
        return !!this.context;
    }

    start(sampleQueue: SampleQueue) {
        this.sampleQueue = sampleQueue;

        this.isRunning = true;
        if (this.contextHasStarted) this.context?.resume();
        if (this.sampleQueue) this.sampleQueue.reset();

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

    private onAudioprocess = (evt: AudioProcessingEvent) => {
        if (!this.sampleQueue) return;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (this.sampleQueue.getLength() < evt.outputBuffer.length + this.context!.sampleRate / 30) {
            return;
        }

        this.sampleQueue.fill(evt.outputBuffer);
    };

    private context: AudioContext | undefined = undefined;
    private gainNode: GainNode | undefined = undefined;
    private filterNode: BiquadFilterNode | undefined = undefined;
    private scriptProcessor: ScriptProcessorNode | undefined = undefined;

    private isRunning = false;
    private contextHasStarted = false;

    private sampleQueue: SampleQueue | undefined = undefined;
}
