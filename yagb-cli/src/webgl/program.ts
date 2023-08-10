function compileShader(gl: WebGLRenderingContext, type: GLenum, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('failed to create shader');

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`failed to compile shader:\n\n${gl.getShaderInfoLog(shader)}\n\n${source}`);
    }

    return shader;
}

class GlProgram {
    private constructor(private gl: WebGLRenderingContext, private program: WebGLProgram, private vsh: WebGLShader, private fsh: WebGLShader) {}

    static compile(gl: WebGLRenderingContext, vshSource: string, fshSource: string): GlProgram {
        const vsh = compileShader(gl, gl.VERTEX_SHADER, vshSource);
        const fsh = compileShader(gl, gl.FRAGMENT_SHADER, fshSource);

        const program = gl.createProgram();
        if (!program) throw new Error('failed to create program');

        gl.attachShader(program, vsh);
        gl.attachShader(program, fsh);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(`failed to link program:\n\n${gl.getProgramInfoLog(program)}`);
        }

        return new GlProgram(gl, program, vsh, fsh);
    }

    delete(): void {
        const gl = this.gl;

        gl.deleteProgram(this.program);
        gl.deleteShader(this.vsh);
        gl.deleteShader(this.fsh);
    }

    use(): void {
        this.gl.useProgram(this.program);
    }

    getAttribLocation(name: string): number {
        if (!this.attributeLocations.has(name)) {
            const location = this.gl.getAttribLocation(this.program, name);

            if (location < 0) {
                throw new Error(`invalid attribute ${name}`);
            }

            this.attributeLocations.set(name, location);
        }

        return this.attributeLocations.get(name)!;
    }

    getUniformLocation(name: string): WebGLUniformLocation {
        if (!this.uniformLocations.has(name)) {
            const location = this.gl.getUniformLocation(this.program, name);

            if (location === null) {
                throw new Error(`invalid uniform ${name}`);
            }

            this.uniformLocations.set(name, location);
        }

        return this.uniformLocations.get(name)!;
    }

    bindVertexAttribArray(attribute: string, buffer: WebGLBuffer, size: number, type: number, normalized: boolean, stride: number, offset: number): void {
        const gl = this.gl;

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(this.getAttribLocation(attribute), size, type, normalized, stride, offset);
        gl.enableVertexAttribArray(this.getAttribLocation(attribute));
    }

    uniform1i(uniform: string, value: number) {
        this.gl.uniform1i(this.getUniformLocation(uniform), value);
    }

    uniform1f(uniform: string, value: number) {
        this.gl.uniform1f(this.getUniformLocation(uniform), value);
    }

    private attributeLocations = new Map<string, number>();
    private uniformLocations = new Map<string, WebGLUniformLocation>();
}

export default GlProgram;
