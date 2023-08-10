import { WebglRenderer } from './webgl/renderer';

export class VideoDriver {
    private renderer?: WebglRenderer;

    constructor(private canvas: HTMLCanvasElement, private width: number, private height: number) {
        canvas.addEventListener('webglcontextlost', () => (this.renderer = undefined));
        canvas.addEventListener('webglcontextrestored', () => this.initialize());

        this.initialize();
    }

    addFrameWithBlending(imageData: ArrayBuffer): void {
        this.renderer?.addFrameWithBlending(imageData);
    }

    addFrame(imageData: ArrayBuffer): void {
        this.renderer?.addFrame(imageData);
    }

    render(): void {
        this.renderer?.render();
    }

    setBlendRatio(blendRatio: number): void {
        this.renderer?.setBlendRatio(blendRatio);
    }

    private initialize(): void {
        if (this.renderer) return;

        const gl = this.canvas.getContext('webgl') || (this.canvas.getContext('experimental-webgl') as WebGLRenderingContext);
        if (!gl) {
            throw new Error('Failed to acquire webgl context. Get a new browser.');
        }

        this.renderer = new WebglRenderer(gl, this.width, this.height);
    }
}
