import { getNonTargetSkillReason } from './shared/validation';
import { buildSkillIndexabilityAssessment } from './skill-indexability';
import { normalizeSitemapSkillEntry, type SitemapSkillEntry } from './skill-route-paths';
import { getLocalSkillsFallback } from './local-skills-fallback';
import { assessSkillTrust, type RiskFlag, type SecurityLevel, type SourceTrustLevel } from './skill-trust';

export interface Env {
  TRANSLATIONS: KVNamespace;
  SKILLS_CACHE: KVNamespace;
  DB?: D1Database;
  VECTORIZE?: VectorizeIndex;
  AI?: any; // Type 'Ai' from @cloudflare/workers-types if available
  ASSETS: Fetcher; // Static assets binding
  ADMIN_USER?: string;
  ADMIN_PASSWORD?: string;
  GITHUB_PAT?: string;
  GITHUB_TOKEN?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  ANALYTICS_HASH_SALT?: string;
  NVIDIA_API_KEY?: string;
  NVIDIA_API_KEYS?: string;
  NVIDIA_API_KEYS_2?: string;
  NVIDIA_API_KEYS_3?: string;
  NVIDIA_API_KEYS_4?: string;
  NVIDIA_API_KEYS_5?: string;
  NVIDIA_MODEL?: string;
  SILICONFLOW_API_KEY?: string;
  SILICONFLOW_MODEL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_API_KEYS?: string;
  OPENROUTER_MODEL?: string;
  AI_FALLBACK_POLICY?: string;
  AI_FALLBACK_ALWAYS_REASON?: string;
  TRANSLATE_WORKLOAD_PROFILE?: string;
  TRANSLATE_MODEL_NVIDIA?: string;
  TRANSLATE_MODEL_SILICONFLOW?: string;
  TRANSLATE_MODEL_OPENROUTER?: string;
  SKILL_TRY_DAILY_LIMIT?: string;
  SKILL_TRY_WORKLOAD_PROFILE?: string;
  SKILL_TRY_MODEL_NVIDIA?: string;
  SKILL_TRY_MODEL_SILICONFLOW?: string;
  SKILL_TRY_MODEL_OPENROUTER?: string;
}

// Helper to get runtime env from Astro context
// In Astro components: Astro.locals.runtime.env
// In API endpoints: context.locals.runtime.env

// Local mock for dev if needed, though wrangler dev usually handles bindings
const localCache = new Map<string, string>();

export interface SkillListingItem {
  id: string;
  name: string;
  skillName: string;
  owner: string;
  repo: string;
  repoPath?: string;
  description: string | Record<string, string>;
  category: string;
  topics: string[];
  stars: number;
  source: 'verified' | 'featured' | 'cache';
  updatedAt: string;
  lastSynced?: string;
  qualityScore: number;
  securityLevel?: SecurityLevel;
  sourceTrust?: SourceTrustLevel;
  securityScore?: number;
  sourceScore?: number;
  rankScore?: number;
  isTrustedRankingEligible?: boolean;
  riskFlags?: RiskFlag[];
  securityBrief?: string;
  primaryTrustReason?: string;
  lastAuditedAt?: string;
  filePath?: string;
  seo?: {
    definition: Record<string, string>;
    features?: Record<string, string[]>;
    keywords?: Record<string, string[]>;
  };
  forks?: number;
  skillMd?: {
    name?: string;
    description?: string;
    body?: string;
    bodyPreview?: string;
  };
}

export interface SkillsListingPageResult {
  items: SkillListingItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SkillsCategoryCountItem {
  category: string;
  count: number;
}

export interface SkillsCategorySummary {
  total: number;
  categories: SkillsCategoryCountItem[];
}

type D1Row = Record<string, unknown>;
type TimedCacheEntry<T> = { value: T; ts: number };

let _sitemapSkillsCache: SitemapSkillEntry[] | null = null;
let _sitemapSkillsCacheTime = 0;
let _skillsTotalCountCache: TimedCacheEntry<number> | null = null;
let _marketplaceSkillsTotalCountCache: TimedCacheEntry<number> | null = null;
let _skillsCategorySummaryCache: TimedCacheEntry<SkillsCategorySummary> | null = null;
const _skillsListingPageCache = new Map<string, TimedCacheEntry<SkillsListingPageResult>>();
const _marketplaceSkillsListingPageCache = new Map<string, TimedCacheEntry<SkillsListingPageResult>>();
const _skillsListingTopCache = new Map<string, TimedCacheEntry<SkillListingItem[]>>();
const _skillsListingByRefsCache = new Map<string, TimedCacheEntry<SkillListingItem[]>>();

const SITEMAP_SKILLS_CACHE_TTL_MS = 5 * 60 * 1000;

function getD1Rows<T extends D1Row>(result: { results: T[] }): T[] {
  return result.results;
}
const SKILLS_TOTAL_COUNT_CACHE_TTL_MS = 60 * 1000;
const SKILLS_LISTING_PAGE_CACHE_TTL_MS = 30 * 1000;
const SKILLS_LISTING_TOP_CACHE_TTL_MS = 30 * 1000;
const SKILLS_LISTING_BY_REFS_CACHE_TTL_MS = 2 * 60 * 1000;
const SKILLS_CATEGORY_SUMMARY_CACHE_TTL_MS = 2 * 60 * 1000;
const SKILLS_LISTING_PAGE_CACHE_MAX = 120;
const MARKETPLACE_SKILLS_LISTING_PAGE_CACHE_MAX = 120;
const SKILLS_LISTING_TOP_CACHE_MAX = 40;
const SKILLS_LISTING_BY_REFS_CACHE_MAX = 200;
const _loggedMissingSkillsTableContexts = new Set<string>();

const MARKETPLACE_ADMISSION_WHERE_SQL = `
    WHERE UPPER(COALESCE(NULLIF(TRIM(CAST(security_level AS TEXT)), ''), '')) != 'D'
      AND UPPER(COALESCE(NULLIF(TRIM(CAST(json_extract(data_json, '$.securityLevel') AS TEXT)), ''), '')) != 'D'
      AND COALESCE(NULLIF(UPPER(TRIM(CAST(source_trust AS TEXT))), ''), NULLIF(UPPER(TRIM(CAST(json_extract(data_json, '$.sourceTrust') AS TEXT))), ''), '') IN ('T1', 'T2')
      AND COALESCE(NULLIF(UPPER(TRIM(CAST(json_extract(data_json, '$.sourceTrust') AS TEXT))), ''), NULLIF(UPPER(TRIM(CAST(source_trust AS TEXT))), ''), '') IN ('T1', 'T2')
      AND LOWER(TRIM(COALESCE(CAST(json_extract(data_json, '$.isTrustedRankingEligible') AS TEXT), ''))) NOT IN ('0', 'false')
      AND NOT EXISTS (
        SELECT 1
        FROM json_each(COALESCE(json_extract(data_json, '$.riskFlags'), '[]')) AS risk
        WHERE LOWER(TRIM(COALESCE(CAST(json_extract(risk.value, '$.severity') AS TEXT), ''))) = 'blocker'
      )
`;

function isMissingSkillsTableError(error: unknown): boolean {
  const message =
    error instanceof Error ? `${error.message} ${(error as Error & { cause?: unknown }).cause || ''}` : String(error);
  return message.includes('no such table: skills');
}

function logD1Fallback(context: string, error: unknown): void {
  if (isMissingSkillsTableError(error)) {
    if (!_loggedMissingSkillsTableContexts.has(context)) {
      _loggedMissingSkillsTableContexts.add(context);
      console.warn(`[D1] ${context}; local skills table is missing, using bundled snapshot fallback`);
    }
    return;
  }

  console.error(`[D1] ${context}:`, error);
}

const sortListingByTrust = (a: SkillListingItem, b: SkillListingItem) =>
  (b.rankScore || b.qualityScore || 0) - (a.rankScore || a.qualityScore || 0) || b.stars - a.stars;

async function getLocalListingFallbackSorted(limit?: number): Promise<SkillListingItem[]> {
  const all = await getLocalSkillsFallback();
  const rows = all.map((row) => mapLocalListingRow(row as unknown as Record<string, unknown>)).sort(sortListingByTrust);
  return typeof limit === 'number' ? rows.slice(0, limit) : rows;
}

async function getLocalCategorySummary(): Promise<SkillsCategorySummary> {
  const rows = await getLocalListingFallbackSorted();
  const counts = new Map<string, number>();

  for (const row of rows) {
    const category = String(row.category || '')
      .trim()
      .toLowerCase();
    counts.set(category, (counts.get(category) || 0) + 1);
  }

  return {
    total: rows.length,
    categories: Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
  };
}

function isPublicSitemapSkillCandidate(skill: Record<string, unknown>): boolean {
  return !getNonTargetSkillReason({
    name:
      (typeof skill.skillName === 'string' && skill.skillName) ||
      (typeof skill.name === 'string' && skill.name) ||
      (typeof skill.repo === 'string' && skill.repo) ||
      '',
    owner: typeof skill.owner === 'string' ? skill.owner : '',
    repo: typeof skill.repo === 'string' ? skill.repo : '',
    body:
      (typeof skill.skillBody === 'string' && skill.skillBody) ||
      (typeof skill.skillBodyPreview === 'string' && skill.skillBodyPreview) ||
      '',
    description:
      skill.descriptionRaw ||
      (typeof skill.descriptionEn === 'string' ? skill.descriptionEn : '') ||
      skill.seoDefinitionRaw ||
      (typeof skill.seoDefinitionEn === 'string' ? skill.seoDefinitionEn : ''),
    topics: Array.isArray(skill.topicsRaw)
      ? (skill.topicsRaw as string[])
      : typeof skill.topicsRaw === 'string'
        ? [skill.topicsRaw]
        : [],
    category: typeof skill.category === 'string' ? skill.category : '',
    filePath: typeof skill.filePath === 'string' ? skill.filePath : '',
  });
}

/** Clear sitemap skills cache - for testing only */
export function _clearSitemapSkillsCacheForTest(): void {
  _sitemapSkillsCache = null;
  _sitemapSkillsCacheTime = 0;
}

function getTimedValue<T>(entry: TimedCacheEntry<T> | null, ttlMs: number): T | null {
  if (!entry) return null;
  if (Date.now() - entry.ts > ttlMs) return null;
  return entry.value;
}

function getTimedMapValue<T>(cache: Map<string, TimedCacheEntry<T>>, key: string, ttlMs: number): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setTimedMapValue<T>(cache: Map<string, TimedCacheEntry<T>>, key: string, value: T, maxEntries: number): void {
  cache.set(key, { value, ts: Date.now() });
  if (cache.size <= maxEntries) return;
  const oldestKey = cache.keys().next().value;
  if (oldestKey) cache.delete(oldestKey);
}

function cloneListingItems(items: SkillListingItem[]): SkillListingItem[] {
  return items.map((item) => ({ ...item }));
}

function cloneCategorySummary(summary: SkillsCategorySummary): SkillsCategorySummary {
  return {
    total: summary.total,
    categories: summary.categories.map((item) => ({ ...item })),
  };
}

function parseInstalledSkillFrontmatter(raw: string): { name: string; description: string; body: string } | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  const frontmatter = match[1];
  const body = match[2]?.trim() || '';
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);
  const name = nameMatch?.[1]?.trim();
  const description = descriptionMatch?.[1]?.trim();
  if (!name) return null;
  return { name, description: description || `${name} AI agent skill.`, body: body || `# ${name}` };
}

