export function boolval<T>(value: T): boolean;
export function boolval<T>(value: T, asBoolean: boolean): boolean;
export function boolval<T>(value: T, defaultValue: number | boolean | string): boolean;
export function boolval<T>(value: T, asBoolean: boolean, defaultValue: number | boolean | string): number | boolean;
export function boolval<T>(
    value: T,
    asBoolean?: number | boolean | string | undefined,
    defaultValue?: number | boolean | string | undefined
): number | boolean {
    let result: number | boolean;

    asBoolean = typeof asBoolean !== 'undefined' ? asBoolean : true;

    if (typeof value !== 'boolean' && typeof value !== 'number' && typeof value !== 'string') {
        result = val2bool(defaultValue);
    } else {
        result = val2bool(value);
    }

    if (!asBoolean) {
        result = result ? 1 : 0;
    }

    return result;
}

function val2bool<T>(value: T): boolean {
    let result: boolean | undefined;

    if (typeof value === 'boolean') result = value;

    if (typeof value === 'number') {
        result = value > 0;
    }

    if (typeof value === 'string') {
        switch (value) {
            case 'on':
            case 'true':
                result = true;
                break;

            case 'off':
            case 'false':
                result = false;
                break;
        }
    }

    if (typeof result === 'undefined') throw new Error('Convert error');

    return result;
}
