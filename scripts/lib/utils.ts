/**
 * Safe JSON parser
 */
export function tryParseJSON(str: string): any {
    try {
        return JSON.parse(str);
    } catch (e) {
        return null;
    }
}

/**
 * Sleep for ms
 */
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Truncate string with ellipsis
 */
export function cleanAndTruncate(obj: Record<string, string>, limit: number): Record<string, string> {
    const res: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
        let val = v || '';
        if (typeof val === 'string' && val.length > limit) {
            val = val.substring(0, limit - 3) + '...';
        }
        res[k] = val;
    }
    return res;
}