export async function getInstalledSkillsFallback(): Promise<any[]> {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const baseDirs = [
    path.resolve(process.cwd(), 'packages/cli/.opencode/skills'),
    path.resolve(process.cwd(), 'packages/cli/.cline/skills'),
  ];

  const collected = new Map<string, any>();

  for (const baseDir of baseDirs) {
    if (!fs.existsSync(baseDir)) continue;

    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const skillDir = path.join(baseDir, entry.name);
      const metaPath = path.join(skillDir, '.killer-meta.json');
      const skillPath = path.join(skillDir, 'SKILL.md');
      if (!fs.existsSync(metaPath) || !fs.existsSync(skillPath)) continue;

      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        const repoUrl = typeof meta.repoUrl === 'string' ? meta.repoUrl.trim() : '';
        const subpath = typeof meta.subpath === 'string' ? meta.subpath.trim() : '';
        const installedAt = typeof meta.installedAt === 'string' ? meta.installedAt : '';
        const repoMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
        const skillMatch = subpath.match(/^skills\/([^/]+)$/);
        if (!repoMatch || !skillMatch) continue;

        const owner = repoMatch[1];
        const repo = repoMatch[2];
        const skillSlug = skillMatch[1];
        const rawSkill = fs.readFileSync(skillPath, 'utf-8');
        const parsed = parseInstalledSkillFrontmatter(rawSkill);
        if (!parsed) continue;

        const id = `${owner}/${repo}/${skillSlug}`;
        if (collected.has(id)) continue;

        collected.set(id, {
          id,
          name: parsed.name,
          skillName: parsed.name,
          description: { en: parsed.description },
          owner,
          repo,
          repoPath: `${owner}/${repo}`,
          stars: 0,
          forks: 0,
          updatedAt: installedAt,
          lastSynced: installedAt,
          topics: ['agent-skills'],
          category: 'official',
          qualityScore: 0,
          filePath: path.relative(process.cwd(), skillPath),
          skillMd: {
            name: parsed.name,
            description: parsed.description,
            bodyPreview: parsed.body,
            body: parsed.body,
          },
        });
      } catch {
        // ignore malformed installed skill metadata
      }
    }
  }

  return Array.from(collected.values());
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
    console.warn('[KV] No TRANSLATIONS binding found. Using local mock.');
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
  // 1. Try D1 first (fastest)
  if (env?.DB) {
    try {
      const result = await env.DB.prepare(
        `SELECT data_json FROM skills ORDER BY COALESCE(rank_score, quality_score, 0) DESC, stars DESC`,
      ).all<D1Row>();
      if (result.success && result.results) {
        return getD1Rows(result).map((row: D1Row) => JSON.parse(row.data_json as string));
      }
    } catch (e) {
      console.warn('[D1] Query failed, falling back to KV:', e);
    }
  }

  // 2. Try KV namespace (SKILLS_CACHE)
  if (env?.SKILLS_CACHE) {
    try {
      const listResult = await env.SKILLS_CACHE.list({ prefix: 'skill:' });
      const results = listResult?.keys || [];
      if (results && results.length > 0) {
        const skills = await Promise.all(
          results.map(async (kv: { name: string }) => {
            const value = await env.SKILLS_CACHE.get(kv.name);
            return value ? JSON.parse(value as string) : null;
          }),
        );
        return skills.filter(Boolean);
      }
    } catch (e) {
      console.warn('[KV] Read failed, falling back to local file:', e);
    }
  }

  // 3. Last resort: local file fallback (dev mode)
  console.warn('[D1] No DB binding found, falling back to local file array');
  return getLocalSkillsFallback();
}

/**
 * ⚡ LIGHTWEIGHT listing query — uses json_extract() to pull only card-display fields.
 * Reduces D1 payload from ~56MB to ~1MB (56x reduction).
 * Use this for /skills listing pages instead of getSkillsFromKV.
 */
