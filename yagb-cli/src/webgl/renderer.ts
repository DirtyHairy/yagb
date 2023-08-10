import { fsh, vsh } from './shader';

import GlProgram from './program';
import { detect } from './capabilities';

const enum FrameOperation {
    blend,
    replace,
}

interface PendingFrame {
    operation: FrameOperation;
    imageData: ImageData;
}

function createCoordinateBuffer(gl: WebGLRenderingContext, data: ArrayLike<number>): WebGLBuffer {
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('failed to create coordinate buffer');

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

    return buffer;
}

function createTexture(gl: WebGLRenderingContext, width: number, height: number): WebGLTexture {
    const texture = gl.createTexture();
    if (!texture) throw new Error('failed to create texture');

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    return texture;
}

function createFramebuffer(gl: WebGLRenderingContext): WebGLFramebuffer {
    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) throw new Error('failed to create framebuffer');

    return framebuffer;
}

export class WebglRenderer {
    constructor(private gl: WebGLRenderingContext, private width: number, private height: number) {
        const capabilities = detect(gl);
        if (!capabilities) throw new Error('failed to detect WebGL capabilites');

        this.programBlit = GlProgram.compile(gl, vsh.plain.source(capabilities), fsh.blit.source(capabilities));
        this.programBlend = GlProgram.compile(gl, vsh.plain.source(capabilities), fsh.blend.source(capabilities));

        this.vertexCoordinateBuffer = createCoordinateBuffer(gl, [1, 1, -1, 1, 1, -1, -1, -1]);
        this.textureCoordinateBuffer = createCoordinateBuffer(gl, [1, 1, 0, 1, 1, 0, 0, 0]);

        this.previousFrame = createTexture(gl, width, height);
        this.renderTarget = createTexture(gl, width, height);
        this.currentFrame = createTexture(gl, width, height);

        this.framebuffer = createFramebuffer(gl);
    }

    addFrameWithBlending(imageData: ArrayBuffer): void {
        this.pendingFrames.push({
            operation: this.firstFrame ? FrameOperation.replace : FrameOperation.blend,
            imageData: new ImageData(new Uint8ClampedArray(imageData).slice(), this.width, this.height),
        });

        this.firstFrame = false;
    }

    addFrame(imageData: ArrayBuffer): void {
        this.pendingFrames.push({
            operation: FrameOperation.replace,
            imageData: new ImageData(new Uint8ClampedArray(imageData).slice(), this.width, this.height),
        });

        this.firstFrame = false;
    }

    setBlendRatio(blendRatio: number): void {
        this.blendRatio = blendRatio;
    }

    render(): void {
        if (this.pendingFrames.length === 0) return;
        const gl = this.gl;

        while (this.pendingFrames.length > 0) {
            const { imageData, operation } = this.pendingFrames.shift()!;

            this.renderFrame(imageData, operation);
        }

        this.programBlit.use();
        this.programBlit.uniform1i(fsh.blit.uniform.textureUnit, 0);

        this.programBlit.bindVertexAttribArray(vsh.plain.attribute.vertexPosition, this.vertexCoordinateBuffer, 2, gl.FLOAT, false, 0, 0);
        this.programBlit.bindVertexAttribArray(vsh.plain.attribute.textureCoordinate, this.textureCoordinateBuffer, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.previousFrame);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    private renderFrame(data: ImageData, operation: FrameOperation): void {
        const gl = this.gl;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, operation === FrameOperation.replace ? this.previousFrame : this.currentFrame);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);

        if (operation === FrameOperation.replace) return;

        this.programBlend.use();

        this.programBlend.uniform1f(fsh.blend.uniform.blendRatio, this.blendRatio);
        this.programBlend.uniform1i(fsh.blend.uniform.textureUnitNew, 0);
        this.programBlend.uniform1i(fsh.blend.uniform.textureUnitPrevious, 1);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.previousFrame);

        this.programBlend.bindVertexAttribArray(vsh.plain.attribute.vertexPosition, this.vertexCoordinateBuffer, 2, gl.FLOAT, false, 0, 0);
        this.programBlend.bindVertexAttribArray(vsh.plain.attribute.textureCoordinate, this.textureCoordinateBuffer, 2, gl.FLOAT, false, 0, 0);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.renderTarget, 0);

        gl.viewport(0, 0, this.width, this.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        const renderTarget = this.renderTarget;
        this.renderTarget = this.previousFrame;
        this.previousFrame = renderTarget;
    }

    private firstFrame = true;
    private pendingFrames: Array<PendingFrame> = [];
    private blendRatio = 0.5;

    private programBlit: GlProgram;
    private programBlend: GlProgram;

    private vertexCoordinateBuffer: WebGLBuffer;
    private textureCoordinateBuffer: WebGLBuffer;

    private renderTarget: WebGLTexture;
    private currentFrame: WebGLTexture;
    private previousFrame: WebGLTexture;

    private framebuffer: WebGLFramebuffer;
}
