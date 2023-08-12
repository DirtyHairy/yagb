/* eslint-disable @typescript-eslint/no-namespace */
import { Capabilities } from './capabilities';

function precisionFsh(capabilities: Capabilities): string {
    return `precision ${capabilities.highpInFsh ? 'highp' : 'mediump'} float;`;
}

function precisionVsh(capabilities: Capabilities): string {
    return `precision ${capabilities.highpInVsh ? 'highp' : 'mediump'} float;`;
}

export namespace vsh {
    export namespace plain {
        export const source = (capabilities: Capabilities) => `
            ${precisionVsh(capabilities)}

            attribute vec2 a_VertexPosition;
            attribute vec2 a_TextureCoordinate;

            varying vec2 v_TextureCoordinate;

            void main() {
                v_TextureCoordinate = a_TextureCoordinate;
                gl_Position = vec4(a_VertexPosition, 0, 1);
            }
        `;

        export const enum attribute {
            vertexPosition = 'a_VertexPosition',
            textureCoordinate = 'a_TextureCoordinate',
        }
    }
}

export namespace fsh {
    export namespace blit {
        export const source = (capabilities: Capabilities) => `
            ${precisionFsh(capabilities)}

            varying vec2 v_TextureCoordinate;

            uniform sampler2D u_Sampler0;

            void main() {
                gl_FragColor = vec4(texture2D(u_Sampler0, v_TextureCoordinate).rgb, 1.0);
            }
        `;

        export const enum uniform {
            textureUnit = 'u_Sampler0',
        }
    }

    export namespace blend {
        export const source = (capabilities: Capabilities) => `
            ${precisionFsh(capabilities)}

            varying vec2 v_TextureCoordinate;

            uniform sampler2D u_Sampler_NewImage;
            uniform sampler2D u_Sampler_PreviousImage;


            void main() {
                vec4 new = texture2D(u_Sampler_NewImage, v_TextureCoordinate);
                vec4 previous = texture2D(u_Sampler_PreviousImage, v_TextureCoordinate);

                gl_FragColor = vec4(
                    mix(previous.rgb, new.rgb, 0.5),
                    1.0
                );
            }
        `;

        export const enum uniform {
            textureUnitNew = 'u_Sampler_NewImage',
            textureUnitPrevious = 'u_Sampler_PreviousImage',
        }
    }
}