export async function getSkillsListing(env: Env): Promise<SkillListingItem[]> {
  if (!env?.DB) {
    console.warn('[D1] No DB binding found, falling back to local file array for listing');
    return getLocalListingFallbackSorted();
  }

  try {
    const result = await env.DB.prepare(
      `
            SELECT 
                id,
                owner,
                repo,
                name,
                category,
                stars,
                quality_score,
                COALESCE(
                  NULLIF(UPPER(TRIM(CAST(security_level AS TEXT))), ''),
                  UPPER(CAST(json_extract(data_json, '$.securityLevel') AS TEXT))
                ) as security_level,
                COALESCE(
                  NULLIF(UPPER(TRIM(CAST(source_trust AS TEXT))), ''),
                  UPPER(CAST(json_extract(data_json, '$.sourceTrust') AS TEXT))
                ) as source_trust,
                rank_score,
                last_audited_at,
                updated_at,
                json_extract(data_json, '$.skillName') as skillName,
                json_extract(data_json, '$.description') as description,
                json_extract(data_json, '$.topics') as topics,
                json_extract(data_json, '$.source') as source,
                json_extract(data_json, '$.qualityScore') as qualityScore,
                json_extract(data_json, '$.securityScore') as securityScore,
                json_extract(data_json, '$.sourceScore') as sourceScore,
                json_extract(data_json, '$.isTrustedRankingEligible') as isTrustedRankingEligible,
                json_extract(data_json, '$.riskFlags') as riskFlags,
                json_extract(data_json, '$.securityBrief') as securityBrief,
                json_extract(data_json, '$.primaryTrustReason') as primaryTrustReason,
                json_extract(data_json, '$.filePath') as filePath,
                json_extract(data_json, '$.seo.definition') as seoDefinition
            FROM skills 
            ORDER BY COALESCE(rank_score, quality_score, 0) DESC, stars DESC
        `,
    ).all<D1Row>();

    if (result.success && result.results) {
      const rows = getD1Rows(result).map((row: D1Row): SkillListingItem => mapD1ListingRow(row));
      return rows.length > 0 ? rows : getLocalListingFallbackSorted();
    }
    return getLocalListingFallbackSorted();
  } catch (e) {
    logD1Fallback('Error in listing query', e);
    return getLocalListingFallbackSorted();
  }
}

/**
 * ⚡ Paged listing query for high-traffic listing routes.
 * Fetches only the requested page instead of the full table to reduce Worker CPU.
 */
