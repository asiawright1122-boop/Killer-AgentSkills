/**
 * Shared utility functions for all scripts
 */

// ===== JSON Parsing =====

/**
 * Safe JSON parser — returns null on failure instead of throwing
 */
export function tryParseJSON(str: string): any {
    try {
        return JSON.parse(str);
    } catch (e) {
        return null;
    }
}

/**
 * Robust JSON extraction with multiple strategies:
 * 1. Strict JSON.parse
 * 2. Repair truncated JSON (unclosed braces/brackets)
 * 3. Quote unquoted keys
 */
export function robustParseJSON(str: string): any {
    str = str.trim();
    // Auto-fix if missing braces
    if (!str.startsWith('{')) str = `{${str}}`;

    // Sanitize: remove code fences, comments, trailing commas
    str = str.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim()
        .replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '')
        .replace(/,(\s*[}\]])/g, '$1');

    // Clean control characters
    str = str.replace(/[\u0000-\u001F]+/g, (match) => {
        return match === '\n' || match === '\r' || match === '\t' ? match : '';
    });

    // Try 1: Strict parse (with newline escaping inside strings)
    try {
        const clean = str.replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, '\\n');
        return JSON.parse(clean);
    } catch (e1) {
        // Try 2: Repair truncated JSON -> loose parse
        try {
            const repaired = repairTruncatedJSON(str);
            // eslint-disable-next-line no-new-func
            return (new Function(`return ${repaired}`))();
        } catch (e2) {
            // Try 3: Quote keys if missing (last resort)
            try {
                const quoted = str.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
                // eslint-disable-next-line no-new-func
                return (new Function(`return ${quoted}`))();
            } catch (e3) {
                return null;
            }
        }
    }
}

/**
 * Repair truncated JSON by closing unclosed braces/brackets/strings
 */
export function repairTruncatedJSON(jsonString: string): string {
    let repaired = jsonString.trim();
    const stack: string[] = [];
    let inString = false;
    let escaped = false;

    for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        if (escaped) { escaped = false; continue; }
        if (char === '\\') { escaped = true; continue; }
        if (char === '"') { inString = !inString; continue; }
        if (!inString) {
            if (char === '{') stack.push('}');
            else if (char === '[') stack.push(']');
            else if (char === '}' || char === ']') {
                if (stack.length > 0 && stack[stack.length - 1] === char) stack.pop();
            }
        }
    }

    if (inString) repaired += '"';
    while (stack.length > 0) repaired += stack.pop();
    return repaired;
}

/**
 * Extract JSON candidates from an AI response string (handles code fences, raw text, etc.)
 */
export function extractJSONCandidates(response: string): string[] {
    const candidates: string[] = [];

    // 1. Explicit ```json blocks (High confidence)
    const jsonBlockMatches = [...response.matchAll(/```json\s*([\s\S]*?)```/g)];
    jsonBlockMatches.forEach(m => candidates.push(m[1]));

    // 2. Any code block starting with { (Medium confidence)
    const anyCodeBlockMatches = [...response.matchAll(/```(?:\w+)?\s*([\s\S]*?)```/g)];
    anyCodeBlockMatches.forEach(m => {
        const content = m[1].trim();
        if (content.startsWith('{') && !candidates.includes(m[1])) {
            candidates.push(content);
        }
    });

    // 3. Raw text fallback — look for { ... } patterns containing expected keys
    if (response.includes('description') || response.includes('seo') || response.includes('suitability')) {
        const firstBrace = response.indexOf('{');
        const lastBrace = response.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            candidates.push(response.slice(firstBrace, lastBrace + 1));
        }
    }

    // 4. If response itself starts with {, add it directly
    if (response.trim().startsWith('{') && !candidates.includes(response.trim())) {
        candidates.push(response.trim());
    }

    return candidates;
}

// ===== Timing =====

/**
 * Sleep for ms
 */
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ===== String Utils =====

/**
 * Truncate string values in a Record to a max length with ellipsis
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

// ===== Concurrency =====

/**
 * Simple p-limit implementation for controlling concurrent async operations
 * Returns a function that wraps async operations with concurrency control
 */
export function pLimit(concurrency: number) {
    const queue: (() => void)[] = [];
    let activeCount = 0;

    const next = () => {
        activeCount--;
        if (queue.length > 0) {
            queue.shift()!();
        }
    };

    const run = (fn: () => Promise<void>): Promise<void> => new Promise<void>((resolve, reject) => {
        const trigger = async () => {
            activeCount++;
            try {
                await fn();
                resolve();
            } catch (e) {
                reject(e);
            } finally {
                next();
            }
        };

        if (activeCount < concurrency) {
            trigger();
        } else {
            queue.push(trigger);
        }
    });

    return run;
}

// ===== Network =====

/**
 * Fetch with timeout to prevent hanging requests
 */
export async function fetchWithTimeout(url: string, options: any = {}, timeout = 30000, maxRetries = 3): Promise<Response> {
    let lastError: any;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            if (!response.ok && response.status >= 500) {
                throw new Error(`Server error: ${response.status}`);
            }
            return response;
        } catch (error: any) {
            clearTimeout(id);
            lastError = error;
            // Don't retry on 4xx errors except 429
            if (error.message?.includes('404') || (error.message?.startsWith('Server error: 4') && !error.message?.includes('429'))) {
                throw error;
            }
            if (attempt < maxRetries - 1) {
                const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 500;
                await new Promise(r => setTimeout(r, backoff));
            }
        }
    }
    throw lastError;
}
