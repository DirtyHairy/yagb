export function encodeBase64(data: Uint8Array): Promise<string> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',', 2)[1]);

        reader.readAsDataURL(new Blob([data]));
    });
}

export async function decodeBase64(base64: string): Promise<Uint8Array> {
    const response = await fetch(`data:application/octet-stream;base64,${base64}`);

    if (!response.ok) {
        throw new Error('bad base64');
    }

    return new Uint8Array(await response.arrayBuffer());
}
