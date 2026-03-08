export interface Env {
    TRANSLATIONS: KVNamespace;
    SKILLS_CACHE: KVNamespace;
    DB?: D1Database;
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

let _localSkillsCache: any[] | null = null;
let _localSkillsCacheTime = 0;

export async function getLocalSkillsFallback(): Promise<any[]> {
    if (_localSkillsCache && Date.now() - _localSkillsCacheTime < 30000) {
        return _localSkillsCache || [];
    }
    try {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const mainCachePath = path.resolve(process.cwd(), 'data/skills-cache.json');
        if (fs.existsSync(mainCachePath)) {
            const content = fs.readFileSync(mainCachePath, 'utf-8');
            const data = JSON.parse(content);
            _localSkillsCache = Array.isArray(data) ? data : (data.skills || []);
            _localSkillsCacheTime = Date.now();
            return _localSkillsCache || [];
        }
    } catch (e) {
        // ignore
    }
    return [];
}

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
 * ⚠️ WARNING: This pulls FULL data_json blobs (~30KB each × 1900 rows = ~56MB).
 * Only use for detail pages or API routes that need the complete skill data.
 * For listing pages, use getSkillsListing() instead.
 */
export async function getSkillsFromKV(env: Env): Promise<any[]> {
    if (!env?.DB) {
        console.warn('[D1] No DB binding found, falling back to local file array');
        return getLocalSkillsFallback();
    }

    try {
        // We pull the full data_json payloads for application layer mapping
        const result = await env.DB.prepare(`SELECT data_json FROM skills ORDER BY stars DESC`).all();

        if (result.success && result.results) {
            return result.results.map((row: any) => JSON.parse(row.data_json));
        }
        return [];
    } catch (e) {
        console.error('[D1] Error querying skills from SQLite:', e);
        return [];
    }
}

/**
 * ⚡ LIGHTWEIGHT listing query — uses json_extract() to pull only card-display fields.
 * Reduces D1 payload from ~56MB to ~1MB (56x reduction).
 * Use this for /skills listing pages instead of getSkillsFromKV.
 */
export async function getSkillsListing(env: Env): Promise<any[]> {
    if (!env?.DB) {
        console.warn('[D1] No DB binding found, falling back to local file array for listing');
        const all = await getLocalSkillsFallback();
        return all.map(row => ({
            id: row.id,
            name: row.name || row.skillName || row.repo,
            skillName: row.skillName || row.name || '',
            owner: row.owner,
            repo: row.repo,
            description: row.description,
            category: row.category || '',
            topics: row.topics || [],
            stars: row.stars || 0,
            source: row.source || 'cache',
            updatedAt: row.updatedAt || row.updated_at || '',
            qualityScore: row.qualityScore || row.quality_score || 0,
            filePath: row.filePath || '',
            seo: row.seo || undefined,
        })).sort((a, b) => b.stars - a.stars);
    }

    try {
        const result = await env.DB.prepare(`
            SELECT 
                id,
                owner,
                repo,
                name,
                category,
                stars,
                quality_score,
                updated_at,
                json_extract(data_json, '$.skillName') as skillName,
                json_extract(data_json, '$.description') as description,
                json_extract(data_json, '$.topics') as topics,
                json_extract(data_json, '$.source') as source,
                json_extract(data_json, '$.qualityScore') as qualityScore,
                json_extract(data_json, '$.filePath') as filePath,
                json_extract(data_json, '$.seo.definition') as seoDefinition
            FROM skills 
            ORDER BY stars DESC
        `).all();

        if (result.success && result.results) {
            return result.results.map((row: any) => ({
                id: row.id,
                name: row.name || row.skillName || row.repo,
                skillName: row.skillName || row.name || '',
                owner: row.owner,
                repo: row.repo,
                description: row.description ? tryParseJSON(row.description, row.description) : '',
                category: row.category || '',
                topics: row.topics ? tryParseJSON(row.topics, []) : [],
                stars: row.stars || 0,
                source: row.source || 'cache',
                updatedAt: row.updated_at || '',
                qualityScore: row.qualityScore || row.quality_score || 0,
                filePath: row.filePath || '',
                seo: row.seoDefinition ? { definition: tryParseJSON(row.seoDefinition, {}) } : undefined,
            }));
        }
        return [];
    } catch (e) {
        console.error('[D1] Error in listing query:', e);
        return [];
    }
}

/**
 * ⚡ FAST related skills query — targeted D1 query, NOT full-table scan.
 * Returns ~4 skills matching the same category, excluding the current skill.
 * Uses only indexed SQL columns + lightweight json_extract — ~1KB total payload.
 */
export async function getRelatedSkillsFast(
    env: Env,
    currentId: string,
    category: string,
    limit: number = 4
): Promise<any[]> {
    if (!env?.DB) {
        const all = await getLocalSkillsFallback();
        const filtered = all.filter(s => s.category === category && s.id !== currentId)
            .sort((a, b) => (b.stars || 0) - (a.stars || 0))
            .slice(0, limit);
        return filtered.map(row => ({
            id: row.id,
            name: row.name || row.skillName || row.repo,
            skillName: row.skillName || row.name || '',
            owner: row.owner,
            repo: row.repo,
            description: row.description,
            category: row.category || '',
            topics: row.topics || [],
            stars: row.stars || 0,
            qualityScore: row.qualityScore || row.quality_score || 0,
            updatedAt: row.updatedAt || row.updated_at || '',
            seo: row.seo || undefined,
        }));
    }

    try {
        const result = await env.DB.prepare(`
            SELECT 
                id, owner, repo, name, category, stars, quality_score, updated_at,
                json_extract(data_json, '$.skillName') as skillName,
                json_extract(data_json, '$.description') as description,
                json_extract(data_json, '$.topics') as topics,
                json_extract(data_json, '$.qualityScore') as qualityScore,
                json_extract(data_json, '$.seo.definition') as seoDefinition
            FROM skills 
            WHERE category = ?1 AND id != ?2
            ORDER BY stars DESC
            LIMIT ?3
        `).bind(category || '', currentId, limit).all();

        if (result.success && result.results) {
            return result.results.map((row: any) => ({
                id: row.id,
                name: row.name || row.skillName || row.repo,
                skillName: row.skillName || row.name || '',
                owner: row.owner,
                repo: row.repo,
                description: row.description ? tryParseJSON(row.description, row.description) : '',
                category: row.category || '',
                topics: row.topics ? tryParseJSON(row.topics, []) : [],
                stars: row.stars || 0,
                qualityScore: row.qualityScore || row.quality_score || 0,
                updatedAt: row.updated_at || '',
                seo: row.seoDefinition ? { definition: tryParseJSON(row.seoDefinition, {}) } : undefined,
            }));
        }
        return [];
    } catch (e) {
        console.error('[D1] Error in related skills query:', e);
        return [];
    }
}

/** Safe JSON parse helper — returns fallback if parse fails */
function tryParseJSON(str: string, fallback: any): any {
    if (typeof str !== 'string') return str; // Already parsed
    try { return JSON.parse(str); } catch { return fallback; }
}

/**
 * Read a specific key from D1 namespace as JSON.
 * Supports exact ID match and fuzzy match for multi-segment IDs.
 * Usage: await getSkillsKV(context.locals.runtime.env, 'some-key')
 */
export async function getSkillsKV(env: Env, key: string): Promise<any | null> {
    if (!env?.DB) {
        console.warn(`[D1] No DB binding for specific key lookup ${key}, using local cache`);
        const all = await getLocalSkillsFallback();
        let dbId = key;
        if (key.startsWith('skill:')) {
            dbId = key.substring(6);
        }

        let match = all.find(s => s.id === dbId);
        if (match) return match;

        const segments = dbId.split('/');
        if (segments.length >= 2) {
            const owner = segments[0];
            const repo = segments[1];

            if (segments.length > 2) {
                match = all.find(s => s.id && s.id.startsWith(`${owner}/${repo}/`));
                if (match) return match;
            }

            match = all.find(s => s.owner === owner && s.repo === repo);
            if (match) return match;
        }

        return null;
    }

    try {
        // Legacy key formats — not queryable in D1
        if (key === 'all-skills-index' || key.startsWith('all-skills:')) {
            return null;
        }

        // Strip 'skill:' prefix if present
        let dbId = key;
        if (key.startsWith('skill:')) {
            dbId = key.substring(6);
        }

        // 1. Exact match (fastest — uses PRIMARY KEY index)
        const exact = await env.DB.prepare(`SELECT data_json FROM skills WHERE id = ?`).bind(dbId).first();
        if (exact && exact.data_json) {
            return JSON.parse(exact.data_json as string);
        }

        // 2. If ID has 3+ segments (e.g., "anthropics/skills/skillname"), try owner/repo match
        //    This handles the case where detail pages pass owner/repo but the ID includes a sub-path
        const segments = dbId.split('/');
        if (segments.length >= 2) {
            const owner = segments[0];
            const repo = segments[1];

            if (segments.length > 2) {
                // Try LIKE match: "anthropics/skills/%" — uses indexed scan, not full table
                const likeResult = await env.DB.prepare(
                    `SELECT data_json FROM skills WHERE id LIKE ? LIMIT 1`
                ).bind(`${owner}/${repo}/%`).first();
                if (likeResult && likeResult.data_json) {
                    return JSON.parse(likeResult.data_json as string);
                }
            }

            // 3. Try owner+repo index match (uses idx_skills_owner_repo)
            const repoResult = await env.DB.prepare(
                `SELECT data_json FROM skills WHERE owner = ? AND repo = ? LIMIT 1`
            ).bind(owner, repo).first();
            if (repoResult && repoResult.data_json) {
                return JSON.parse(repoResult.data_json as string);
            }
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

