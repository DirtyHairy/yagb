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

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

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

        for (let i = 0; i < 2; i++) this.texturePool.push(createTexture(gl, width, height));

        gl.disable(gl.BLEND);
    }

    addFrameWithBlending(imageData: ArrayBuffer): void {
        if (!this.currentFrame) {
            this.addFrame(imageData);
            return;
        }

        if (this.texturePreviousFrame) this.texturePool.push(this.texturePreviousFrame);

        this.previousFrame = this.currentFrame;
        this.texturePreviousFrame = this.textureCurrentFrame;

        this.currentFrame = new ImageData(new Uint8ClampedArray(imageData).slice(), this.width, this.height);
        this.textureCurrentFrame = undefined;
    }

    addFrame(imageData: ArrayBuffer): void {
        this.previousFrame = this.currentFrame = new ImageData(new Uint8ClampedArray(imageData).slice(), this.width, this.height);

        if (this.texturePreviousFrame) this.texturePool.push(this.texturePreviousFrame);
        if (this.textureCurrentFrame) this.texturePool.push(this.textureCurrentFrame);

        this.textureCurrentFrame = this.texturePreviousFrame = undefined;
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

        this.textureCurrentFrame = this.prepareTexture(this.textureCurrentFrame, this.currentFrame, gl.TEXTURE0);

        this.programBlit.use();
        this.programBlit.uniform1i(fsh.blit.uniform.textureUnit, 0);

        this.programBlit.bindVertexAttribArray(vsh.plain.attribute.vertexPosition, this.vertexCoordinateBuffer, 2, gl.FLOAT, false, 0, 0);
        this.programBlit.bindVertexAttribArray(vsh.plain.attribute.textureCoordinate, this.textureCoordinateBuffer, 2, gl.FLOAT, false, 0, 0);

        gl.disable(gl.BLEND);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    private renderMergeFrames(): void {
        if (!(this.currentFrame && this.previousFrame)) return;

        const gl = this.gl;

        this.texturePreviousFrame = this.prepareTexture(this.texturePreviousFrame, this.previousFrame, gl.TEXTURE0);
        this.textureCurrentFrame = this.prepareTexture(this.textureCurrentFrame, this.currentFrame, gl.TEXTURE1);

        this.programBlend.use();
        this.programBlend.uniform1i(fsh.blend.uniform.textureUnitPrevious, 0);
        this.programBlend.uniform1i(fsh.blend.uniform.textureUnitNew, 1);

        this.programBlend.bindVertexAttribArray(vsh.plain.attribute.vertexPosition, this.vertexCoordinateBuffer, 2, gl.FLOAT, false, 0, 0);
        this.programBlend.bindVertexAttribArray(vsh.plain.attribute.textureCoordinate, this.textureCoordinateBuffer, 2, gl.FLOAT, false, 0, 0);

        gl.disable(gl.BLEND);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    private prepareTexture(texture: WebGLTexture | undefined, imageData: ImageData, textureUnit: number): WebGLTexture {
        const gl = this.gl;

        gl.activeTexture(textureUnit);

        if (!texture) {
            texture = this.texturePool.pop();
            if (!texture) throw new Error('unable to obtain a texture from pool');

            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, texture);
        }

        return texture;
    }

    private previousFrame: ImageData | undefined;
    private currentFrame: ImageData | undefined;
    private mergeFrames = true;

    private programBlit: GlProgram;
    private programBlend: GlProgram;

    private vertexCoordinateBuffer: WebGLBuffer;
    private textureCoordinateBuffer: WebGLBuffer;

    private textureCurrentFrame: WebGLTexture | undefined;
    private texturePreviousFrame: WebGLTexture | undefined;

    private texturePool: Array<WebGLTexture> = [];
}
