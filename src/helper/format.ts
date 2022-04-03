export function hex8(x: number): string {
    return `0x${x.toString(16).padStart(2, '0')}`;
}

export function hex16(x: number): string {
    return `0x${x.toString(16).padStart(4, '0')}`;
}