export async function getSkillsListingPage(env: Env, page: number, pageSize: number): Promise<SkillsListingPageResult> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 100) : 12;
  const offset = (safePage - 1) * safePageSize;
  const pageCacheKey = `${safePage}:${safePageSize}`;

  const cachedPage = getTimedMapValue(_skillsListingPageCache, pageCacheKey, SKILLS_LISTING_PAGE_CACHE_TTL_MS);
  if (cachedPage) {
    return {
      ...cachedPage,
      items: cloneListingItems(cachedPage.items),
    };
  }

  if (!env?.DB) {
    const normalized = await getLocalListingFallbackSorted();
    const fallbackResult: SkillsListingPageResult = {
      items: normalized.slice(offset, offset + safePageSize),
      total: normalized.length,
      page: safePage,
      pageSize: safePageSize,
    };
    setTimedMapValue(_skillsListingPageCache, pageCacheKey, fallbackResult, SKILLS_LISTING_PAGE_CACHE_MAX);

    return {
      ...fallbackResult,
      items: cloneListingItems(fallbackResult.items),
    };
  }

  try {
    let total = getTimedValue(_skillsTotalCountCache, SKILLS_TOTAL_COUNT_CACHE_TTL_MS);
    if (total === null) {
      const totalResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM skills`).first();
      total = Number((totalResult as D1Row | null)?.total ?? 0);
      _skillsTotalCountCache = { value: total, ts: Date.now() };
    }

    if (total === 0) {
      const normalized = await getLocalListingFallbackSorted();
      const fallbackResult: SkillsListingPageResult = {
        items: normalized.slice(offset, offset + safePageSize),
        total: normalized.length,
        page: safePage,
        pageSize: safePageSize,
      };
      setTimedMapValue(_skillsListingPageCache, pageCacheKey, fallbackResult, SKILLS_LISTING_PAGE_CACHE_MAX);
      return {
        ...fallbackResult,
        items: cloneListingItems(fallbackResult.items),
      };
    }

    const result = await env.DB.prepare(
      `
            SELECT
                id,
                owner,
                repo,
                name,
                category,
                stars,
                quality_score,
                COALESCE(
                  NULLIF(UPPER(TRIM(CAST(security_level AS TEXT))), ''),
                  UPPER(CAST(json_extract(data_json, '$.securityLevel') AS TEXT))
                ) as security_level,
                COALESCE(
                  NULLIF(UPPER(TRIM(CAST(source_trust AS TEXT))), ''),
                  UPPER(CAST(json_extract(data_json, '$.sourceTrust') AS TEXT))
                ) as source_trust,
                rank_score,
                last_audited_at,
                updated_at,
                json_extract(data_json, '$.skillName') as skillName,
                json_extract(data_json, '$.description') as description,
                json_extract(data_json, '$.topics') as topics,
                json_extract(data_json, '$.source') as source,
                json_extract(data_json, '$.qualityScore') as qualityScore,
                json_extract(data_json, '$.securityScore') as securityScore,
                json_extract(data_json, '$.sourceScore') as sourceScore,
                json_extract(data_json, '$.isTrustedRankingEligible') as isTrustedRankingEligible,
                json_extract(data_json, '$.riskFlags') as riskFlags,
                json_extract(data_json, '$.securityBrief') as securityBrief,
                json_extract(data_json, '$.primaryTrustReason') as primaryTrustReason,
                json_extract(data_json, '$.filePath') as filePath,
                json_extract(data_json, '$.seo.definition') as seoDefinition
            FROM skills
            ORDER BY COALESCE(rank_score, quality_score, 0) DESC, stars DESC
            LIMIT ?1 OFFSET ?2
        `,
    )
      .bind(safePageSize, offset)
      .all<D1Row>();

    const items = result.success && result.results ? getD1Rows(result).map((row: D1Row) => mapD1ListingRow(row)) : [];
    if (items.length === 0 && safePage === 1) {
      const normalized = await getLocalListingFallbackSorted();
      const fallbackResult: SkillsListingPageResult = {
        items: normalized.slice(offset, offset + safePageSize),
        total: normalized.length,
        page: safePage,
        pageSize: safePageSize,
      };
      setTimedMapValue(_skillsListingPageCache, pageCacheKey, fallbackResult, SKILLS_LISTING_PAGE_CACHE_MAX);
      return {
        ...fallbackResult,
        items: cloneListingItems(fallbackResult.items),
      };
    }

    const pagedResult: SkillsListingPageResult = { items, total, page: safePage, pageSize: safePageSize };
    setTimedMapValue(_skillsListingPageCache, pageCacheKey, pagedResult, SKILLS_LISTING_PAGE_CACHE_MAX);
    return { ...pagedResult, items: cloneListingItems(pagedResult.items) };
  } catch (e) {
    logD1Fallback('Error in paged listing query', e);
    const normalized = await getLocalListingFallbackSorted();
    const fallbackResult: SkillsListingPageResult = {
      items: normalized.slice(offset, offset + safePageSize),
      total: normalized.length,
      page: safePage,
      pageSize: safePageSize,
    };
    return {
      ...fallbackResult,
      items: cloneListingItems(fallbackResult.items),
    };
  }
}

/**
 * Policy-aware paged listing query for the public marketplace API.
 * Restricts the DB page and total count to admitted marketplace rows.
 */
export async function getMarketplaceSkillsListingPage(
  env: Env,
  page: number,
  pageSize: number,
): Promise<SkillsListingPageResult> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 100) : 12;
  const offset = (safePage - 1) * safePageSize;
  const pageCacheKey = `${safePage}:${safePageSize}`;

  const cachedPage = getTimedMapValue(
    _marketplaceSkillsListingPageCache,
    pageCacheKey,
    SKILLS_LISTING_PAGE_CACHE_TTL_MS,
  );
  if (cachedPage) {
    return {
      ...cachedPage,
      items: cloneListingItems(cachedPage.items),
    };
  }

  const getFallbackPage = async (): Promise<SkillsListingPageResult> => {
    const admitted = (await getLocalListingFallbackSorted()).filter(isMarketplaceListingAdmitted);
    return {
      items: admitted.slice(offset, offset + safePageSize),
      total: admitted.length,
      page: safePage,
      pageSize: safePageSize,
    };
  };

  if (!env?.DB) {
    const fallbackResult = await getFallbackPage();
    setTimedMapValue(
      _marketplaceSkillsListingPageCache,
      pageCacheKey,
      fallbackResult,
      MARKETPLACE_SKILLS_LISTING_PAGE_CACHE_MAX,
    );
    return {
      ...fallbackResult,
      items: cloneListingItems(fallbackResult.items),
    };
  }

  try {
    let total = getTimedValue(_marketplaceSkillsTotalCountCache, SKILLS_TOTAL_COUNT_CACHE_TTL_MS);
    if (total === null) {
      const totalResult = await env.DB.prepare(
        `SELECT COUNT(*) as total FROM skills ${MARKETPLACE_ADMISSION_WHERE_SQL}`,
      ).first();
      total = Number((totalResult as D1Row | null)?.total ?? 0);
      _marketplaceSkillsTotalCountCache = { value: total, ts: Date.now() };
    }

    const result = await env.DB.prepare(
      `
            SELECT
                id,
                owner,
                repo,
                name,
                category,
                stars,
                quality_score,
                COALESCE(
                  NULLIF(UPPER(TRIM(CAST(security_level AS TEXT))), ''),
                  UPPER(CAST(json_extract(data_json, '$.securityLevel') AS TEXT))
                ) as security_level,
                COALESCE(
                  NULLIF(UPPER(TRIM(CAST(source_trust AS TEXT))), ''),
                  UPPER(CAST(json_extract(data_json, '$.sourceTrust') AS TEXT))
                ) as source_trust,
                rank_score,
                last_audited_at,
                updated_at,
                json_extract(data_json, '$.skillName') as skillName,
                json_extract(data_json, '$.description') as description,
                json_extract(data_json, '$.topics') as topics,
                json_extract(data_json, '$.source') as source,
                json_extract(data_json, '$.qualityScore') as qualityScore,
                json_extract(data_json, '$.securityScore') as securityScore,
                json_extract(data_json, '$.sourceScore') as sourceScore,
                json_extract(data_json, '$.isTrustedRankingEligible') as isTrustedRankingEligible,
                json_extract(data_json, '$.riskFlags') as riskFlags,
                json_extract(data_json, '$.securityBrief') as securityBrief,
                json_extract(data_json, '$.primaryTrustReason') as primaryTrustReason,
                json_extract(data_json, '$.filePath') as filePath,
                json_extract(data_json, '$.seo.definition') as seoDefinition
            FROM skills
            ${MARKETPLACE_ADMISSION_WHERE_SQL}
            ORDER BY COALESCE(rank_score, quality_score, 0) DESC, stars DESC
            LIMIT ?1 OFFSET ?2
        `,
    )
      .bind(safePageSize, offset)
      .all<D1Row>();

    const items = result.success && result.results ? getD1Rows(result).map((row: D1Row) => mapD1ListingRow(row)) : [];
    const pagedResult: SkillsListingPageResult = { items, total, page: safePage, pageSize: safePageSize };
    setTimedMapValue(
      _marketplaceSkillsListingPageCache,
      pageCacheKey,
      pagedResult,
      MARKETPLACE_SKILLS_LISTING_PAGE_CACHE_MAX,
    );
    return { ...pagedResult, items: cloneListingItems(pagedResult.items) };
  } catch (e) {
    logD1Fallback('Error in marketplace paged listing query', e);
    const fallbackResult = await getFallbackPage();
    return {
      ...fallbackResult,
      items: cloneListingItems(fallbackResult.items),
    };
  }
}

/**
 * Lightweight top-N listing query.
 * Used by crawler-safe pages that need intent matching without full-table scans.
 */
export async function getSkillsListingTop(env: Env, limit: number): Promise<SkillListingItem[]> {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 500) : 120;
  const topCacheKey = `top:${safeLimit}`;
  const cachedTop = getTimedMapValue(_skillsListingTopCache, topCacheKey, SKILLS_LISTING_TOP_CACHE_TTL_MS);
  if (cachedTop) return cloneListingItems(cachedTop);

  if (!env?.DB) {
    const fallbackTop = await getLocalListingFallbackSorted(safeLimit);
    setTimedMapValue(_skillsListingTopCache, topCacheKey, fallbackTop, SKILLS_LISTING_TOP_CACHE_MAX);
    return cloneListingItems(fallbackTop);
  }

  try {
    const result = await env.DB.prepare(
      `
            SELECT
                id,
                owner,
                repo,
                name,
                category,
                stars,
                quality_score,
                security_level,
                source_trust,
                rank_score,
                last_audited_at,
                updated_at,
                json_extract(data_json, '$.skillName') as skillName,
                json_extract(data_json, '$.description') as description,
                json_extract(data_json, '$.topics') as topics,
                json_extract(data_json, '$.source') as source,
                json_extract(data_json, '$.qualityScore') as qualityScore,
                json_extract(data_json, '$.securityScore') as securityScore,
                json_extract(data_json, '$.sourceScore') as sourceScore,
                json_extract(data_json, '$.isTrustedRankingEligible') as isTrustedRankingEligible,
                json_extract(data_json, '$.riskFlags') as riskFlags,
                json_extract(data_json, '$.securityBrief') as securityBrief,
                json_extract(data_json, '$.primaryTrustReason') as primaryTrustReason,
                json_extract(data_json, '$.filePath') as filePath,
                json_extract(data_json, '$.seo.definition') as seoDefinition
            FROM skills
            ORDER BY COALESCE(rank_score, quality_score, 0) DESC, stars DESC
            LIMIT ?1
        `,
    )
      .bind(safeLimit)
      .all<D1Row>();

    if (!result.success || !result.results) {
      const fallbackTop = await getLocalListingFallbackSorted(safeLimit);
      setTimedMapValue(_skillsListingTopCache, topCacheKey, fallbackTop, SKILLS_LISTING_TOP_CACHE_MAX);
      return cloneListingItems(fallbackTop);
    }
    const rows = getD1Rows(result).map((row: D1Row) => mapD1ListingRow(row));
    if (rows.length === 0) {
      const fallbackTop = await getLocalListingFallbackSorted(safeLimit);
      setTimedMapValue(_skillsListingTopCache, topCacheKey, fallbackTop, SKILLS_LISTING_TOP_CACHE_MAX);
      return cloneListingItems(fallbackTop);
    }
    setTimedMapValue(_skillsListingTopCache, topCacheKey, rows, SKILLS_LISTING_TOP_CACHE_MAX);
    return cloneListingItems(rows);
  } catch (e) {
    logD1Fallback('Error in top listing query', e);
    const fallbackTop = await getLocalListingFallbackSorted(safeLimit);
    setTimedMapValue(_skillsListingTopCache, topCacheKey, fallbackTop, SKILLS_LISTING_TOP_CACHE_MAX);
    return cloneListingItems(fallbackTop);
  }
}

/**
 * Lightweight category aggregation query for category landing pages.
 * Avoids loading full skill rows when only counts are needed.
 */
export async function getSkillsCategorySummary(env: Env): Promise<SkillsCategorySummary> {
  const cachedSummary = getTimedValue(_skillsCategorySummaryCache, SKILLS_CATEGORY_SUMMARY_CACHE_TTL_MS);
  if (cachedSummary) return cloneCategorySummary(cachedSummary);

  if (!env?.DB) {
    const fallbackSummary = await getLocalCategorySummary();
    _skillsCategorySummaryCache = { value: fallbackSummary, ts: Date.now() };
    return cloneCategorySummary(fallbackSummary);
  }

  try {
    const [totalResult, groupedResult] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) as total FROM skills`).first(),
      env.DB.prepare(
        `
          SELECT
            TRIM(LOWER(COALESCE(category, ''))) as category,
            COUNT(*) as count
          FROM skills
          GROUP BY TRIM(LOWER(COALESCE(category, '')))
        `,
      ).all<D1Row>(),
    ]);

    const total = Number((totalResult as D1Row | null)?.total ?? 0);
    const categories =
      groupedResult.success && groupedResult.results
        ? getD1Rows(groupedResult)
            .map((row: D1Row) => ({
              category: String(row.category || '')
                .trim()
                .toLowerCase(),
              count: Number(row.count || 0),
            }))
            .filter((item: SkillsCategoryCountItem) => item.count > 0)
            .sort((a: SkillsCategoryCountItem, b: SkillsCategoryCountItem) => b.count - a.count)
        : [];

    if (total === 0 || categories.length === 0) {
      const fallbackSummary = await getLocalCategorySummary();
      _skillsCategorySummaryCache = { value: fallbackSummary, ts: Date.now() };
      return cloneCategorySummary(fallbackSummary);
    }

    const summary: SkillsCategorySummary = { total, categories };
    _skillsCategorySummaryCache = { value: summary, ts: Date.now() };
    return cloneCategorySummary(summary);
  } catch (e) {
    logD1Fallback('Error in category summary query', e);
    const fallbackSummary = await getLocalCategorySummary();
    _skillsCategorySummaryCache = { value: fallbackSummary, ts: Date.now() };
    return cloneCategorySummary(fallbackSummary);
  }
}

