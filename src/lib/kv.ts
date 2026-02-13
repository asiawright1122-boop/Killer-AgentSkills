export interface Env {
    TRANSLATIONS: KVNamespace;
    SKILLS_CACHE: KVNamespace;
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
 * Read all skills data from SKILLS_CACHE KV namespace.
 * Returns an empty array if the binding is unavailable or on error.
 * Usage: await getSkillsFromKV(context.locals.runtime.env)
 */
export async function getSkillsFromKV(env: Env): Promise<any[]> {
    // Helper to load from local file
    const loadFromLocalFile = async (): Promise<any[] | null> => {
        try {
            const fs = await import('node:fs');
            const path = await import('node:path');
            const cachePath = path.resolve(process.cwd(), 'data/skills-cache.json');
            if (fs.existsSync(cachePath)) {
                const content = fs.readFileSync(cachePath, 'utf-8');
                const data = JSON.parse(content);
                console.log('[KV] Using local skills cache');
                if (Array.isArray(data.skills)) return data.skills;
                if (Array.isArray(data)) return data;
            }
        } catch (e) {
            console.warn('[KV] Failed to read local skills cache:', e);
        }
        return null;
    };

    if (!env?.SKILLS_CACHE) {
        // Fallback to local file ONLY in dev mode
        if (import.meta.env.DEV) {
            const local = await loadFromLocalFile();
            if (local) return local;
        }
        console.warn('[KV] No SKILLS_CACHE binding and local fallback failed');
        return [];
    }
    try {
        // 新分片格式: all-skills-index + all-skills:0, all-skills:1, ...
        const index = await env.SKILLS_CACHE.get('all-skills-index', 'json') as { shardCount: number; totalCount: number } | null;
        if (index && index.shardCount > 0) {
            console.log(`[KV] Reading ${index.shardCount} shards (${index.totalCount} skills)...`);
            const shardPromises = Array.from({ length: index.shardCount }, (_, i) =>
                env.SKILLS_CACHE.get(`all-skills:${i}`, 'json')
            );
            const shardResults = await Promise.all(shardPromises);
            const allSkills = shardResults
                .filter((shard): shard is any[] => Array.isArray(shard))
                .flat();
            if (allSkills.length > 0) {
                console.log(`[KV] Loaded ${allSkills.length} skills from ${index.shardCount} shards`);
                return allSkills;
            }
            console.warn('[KV] Shards returned empty, trying legacy format...');
        }

        // 向后兼容: 旧的单 key 格式
        const data = await env.SKILLS_CACHE.get('all-skills', 'json');
        if (Array.isArray(data) && data.length > 0) {
            return data;
        }
        // Handle case where data is { skills: [...] }
        if (data && typeof data === 'object' && Array.isArray((data as any).skills) && (data as any).skills.length > 0) {
            return (data as any).skills;
        }
        // KV exists but returned empty/null — fall back to local file in dev mode
        if (import.meta.env.DEV) {
            console.warn('[KV] SKILLS_CACHE KV returned empty, falling back to local file');
            const local = await loadFromLocalFile();
            if (local) return local;
        }
        return [];
    } catch (e) {
        console.error('[KV] Error reading skills:', e);
        // In dev mode, try local file as last resort
        if (import.meta.env.DEV) {
            const local = await loadFromLocalFile();
            if (local) return local;
        }
        return [];
    }
}

/**
 * Read a specific key from SKILLS_CACHE KV namespace as JSON.
 * Returns null if the binding is unavailable, key doesn't exist, or on error.
 * Usage: await getSkillsKV(context.locals.runtime.env, 'some-key')
 */
export async function getSkillsKV(env: Env, key: string): Promise<any | null> {
    if (!env?.SKILLS_CACHE) {
        console.warn('[KV] No SKILLS_CACHE binding');
        return null;
    }
    try {
        const data = await env.SKILLS_CACHE.get(key, 'json');
        return data ?? null;
    } catch (e) {
        console.error(`[KV] Error reading skills key "${key}":`, e);
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

    if (!env?.SKILLS_CACHE) {
        // Fallback to local file ONLY in dev mode
        if (import.meta.env.DEV) {
            try {
                const fs = await import('node:fs');
                const path = await import('node:path');
                const cachePath = path.resolve(process.cwd(), 'data/sitemap-skills.json');

                if (fs.existsSync(cachePath)) {
                    const content = fs.readFileSync(cachePath, 'utf-8');
                    const data = JSON.parse(content);
                    console.log('[KV] Using local sitemap skills cache');
                    if (Array.isArray(data)) return filterValid(data);
                }
                // If sitemap specific cache doesn't exist, try falling back to main cache for dev
                const mainCachePath = path.resolve(process.cwd(), 'data/skills-cache.json');
                if (fs.existsSync(mainCachePath)) {
                    const content = fs.readFileSync(mainCachePath, 'utf-8');
                    const data = JSON.parse(content);
                    const skills = Array.isArray(data) ? data : (data.skills || []);
                    return filterValid(skills.map((s: any) => ({ owner: s.owner, repo: s.repo, updatedAt: s.updatedAt })));
                }
            } catch (e) {
                console.warn('[KV] Failed to read local sitemap skills cache:', e);
            }
        }
        console.warn('[KV] No SKILLS_CACHE binding and local fallback failed for sitemap');
        return [];
    }
    try {
        const data = await env.SKILLS_CACHE.get('sitemap-skills', 'json');
        if (Array.isArray(data)) {
            return filterValid(data);
        }
        return [];
    } catch (e) {
        console.error('[KV] Error reading sitemap skills:', e);
        return [];
    }
}
