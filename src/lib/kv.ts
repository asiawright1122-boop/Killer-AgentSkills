export interface Env {
    TRANSLATIONS: KVNamespace;
    SKILLS_CACHE: KVNamespace;
    DB?: D1Database;
    AI: any;                    // Workers AI binding
    ASSETS: Fetcher;            // Static assets binding
    ADMIN_USER?: string;
    ADMIN_PASSWORD?: string;
    NVIDIA_API_KEY?: string;
    NVIDIA_API_KEYS?: string;
    NVIDIA_API_KEYS_2?: string;
    NVIDIA_API_KEYS_3?: string;
}

// Helper to get runtime env from Astro context
// In Astro components: Astro.locals.runtime.env
// In API endpoints: context.locals.runtime.env

// Local mock for dev if needed, though wrangler dev usually handles bindings
const localCache = new Map<string, string>();

/**
 * Read from KV.
 * Usage: await getKV(context.locals.runtime.env, 'key')
 * We need to pass the env object explicitly because this is a pure function,
 * or we could make it a class that is initialized with env.
 * Pure function is better for tree shaking.
 */
export async function getKV(env: Env, key: string): Promise<string | null> {
    if (!env || !env.TRANSLATIONS) {
        // Dev mode without binding
        console.warn("[KV] No TRANSLATIONS binding found. Using local mock.");
        return localCache.get(key) || null;
    }

    try {
        return await env.TRANSLATIONS.get(key);
    } catch (e) {
        console.error(`[KV] Error reading ${key}:`, e);
        return null;
    }
}

export async function setKV(env: Env, key: string, value: string, ttl: number = 31536000): Promise<void> {
    if (!env || !env.TRANSLATIONS) {
        console.warn(`[KV] Mock Write: ${key}`);
        localCache.set(key, value);
        return;
    }

    try {
        await env.TRANSLATIONS.put(key, value, { expirationTtl: ttl });
    } catch (e) {
        console.error(`[KV] Error writing ${key}:`, e);
    }
}

/**
 * Read all skills data from D1 SQLite Serverless database.
 * Usage: await getSkillsFromKV(context.locals.runtime.env)
 */
export async function getSkillsFromKV(env: Env): Promise<any[]> {
    if (!env?.DB) {
        console.warn('[D1] No DB binding found, falling back to empty array');
        return [];
    }

    try {
        console.log('[D1] Executing global skill selection across D1 Database Nodes...');
        // We pull the full data_json payloads for application layer mapping
        const result = await env.DB.prepare(`SELECT data_json FROM skills ORDER BY stars DESC`).all();

        if (result.success && result.results) {
            console.log(`[D1] Successfully loaded ${result.results.length} skills from SQLite Edge Cache`);
            return result.results.map((row: any) => JSON.parse(row.data_json));
        }
        return [];
    } catch (e) {
        console.error('[D1] Error querying skills from SQLite:', e);
        return [];
    }
}

/**
 * Read a specific key from D1 namespace as JSON.
 * Usage: await getSkillsKV(context.locals.runtime.env, 'some-key')
 */
export async function getSkillsKV(env: Env, key: string): Promise<any | null> {
    if (!env?.DB) {
        console.warn('[D1] No DB binding for specific key lookup');
        return null;
    }

    try {
        // If they ask for key "all-skills-index" or purely legacy string paths, map them safely
        if (key === 'all-skills-index' || key.startsWith('all-skills:')) {
            return null;
        }

        // 'skill:owner/repo' -> extract owner and repo, or just bind 'owner/repo' into 'id' 
        // Our D1 'id' maps exactly to the repo string "owner/repo" in skills sync scripts!
        let dbId = key;
        if (key.startsWith('skill:')) {
            dbId = key.substring(6);
        }

        const result = await env.DB.prepare(`SELECT data_json FROM skills WHERE id = ?`).bind(dbId).first();
        if (result && result.data_json) {
            return JSON.parse(result.data_json as string);
        }
        return null;
    } catch (e) {
        console.error(`[D1] Error querying skill key "${key}":`, e);
        return null;
    }
}

/**
 * Read sitemap skills data from SKILLS_CACHE KV namespace.
 * Filters out any entries with missing owner/repo to prevent undefined URLs.
 * usage: await getSitemapSkillsFromKV(context.locals.runtime.env)
 */
export async function getSitemapSkillsFromKV(env: Env): Promise<{ owner: string, repo: string, updatedAt?: string }[]> {
    // Helper to filter valid entries
    const filterValid = (items: any[]): { owner: string, repo: string, updatedAt?: string }[] =>
        items.filter(s => s && typeof s.owner === 'string' && s.owner && typeof s.repo === 'string' && s.repo);

    // Primary: Query D1
    if (env?.DB) {
        try {
            const result = await env.DB.prepare(
                `SELECT owner, repo, updated_at as updatedAt FROM skills WHERE owner IS NOT NULL AND repo IS NOT NULL`
            ).all();
            if (result.success && result.results) {
                console.log(`[D1] Sitemap: loaded ${result.results.length} entries from D1`);
                return filterValid(result.results as any[]);
            }
        } catch (e) {
            console.error('[D1] Error reading sitemap skills from D1:', e);
        }
    }

    // Fallback: Dev mode local file
    if (import.meta.env.DEV) {
        try {
            const fs = await import('node:fs');
            const path = await import('node:path');

            const sitemapPath = path.resolve(process.cwd(), 'data/sitemap-skills.json');
            if (fs.existsSync(sitemapPath)) {
                const content = fs.readFileSync(sitemapPath, 'utf-8');
                const data = JSON.parse(content);
                console.log('[Local] Using local sitemap skills cache');
                if (Array.isArray(data)) return filterValid(data);
            }

            const mainCachePath = path.resolve(process.cwd(), 'data/skills-cache.json');
            if (fs.existsSync(mainCachePath)) {
                const content = fs.readFileSync(mainCachePath, 'utf-8');
                const data = JSON.parse(content);
                const skills = Array.isArray(data) ? data : (data.skills || []);
                return filterValid(skills.map((s: any) => ({ owner: s.owner, repo: s.repo, updatedAt: s.updatedAt })));
            }
        } catch (e) {
            console.warn('[Local] Failed to read local sitemap skills cache:', e);
        }
    }

    console.warn('[Sitemap] No data source available for sitemap');
    return [];
}