/**
 * Fetch listing rows for a specific owner/repo set.
 * Used by collection pages to avoid full-table scans.
 */
export async function getSkillsListingByRefs(env: Env, skillRefs: string[]): Promise<SkillListingItem[]> {
  const parsedRefs = Array.from(
    new Set(
      skillRefs
        .map((ref) => String(ref || '').trim())
        .filter(Boolean)
        .map((ref) => ref.toLowerCase()),
    ),
  )
    .map((ref) => ref.split('/'))
    .filter((parts) => parts.length >= 2)
    .map((parts) => [parts[0], parts[1]] as const);

  if (parsedRefs.length === 0) return [];
  const refsCacheKey = parsedRefs
    .map(([owner, repo]) => `${owner}/${repo}`)
    .sort()
    .join('|');
  const cachedRefs = getTimedMapValue(_skillsListingByRefsCache, refsCacheKey, SKILLS_LISTING_BY_REFS_CACHE_TTL_MS);
  if (cachedRefs) return cloneListingItems(cachedRefs);

  const getRefsFallback = async () => {
    const wanted = new Set(parsedRefs.map(([owner, repo]) => `${owner}/${repo}`));
    const all = await getLocalSkillsFallback();
    const fallbackRows = all
      .filter((row) => wanted.has(`${String(row.owner || '').toLowerCase()}/${String(row.repo || '').toLowerCase()}`))
      .map((row) => mapLocalListingRow(row as unknown as Record<string, unknown>))
      .sort(sortListingByTrust);
    setTimedMapValue(_skillsListingByRefsCache, refsCacheKey, fallbackRows, SKILLS_LISTING_BY_REFS_CACHE_MAX);
    return cloneListingItems(fallbackRows);
  };

  if (!env?.DB) {
    return getRefsFallback();
  }

  const CHUNK_SIZE = 80;
  const deduped = new Map<string, SkillListingItem>();

  for (let start = 0; start < parsedRefs.length; start += CHUNK_SIZE) {
    const chunk = parsedRefs.slice(start, start + CHUNK_SIZE);
    const predicates = chunk.map(() => `(owner = ? AND repo = ?)`).join(' OR ');
    const binds = chunk.flatMap(([owner, repo]) => [owner, repo]);

    try {
      const result = await env.DB.prepare(
        `
            SELECT
                id,
                owner,
                repo,
                name,
                category,
                stars,
                quality_score,
                security_level,
                source_trust,
                rank_score,
                last_audited_at,
                updated_at,
                json_extract(data_json, '$.skillName') as skillName,
                json_extract(data_json, '$.description') as description,
                json_extract(data_json, '$.topics') as topics,
                json_extract(data_json, '$.source') as source,
                json_extract(data_json, '$.qualityScore') as qualityScore,
                json_extract(data_json, '$.securityScore') as securityScore,
                json_extract(data_json, '$.sourceScore') as sourceScore,
                json_extract(data_json, '$.isTrustedRankingEligible') as isTrustedRankingEligible,
                json_extract(data_json, '$.riskFlags') as riskFlags,
                json_extract(data_json, '$.securityBrief') as securityBrief,
                json_extract(data_json, '$.primaryTrustReason') as primaryTrustReason,
                json_extract(data_json, '$.filePath') as filePath,
                json_extract(data_json, '$.seo.definition') as seoDefinition
            FROM skills
            WHERE ${predicates}
        `,
      )
        .bind(...binds)
        .all<D1Row>();

      if (!result.success || !result.results) continue;

      for (const row of getD1Rows(result)) {
        const mapped = mapD1ListingRow(row);
        if (mapped.id) {
          deduped.set(mapped.id, mapped);
        }
      }
    } catch (e) {
      logD1Fallback('Error in listing-by-refs query', e);
    }
  }

  const matched = Array.from(deduped.values());
  if (matched.length === 0) {
    return getRefsFallback();
  }

  setTimedMapValue(_skillsListingByRefsCache, refsCacheKey, matched, SKILLS_LISTING_BY_REFS_CACHE_MAX);
  return cloneListingItems(matched);
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
  limit: number = 4,
  currentOwner = '',
  currentRepo = '',
): Promise<SkillListingItem[]> {
  const getRelatedFallback = async () => {
    const all = await getLocalSkillsFallback();
    return all
      .filter((s) => s.category === category && s.id !== currentId)
      .map((row) => mapLocalListingRow(row as unknown as Record<string, unknown>))
      .sort(sortListingByTrust)
      .slice(0, limit);
  };

  if (!env?.DB) {
    return getRelatedFallback();
  }

  try {
    const hasCategory = Boolean(category);
    const query = hasCategory
      ? `
            SELECT
                id, owner, repo, name, category, stars, quality_score,
                security_level, source_trust, rank_score, last_audited_at, updated_at,
                json_extract(data_json, '$.skillName') as skillName,
                json_extract(data_json, '$.description') as description,
                json_extract(data_json, '$.topics') as topics,
                json_extract(data_json, '$.qualityScore') as qualityScore,
                json_extract(data_json, '$.source') as source,
                json_extract(data_json, '$.securityScore') as securityScore,
                json_extract(data_json, '$.sourceScore') as sourceScore,
                json_extract(data_json, '$.isTrustedRankingEligible') as isTrustedRankingEligible,
                json_extract(data_json, '$.riskFlags') as riskFlags,
                json_extract(data_json, '$.securityBrief') as securityBrief,
                json_extract(data_json, '$.primaryTrustReason') as primaryTrustReason,
                json_extract(data_json, '$.filePath') as filePath,
                json_extract(data_json, '$.seo.definition') as seoDefinition
            FROM skills 
            WHERE category = ?1 AND id != ?2
              AND NOT (owner = ?3 AND repo = ?4)
            ORDER BY COALESCE(rank_score, quality_score, 0) DESC, stars DESC
            LIMIT ?5
        `
      : `
            SELECT
                id, owner, repo, name, category, stars, quality_score,
                security_level, source_trust, rank_score, last_audited_at, updated_at,
                json_extract(data_json, '$.skillName') as skillName,
                json_extract(data_json, '$.description') as description,
                json_extract(data_json, '$.topics') as topics,
                json_extract(data_json, '$.qualityScore') as qualityScore,
                json_extract(data_json, '$.source') as source,
                json_extract(data_json, '$.securityScore') as securityScore,
                json_extract(data_json, '$.sourceScore') as sourceScore,
                json_extract(data_json, '$.isTrustedRankingEligible') as isTrustedRankingEligible,
                json_extract(data_json, '$.riskFlags') as riskFlags,
                json_extract(data_json, '$.securityBrief') as securityBrief,
                json_extract(data_json, '$.primaryTrustReason') as primaryTrustReason,
                json_extract(data_json, '$.filePath') as filePath,
                json_extract(data_json, '$.seo.definition') as seoDefinition
            FROM skills
            WHERE id != ?1
              AND NOT (owner = ?2 AND repo = ?3)
            ORDER BY COALESCE(rank_score, quality_score, 0) DESC, stars DESC
            LIMIT ?4
        `;
    const statement = env.DB.prepare(query);
    const result = hasCategory
      ? await statement.bind(category, currentId, currentOwner, currentRepo, limit).all<D1Row>()
      : await statement.bind(currentId, currentOwner, currentRepo, limit).all<D1Row>();

    if (result.success && result.results) {
      return getD1Rows(result).map((row: D1Row): SkillListingItem => mapD1ListingRow(row));
    }
    return [];
  } catch (e) {
    logD1Fallback('Error in related skills query', e);
    return [];
  }
}

