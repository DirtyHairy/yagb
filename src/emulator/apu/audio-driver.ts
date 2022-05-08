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

        this.scriptProcessor = this.context.createScriptProcessor(1024, 2, 2);
        this.scriptProcessor.connect(this.highpassNode);
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

    setVolume(volume: number): void {
        if (volume < 0 || volume > 1) return;

        this.volume = volume;
        if (this.gainNode) this.gainNode.gain.value = volume;
    }

    getVolume(): number {
        return this.volume;
    }

    private onAudioprocess = (evt: AudioProcessingEvent) => {
        if (!this.sampleQueue) return;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (this.sampleQueue.getLength() < evt.outputBuffer.length + this.context!.sampleRate / 30) {
            return;
        }

        this.sampleQueue.fill(evt.outputBuffer.getChannelData(0), evt.outputBuffer.getChannelData(1));
    };

    private volume = 0.6;
    private context: AudioContext | undefined = undefined;
    private gainNode: GainNode | undefined = undefined;
    private lowpassNode: BiquadFilterNode | undefined = undefined;
    private highpassNode: BiquadFilterNode | undefined = undefined;
    private scriptProcessor: ScriptProcessorNode | undefined = undefined;

    private isRunning = false;
    private contextHasStarted = false;

    private sampleQueue: SampleQueue | undefined = undefined;
}
