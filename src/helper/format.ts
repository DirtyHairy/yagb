export function hex8(x: number): string {
    return `${0 > x ? '-' : ''}0x${0 > x ? (~x + 1).toString(16).padStart(2, '0') : x.toString(16).padStart(2, '0')}`;
}

export function hex16(x: number): string {
    return `${0 > x ? '-' : ''}0x${0 > x ? (~x + 1).toString(16).padStart(2, '0') : x.toString(16).padStart(4, '0')}`;
}
