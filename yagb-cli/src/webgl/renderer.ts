import { fsh, vsh } from './shader';

import GlProgram from './program';
import { detect } from './capabilities';

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

export class WebglRenderer {
    constructor(private gl: WebGLRenderingContext, private width: number, private height: number) {
        const capabilities = detect(gl);
        if (!capabilities) throw new Error('failed to detect WebGL capabilites');

        this.programBlit = GlProgram.compile(gl, vsh.plain.source(capabilities), fsh.blit.source(capabilities));
        this.programBlend = GlProgram.compile(gl, vsh.plain.source(capabilities), fsh.blend.source(capabilities));

        this.vertexCoordinateBuffer = createCoordinateBuffer(gl, [1, 1, -1, 1, 1, -1, -1, -1]);
        this.textureCoordinateBuffer = createCoordinateBuffer(gl, [1, 1, 0, 1, 1, 0, 0, 0]);

        this.texturePreviousFrame = createTexture(gl, width, height);
        this.textureCurrentFrame = createTexture(gl, width, height);

        gl.disable(gl.BLEND);
    }

    addFrameWithBlending(imageData: ArrayBuffer): void {
        if (!this.currentFrame) {
            this.addFrame(imageData);
            return;
        }

        this.previousFrame = this.currentFrame;
        this.currentFrame = new ImageData(new Uint8ClampedArray(imageData).slice(), this.width, this.height);
    }

    addFrame(imageData: ArrayBuffer): void {
        this.previousFrame = this.currentFrame = new ImageData(new Uint8ClampedArray(imageData).slice(), this.width, this.height);
    }

    setMergeFrames(mergeFrames: boolean): void {
        this.mergeFrames = mergeFrames;
    }

    render(): void {
        if (this.mergeFrames) this.renderMergeFrames();
        else this.renderSingleFrame();
    }

    private renderSingleFrame(): void {
        if (!this.currentFrame) return;

        const gl = this.gl;

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.textureCurrentFrame);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.currentFrame);

        this.programBlit.use();
        this.programBlit.uniform1i(fsh.blit.uniform.textureUnit, 0);

        this.programBlit.bindVertexAttribArray(vsh.plain.attribute.vertexPosition, this.vertexCoordinateBuffer, 2, gl.FLOAT, false, 0, 0);
        this.programBlit.bindVertexAttribArray(vsh.plain.attribute.textureCoordinate, this.textureCoordinateBuffer, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.textureCurrentFrame);

        gl.disable(gl.BLEND);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    private renderMergeFrames(): void {
        if (!(this.currentFrame && this.previousFrame)) return;

        const gl = this.gl;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texturePreviousFrame);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.previousFrame);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.textureCurrentFrame);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.currentFrame);

        this.programBlend.use();
        this.programBlend.uniform1f(fsh.blend.uniform.blendRatio, this.blendRatio);
        this.programBlend.uniform1i(fsh.blend.uniform.textureUnitNew, 1);
        this.programBlend.uniform1i(fsh.blend.uniform.textureUnitPrevious, 0);

        this.programBlend.bindVertexAttribArray(vsh.plain.attribute.vertexPosition, this.vertexCoordinateBuffer, 2, gl.FLOAT, false, 0, 0);
        this.programBlend.bindVertexAttribArray(vsh.plain.attribute.textureCoordinate, this.textureCoordinateBuffer, 2, gl.FLOAT, false, 0, 0);

        gl.disable(gl.BLEND);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    private previousFrame: ImageData | undefined;
    private currentFrame: ImageData | undefined;
    private blendRatio = 0.5;
    private mergeFrames = true;

    private programBlit: GlProgram;
    private programBlend: GlProgram;

    private vertexCoordinateBuffer: WebGLBuffer;
    private textureCoordinateBuffer: WebGLBuffer;

    private textureCurrentFrame: WebGLTexture;
    private texturePreviousFrame: WebGLTexture;
}