/** Safe JSON parse helper — returns fallback if parse fails */
function tryParseJSON<T>(str: string, fallback: T): T {
  if (typeof str !== 'string') return str; // Already parsed
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function parseD1Boolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0' || normalized === '') return false;
    return Boolean(tryParseJSON(normalized, fallback));
  }
  return fallback;
}

function parseOptionalD1Boolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  return parseD1Boolean(value, false);
}

function normalizeMarketplaceCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function isMarketplaceFalseLikeValue(value: unknown): boolean {
  if (value === false || value === 0) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '0' || normalized === 'false';
  }
  return false;
}

function hasMarketplaceBlockerRisk(flags: SkillListingItem['riskFlags']): boolean {
  return (flags || []).some(
    (flag) => typeof flag?.severity === 'string' && flag.severity.trim().toLowerCase() === 'blocker',
  );
}

function isMarketplaceListingAdmitted(item: SkillListingItem): boolean {
  const securityLevel = normalizeMarketplaceCode(item.securityLevel);
  const sourceTrust = normalizeMarketplaceCode(item.sourceTrust);

  if (securityLevel === 'D') return false;
  if (sourceTrust !== 'T1' && sourceTrust !== 'T2') return false;
  if (isMarketplaceFalseLikeValue(item.isTrustedRankingEligible)) return false;
  if (hasMarketplaceBlockerRisk(item.riskFlags)) return false;
  return true;
}

function hasNonEmptyValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function hasPersistedTrustFields(row: Record<string, unknown>): boolean {
  return (
    hasNonEmptyValue(row.securityLevel ?? row.security_level) &&
    hasNonEmptyValue(row.sourceTrust ?? row.source_trust) &&
    hasNonEmptyValue(row.rankScore ?? row.rank_score)
  );
}

function withTrustFallback(item: SkillListingItem, row: Record<string, unknown>): SkillListingItem {
  if (hasPersistedTrustFields(row)) return item;

  return {
    ...item,
    ...assessSkillTrust({
      id: item.id,
      name: item.name,
      owner: item.owner,
      repo: item.repo,
      source: item.source,
      stars: item.stars,
      forks: item.forks,
      updatedAt: item.updatedAt,
      lastSynced: String(row.lastSynced ?? row.last_synced ?? ''),
      topics: item.topics,
      filePath: item.filePath,
      category: item.category,
      description: item.description,
      skillMd: (row.skillMd as SkillListingItem['skillMd']) || undefined,
    }),
  };
}

function mapD1ListingRow(row: D1Row): SkillListingItem {
  const item: SkillListingItem = {
    id: String(row.id ?? ''),
    name: String(row.name ?? row.skillName ?? row.repo ?? ''),
    skillName: String(row.skillName ?? row.name ?? ''),
    owner: String(row.owner ?? ''),
    repo: String(row.repo ?? ''),
    description: row.description ? tryParseJSON(String(row.description), String(row.description)) : '',
    category: String(row.category ?? ''),
    topics: row.topics ? tryParseJSON(String(row.topics), []) : [],
    stars: Number(row.stars ?? 0),
    source: String(row.source ?? 'cache') as SkillListingItem['source'],
    updatedAt: String(row.updated_at ?? ''),
    qualityScore: Number(row.qualityScore ?? row.quality_score ?? 0),
    securityLevel: String(row.security_level ?? row.securityLevel ?? 'C') as SkillListingItem['securityLevel'],
    sourceTrust: String(row.source_trust ?? row.sourceTrust ?? 'T3') as SkillListingItem['sourceTrust'],
    securityScore: Number(row.securityScore ?? row.security_score ?? 0),
    sourceScore: Number(row.sourceScore ?? row.source_score ?? 0),
    rankScore: Number(row.rank_score ?? row.rankScore ?? row.qualityScore ?? row.quality_score ?? 0),
    isTrustedRankingEligible: parseOptionalD1Boolean(row.isTrustedRankingEligible),
    riskFlags: row.riskFlags ? tryParseJSON(String(row.riskFlags), []) : [],
    securityBrief: String(row.securityBrief ?? ''),
    primaryTrustReason: String(row.primaryTrustReason ?? ''),
    lastAuditedAt: String(row.last_audited_at ?? row.lastAuditedAt ?? ''),
    filePath: String(row.filePath ?? ''),
    seo: row.seoDefinition ? { definition: tryParseJSON(String(row.seoDefinition), {}) } : undefined,
  };

  return withTrustFallback(item, row);
}

