export interface SavestateContainer {
    romHash: string;
    name: string;
    data: ArrayBuffer;
    lastFrame: ArrayBuffer | undefined;
}
