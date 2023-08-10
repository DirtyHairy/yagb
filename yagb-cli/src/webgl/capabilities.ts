export interface Capabilities {
    highpInVsh: boolean;
    highpInFsh: boolean;
}

function shaderSupportsPrecision(gl: WebGLRenderingContext, shaderType: number, precisionType: number): boolean {
    const format = gl.getShaderPrecisionFormat(shaderType, precisionType);

    return !!format && format.precision > 0;
}

export function detect(gl?: WebGLRenderingContext): Capabilities | null {
    if (!gl) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;

        gl = canvas.getContext('webgl') || (canvas.getContext('experimental-webgl') as WebGLRenderingContext) || undefined;
    }

    if (!gl) return null;

    return {
        highpInFsh: shaderSupportsPrecision(gl, gl.FRAGMENT_SHADER, gl.HIGH_FLOAT),
        highpInVsh: shaderSupportsPrecision(gl, gl.VERTEX_SHADER, gl.HIGH_FLOAT),
    };
}