function mapLocalListingRow(row: Record<string, unknown>): SkillListingItem {
  const item: SkillListingItem = {
    id: String(row.id ?? ''),
    name: String(row.name ?? row.skillName ?? row.repo ?? ''),
    skillName: String(row.skillName ?? row.name ?? ''),
    owner: String(row.owner ?? ''),
    repo: String(row.repo ?? ''),
    description: (row.description as SkillListingItem['description']) || '',
    category: String(row.category ?? ''),
    topics: (row.topics as string[]) || [],
    stars: Number(row.stars ?? 0),
    source: String(row.source ?? 'cache') as SkillListingItem['source'],
    updatedAt: String(row.updatedAt ?? row.updated_at ?? ''),
    qualityScore: Number(row.qualityScore ?? row.quality_score ?? 0),
    securityLevel: String(row.securityLevel ?? row.security_level ?? 'C') as SkillListingItem['securityLevel'],
    sourceTrust: String(row.sourceTrust ?? row.source_trust ?? 'T3') as SkillListingItem['sourceTrust'],
    securityScore: Number(row.securityScore ?? row.security_score ?? 0),
    sourceScore: Number(row.sourceScore ?? row.source_score ?? 0),
    rankScore: Number(row.rankScore ?? row.rank_score ?? row.qualityScore ?? row.quality_score ?? 0),
    isTrustedRankingEligible: parseOptionalD1Boolean(row.isTrustedRankingEligible),
    riskFlags: (row.riskFlags as SkillListingItem['riskFlags']) || [],
    securityBrief: String(row.securityBrief ?? ''),
    primaryTrustReason: String(row.primaryTrustReason ?? ''),
    lastAuditedAt: String(row.lastAuditedAt ?? row.last_audited_at ?? ''),
    filePath: String(row.filePath ?? ''),
    seo: (row.seo as SkillListingItem['seo']) || undefined,
  };

  return withTrustFallback(item, row);
}

/**
 * Read a specific key from D1 namespace as JSON.
 * Supports exact ID match and fuzzy match for multi-segment IDs.
 * Usage: await getSkillsKV(context.locals.runtime.env, 'some-key')
 */
export async function getSkillsKV(env: Env, key: string): Promise<any | null> {
  const lookupLocalSkill = async (rawKey: string): Promise<any | null> => {
    const all = await getLocalSkillsFallback();
    let dbId = rawKey;
    if (rawKey.startsWith('skill:')) {
      dbId = rawKey.substring(6);
    }

    const dbIdLower = dbId.toLowerCase();
    let match = all.find((s) => String(s.id || '').toLowerCase() === dbIdLower);
    if (match) return match;

    const segments = dbId.split('/');
    if (segments.length >= 2) {
      const owner = segments[0].toLowerCase();
      const repo = segments[1].toLowerCase();

      // IMPORTANT: only owner/repo lookups are allowed to fall back to owner+repo.
      // For sub-skill lookups (owner/repo/sub-skill), we must not return a random sibling
      // because that creates false-positive 200 pages for non-existent URLs.
      if (segments.length === 2) {
        match = all.find(
          (s) => String(s.owner || '').toLowerCase() === owner && String(s.repo || '').toLowerCase() === repo,
        );
        if (match) return match;
      }
    }

    return null;
  };

  if (!env?.DB) {
    console.warn(`[D1] No DB binding for specific key lookup ${key}, using local cache`);
    return lookupLocalSkill(key);
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

    // 2. Allow owner+repo fallback ONLY for 2-segment IDs.
    // For 3+ segment IDs (owner/repo/sub-skill), return null if exact ID is missing.
    // This prevents invalid sub-skill paths from resolving to unrelated siblings.
    const segments = dbId.split('/');
    if (segments.length >= 2) {
      const owner = segments[0];
      const repo = segments[1];

      if (segments.length === 2) {
        // 3. Try owner+repo index match (uses idx_skills_owner_repo)
        const repoResult = await env.DB.prepare(`SELECT data_json FROM skills WHERE owner = ? AND repo = ? LIMIT 1`)
          .bind(owner, repo)
          .first();
        if (repoResult && repoResult.data_json) {
          return JSON.parse(repoResult.data_json as string);
        }
      }
    }

    return null;
  } catch (e) {
    console.error(`[D1] Error querying skill key "${key}":`, e);
    console.warn(`[D1] Falling back to local skills cache for ${key}`);
    return lookupLocalSkill(key);
  }
}

/**
 * Read sitemap skills data from SKILLS_CACHE KV namespace.
 * Filters out any entries with missing owner/repo to prevent undefined URLs.
 * usage: await getSitemapSkillsFromKV(context.locals.runtime.env)
 */
export async function getSitemapSkillsFromKV(env: Env): Promise<SitemapSkillEntry[]> {
  if (_sitemapSkillsCache && Date.now() - _sitemapSkillsCacheTime < SITEMAP_SKILLS_CACHE_TTL_MS) {
    return _sitemapSkillsCache;
  }

  const GITHUB_OWNER_RE = /^[a-z\d](?:[a-z\d-]{0,38})$/i;
  const GITHUB_REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
  const MIN_INDEXABLE_SKILL_README_BYTES = 250;
  const textEncoder = new TextEncoder();

  const parseDateMs = (value?: string): number => {
    if (!value) return 0;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
  };

  const getReadmeContent = (raw: unknown): string => {
    if (!raw || typeof raw !== 'object') return '';

    const obj = raw as Record<string, unknown>;
    if (typeof obj.skillBody === 'string' && obj.skillBody.trim().length > 0) {
      return obj.skillBody;
    }

    if (typeof obj.skillBodyPreview === 'string' && obj.skillBodyPreview.trim().length > 0) {
      return obj.skillBodyPreview;
    }

    const skillMd = obj.skillMd;
    if (skillMd && typeof skillMd === 'object') {
      const sm = skillMd as Record<string, unknown>;
      if (typeof sm.body === 'string' && sm.body.trim().length > 0) {
        return sm.body;
      }

      if (typeof sm.bodyPreview === 'string' && sm.bodyPreview.trim().length > 0) {
        return sm.bodyPreview;
      }
    }

    return '';
  };

  const parsePossiblyJsonString = (value: unknown): unknown => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  };

  const pickText = (value: unknown): string => {
    const parsed = parsePossiblyJsonString(value);
    if (typeof parsed === 'string') return parsed.trim();
    if (!parsed || typeof parsed !== 'object') return '';

    const record = parsed as Record<string, unknown>;
    const preferred = [record.en, record.zh, ...Object.values(record)];
    for (const candidate of preferred) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
    return '';
  };

  const getFallbackDescription = (raw: unknown): string => {
    const obj = raw as Record<string, unknown> | null;
    const candidates = [
      obj?.descriptionEn,
      obj?.seoDefinitionEn,
      obj?.descriptionRaw,
      obj?.seoDefinitionRaw,
      obj?.description,
      (obj?.seo as Record<string, unknown>)?.definition,
    ];

    for (const candidate of candidates) {
      const text = pickText(candidate);
      if (text) return text;
    }
    return '';
  };

  const isIndexableByReadme = (raw: unknown): boolean => {
    const content = getReadmeContent(raw);
    const contentSize = content ? textEncoder.encode(content).length : 0;
    if (content && contentSize >= MIN_INDEXABLE_SKILL_README_BYTES) {
      return true;
    }

    const fallbackDescription = getFallbackDescription(raw);
    if (!fallbackDescription) return false;

    const obj = raw as Record<string, unknown> | null;
    const skillName = pickText(obj?.skillName) || String(obj?.repo ?? 'Skill');
    const synthesizedContent = [content, `# ${skillName}\n\n${fallbackDescription}`]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .join('\n\n');
    return textEncoder.encode(synthesizedContent).length >= MIN_INDEXABLE_SKILL_README_BYTES;
  };

  // Tier 1 gate: only Tier 1 skills belong in the sitemap. Verified repos
  // bypass the stars threshold; non-official skills need stars >= 50 and
  // qualityScore >= 55 on top of the existing indexability gate.
  const parseD1Value = (value: unknown): unknown => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"'))
      ) {
        try {
          return JSON.parse(trimmed);
        } catch {
          return trimmed;
        }
      }
      // D1 json_extract returns numbers/booleans as strings
      if (trimmed === 'true') return true;
      if (trimmed === 'false') return false;
      if (/^-?\d+\.?\d*$/.test(trimmed)) return Number(trimmed);
    }
    return value;
  };

  const isTier1SitemapCandidate = (raw: unknown): boolean => {
    if (!raw || typeof raw !== 'object') return false;
    const obj = raw as Record<string, unknown>;

    const qualityScore =
      typeof obj.qualityScore === 'number' ? obj.qualityScore : Number(parseD1Value(obj.qualityScore)) || 0;
    const verified = Boolean(obj.verified ?? parseD1Value(obj.verified));
    const stars = typeof obj.stars === 'number' ? obj.stars : Number(parseD1Value(obj.stars)) || 0;

    // Use the same readme synthesis logic as isIndexableByReadme, which
    // combines body + fallback description for the source evidence check.
    let readmeContent = getReadmeContent(obj);
    if (!readmeContent || textEncoder.encode(readmeContent).length < MIN_INDEXABLE_SKILL_README_BYTES) {
      const fallbackDescription = getFallbackDescription(obj);
      const skillName = pickText(obj.skillName) || String(obj.repo ?? 'Skill');
      const synthesized = [readmeContent, `# ${skillName}\n\n${fallbackDescription}`]
        .filter((part) => typeof part === 'string' && part.trim().length > 0)
        .join('\n\n');
      if (textEncoder.encode(synthesized).length >= MIN_INDEXABLE_SKILL_README_BYTES) {
        readmeContent = synthesized;
      }
    }

    const assessment = buildSkillIndexabilityAssessment(
      {
        qualityScore,
        verified,
        stars,
        agentAnalysis: parseD1Value(obj.agentAnalysis) as any,
        seo: parseD1Value(obj.seo) as any,
        readmeContent,
        localeGovernance: { isIndexableLocale: true, canonicalLocale: 'en', detectedBodyLocale: 'en' },
      },
      'en',
    );

    return assessment.tier === 1;
  };

  // Normalize, validate, and dedupe by canonical skill route.
  // If duplicates exist, keep the newest updatedAt.
  const normalizeAndDedupe = (items: unknown[], options?: { skipReadmeFilter?: boolean }): SitemapSkillEntry[] => {
    const deduped = new Map<string, SitemapSkillEntry>();

    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;
      const obj = raw as Record<string, unknown>;
      if (!options?.skipReadmeFilter && !isIndexableByReadme(obj)) continue;

      const owner = typeof obj.owner === 'string' ? obj.owner.trim() : '';
      const repo = typeof obj.repo === 'string' ? obj.repo.trim() : '';
      if (!owner || !repo) continue;
      if (!GITHUB_OWNER_RE.test(owner) || !GITHUB_REPO_RE.test(repo)) continue;
      if (!isPublicSitemapSkillCandidate(obj)) continue;

      // Tier 1 gate — only high-quality skills enter the sitemap
      if (!options?.skipReadmeFilter && !isTier1SitemapCandidate(obj)) continue;

      const normalized = normalizeSitemapSkillEntry(obj);
      if (!normalized) continue;

      const key = `${normalized.owner.toLowerCase()}/${normalized.routePath.toLowerCase()}`;
      const current = deduped.get(key);

      if (!current || parseDateMs(normalized.updatedAt) > parseDateMs(current.updatedAt)) {
        deduped.set(key, normalized);
      }
    }

    return Array.from(deduped.values()).sort((a, b) => parseDateMs(b.updatedAt) - parseDateMs(a.updatedAt));
  };

  // Primary: Query D1
  if (env?.DB) {
    try {
      const result = await env.DB.prepare(
        `SELECT
            id,
            owner,
            repo,
            updated_at as updatedAt,
            json_extract(data_json, '$.skillMd.body') as skillBody,
            json_extract(data_json, '$.skillMd.bodyPreview') as skillBodyPreview,
            json_extract(data_json, '$.name') as skillName,
            json_extract(data_json, '$.description.en') as descriptionEn,
            json_extract(data_json, '$.description') as descriptionRaw,
            json_extract(data_json, '$.seo.definition.en') as seoDefinitionEn,
            json_extract(data_json, '$.seo.definition') as seoDefinitionRaw,
            json_extract(data_json, '$.topics') as topicsRaw,
            json_extract(data_json, '$.category') as category,
            json_extract(data_json, '$.filePath') as filePath,
            json_extract(data_json, '$.stars') as stars,
            json_extract(data_json, '$.qualityScore') as qualityScore,
            json_extract(data_json, '$.verified') as verified,
            json_extract(data_json, '$.agentAnalysis') as agentAnalysis,
            json_extract(data_json, '$.seo') as seo
         FROM skills
         WHERE owner IS NOT NULL AND repo IS NOT NULL`,
      ).all();
      if (result.success && result.results) {
        const normalized = normalizeAndDedupe(result.results as unknown[]);
        _sitemapSkillsCache = normalized;
        _sitemapSkillsCacheTime = Date.now();
        return normalized;
      }
    } catch (e) {
      console.error('[D1] Error reading sitemap skills from D1:', e);
    }
  }

  // Fallback: Dev mode local file
  // Note: Use function call to check env at runtime, not compile time
  // Tests can set DISABLE_LOCAL_SITEMAP_FALLBACK=1 to disable this fallback
  const isDevMode = () => {
    try {
      if (typeof process !== 'undefined' && process.env?.DISABLE_LOCAL_SITEMAP_FALLBACK === '1') {
        return false;
      }
      return import.meta.env.DEV === true;
    } catch {
      return false;
    }
  };
  if (isDevMode()) {
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const mainCachePath = path.resolve(process.cwd(), 'data/skills-cache.json');
      if (fs.existsSync(mainCachePath)) {
        const content = fs.readFileSync(mainCachePath, 'utf-8');
        const data = JSON.parse(content);
        const skills = Array.isArray(data) ? data : data.skills || [];
        const normalized = normalizeAndDedupe(
          skills.map((s: Record<string, unknown>) => {
            const skillMd = s.skillMd as Record<string, unknown> | null | undefined;
            const seo = s.seo as Record<string, unknown> | null | undefined;
            const definition = seo?.definition as Record<string, unknown> | null | undefined;
            const description = s.description as Record<string, unknown> | string | null | undefined;
            return {
              id: s.id,
              owner: s.owner,
              repo: s.repo,
              updatedAt: s.updatedAt,
              skillBody: skillMd?.body,
              skillBodyPreview: skillMd?.bodyPreview,
              skillName: s.name || s.skillName || s.repo,
              descriptionEn: typeof description === 'object' ? (description as Record<string, unknown>)?.en : undefined,
              descriptionRaw: description,
              seoDefinitionEn: definition?.en,
              seoDefinitionRaw: definition,
              topicsRaw: s.topics,
              category: s.category,
              filePath: s.filePath,
            };
          }),
        );
        _sitemapSkillsCache = normalized;
        _sitemapSkillsCacheTime = Date.now();
        return normalized;
      }

      const sitemapPath = path.resolve(process.cwd(), 'data/sitemap-skills.json');
      if (fs.existsSync(sitemapPath)) {
        const content = fs.readFileSync(sitemapPath, 'utf-8');
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
          const normalized = normalizeAndDedupe(data, { skipReadmeFilter: true });
          _sitemapSkillsCache = normalized;
          _sitemapSkillsCacheTime = Date.now();
          return normalized;
        }
      }
    } catch (e) {
      console.warn('[Local] Failed to read local sitemap skills cache:', e);
    }
  }

  if (_sitemapSkillsCache) {
    console.warn('[Sitemap] Falling back to stale in-memory sitemap cache');
    return _sitemapSkillsCache;
  }

  console.warn('[Sitemap] No data source available for sitemap');
  return [];
}
