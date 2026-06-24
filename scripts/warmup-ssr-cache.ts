import fs from 'fs';
import path from 'path';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '../src/i18n';
import { buildLocalizedSkillPath, getSkillRoutePath } from '../src/lib/skill-route-paths';

const CACHE_FILE = path.join(process.cwd(), 'data/skills-cache.json');
const SITEMAP_SKILLS_FILE = path.join(process.cwd(), 'data/sitemap-skills.json');
const LOCALE_GOVERNANCE_FILE = path.join(process.cwd(), 'data/seo-skill-locale-governance.json');
const DOMAIN = process.env.PUBLIC_SITE_URL || 'https://killer-skills.com';
const LIMIT = parseInt(process.env.WARMUP_LIMIT || '100', 10);
const CONCURRENCY = parseInt(process.env.WARMUP_CONCURRENCY || '5', 10);
const FETCH_TIMEOUT_MS = parseInt(process.env.WARMUP_FETCH_TIMEOUT_MS || '15000', 10);
const WARMUP_URL_LIMIT = parseInt(process.env.WARMUP_URL_LIMIT || '300', 10);
const MAX_RETRIES = parseInt(process.env.WARMUP_MAX_RETRIES || '2', 10);
const RETRY_BASE_DELAY_MS = parseInt(process.env.WARMUP_RETRY_BASE_DELAY_MS || '1000', 10);
const WARMUP_USER_AGENT = process.env.WARMUP_USER_AGENT || 'Killer-Skills-Warmup-Bot/1.0';
const supportedLocaleSet = new Set<string>(SUPPORTED_LOCALES as readonly string[]);
const retryableStatuses = new Set([429, 500, 502, 503, 504]);

type SkillCacheEntry = {
  id?: string;
  owner?: string;
  repo?: string;
  routePath?: string;
  stars?: number;
  updatedAt?: string;
};

type SkillLocaleDetails = {
  canonicalLocale: Locale;
  publishedLocales: Locale[];
};

interface WarmupResult {
  ok: boolean;
  status?: number;
  ms: number;
  attempts: number;
  cfCacheStatus?: string;
  error?: string;
}

function getRouteKey(owner: string, routePath: string): string {
  return `${owner.toLowerCase()}/${routePath.toLowerCase()}`;
}

function readPublicSitemapRouteSet(): Set<string> {
  const routeSet = new Set<string>();
  if (!fs.existsSync(SITEMAP_SKILLS_FILE)) return routeSet;

  const data = JSON.parse(fs.readFileSync(SITEMAP_SKILLS_FILE, 'utf8'));
  const skills: SkillCacheEntry[] = Array.isArray(data) ? data : data.skills || [];

  for (const skill of skills) {
    const owner = typeof skill.owner === 'string' ? skill.owner.trim() : '';
    const routePath = getSkillRoutePath(skill);
    if (!owner || !routePath) continue;
    routeSet.add(getRouteKey(owner, routePath));
  }

  return routeSet;
}

function readTopSkills(): SkillCacheEntry[] {
  const sourceFile = fs.existsSync(CACHE_FILE) ? CACHE_FILE : SITEMAP_SKILLS_FILE;
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`No warmup source found. Expected ${CACHE_FILE} or ${SITEMAP_SKILLS_FILE}.`);
  }

  console.log(`Warmup source: ${path.relative(process.cwd(), sourceFile)}`);
  const publicSitemapRoutes = readPublicSitemapRouteSet();
  const data = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  const skills: SkillCacheEntry[] = Array.isArray(data) ? data : data.skills || [];
  const publicSkills = skills.filter((skill) => {
    const owner = typeof skill.owner === 'string' ? skill.owner.trim() : '';
    const routePath = getSkillRoutePath(skill);
    if (!owner || !skill.repo || !routePath) return false;
    return publicSitemapRoutes.size === 0 || publicSitemapRoutes.has(getRouteKey(owner, routePath));
  });

  if (publicSkills.length !== skills.length) {
    console.log(`Filtered warmup candidates to ${publicSkills.length}/${skills.length} public sitemap routes.`);
  }

  return publicSkills.sort(sortWarmupCandidates).slice(0, LIMIT);
}

function readSkillLocaleDetailsMap(): Map<string, SkillLocaleDetails> {
  const map = new Map<string, SkillLocaleDetails>();
  if (!fs.existsSync(LOCALE_GOVERNANCE_FILE)) return map;

  const data = JSON.parse(fs.readFileSync(LOCALE_GOVERNANCE_FILE, 'utf8'));
  const records: any[] = Array.isArray(data) ? data : data.skills || [];

  for (const record of records) {
    const owner = typeof record.owner === 'string' ? record.owner.trim() : '';
    const routePath = typeof record.routePath === 'string' ? record.routePath.trim() : '';
    const canonicalLocale = typeof record.canonicalLocale === 'string' ? record.canonicalLocale.trim() : '';
    const published = Array.isArray(record.publishedLocales) ? record.publishedLocales : [];
    if (!owner || !routePath) continue;

    const validatedCanonical = supportedLocaleSet.has(canonicalLocale) ? (canonicalLocale as Locale) : DEFAULT_LOCALE;
    const validatedPublished = published.filter((loc: string) => supportedLocaleSet.has(loc)) as Locale[];

    map.set(getRouteKey(owner, routePath), {
      canonicalLocale: validatedCanonical,
      publishedLocales: validatedPublished,
    });
  }

  return map;
}

function sortWarmupCandidates(a: SkillCacheEntry, b: SkillCacheEntry): number {
  const starDelta = (b.stars || 0) - (a.stars || 0);
  if (starDelta !== 0) return starDelta;

  const bUpdatedAt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
  const aUpdatedAt = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
  return bUpdatedAt - aUpdatedAt;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': WARMUP_USER_AGENT },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probeWarmupUrl(url: string): Promise<WarmupResult> {
  const start = Date.now();
  let lastStatus: number | undefined;
  let lastError: string | undefined;
  let lastCfCacheStatus: string | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }

    try {
      const res = await fetchWithTimeout(url);
      lastStatus = res.status;
      lastCfCacheStatus = res.headers.get('cf-cache-status') || undefined;
      await res.arrayBuffer();

      if (res.ok || !retryableStatuses.has(res.status)) {
        return {
          ok: res.ok,
          status: res.status,
          ms: Date.now() - start,
          attempts: attempt + 1,
          cfCacheStatus: lastCfCacheStatus,
        };
      }
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    ok: false,
    status: lastStatus,
    ms: Date.now() - start,
    attempts: MAX_RETRIES + 1,
    cfCacheStatus: lastCfCacheStatus,
    error: lastError,
  };
}

async function runWarmup() {
  console.log('Starting SSR cache warmup.');
  const topSkills = readTopSkills();
  const localeDetailsMap = readSkillLocaleDetailsMap();
  const urls: string[] = [];

  // 1. Add XML Sitemap Index and Sub-sitemaps (GSC crawl pathways)
  const sitemaps = [
    '/sitemap.xml',
    '/sitemap-static.xml',
    '/sitemap-blog.xml',
    '/sitemap-collections.xml',
    '/sitemap-docs.xml',
    '/sitemap-skills.xml',
  ];
  for (const sm of sitemaps) {
    urls.push(new URL(sm, DOMAIN).toString());
  }

  // 2. Add High-Priority Multilingual Route templates
  const coreListingPaths = ['', '/skills', '/collections', '/categories', '/docs', '/community'];
  for (const loc of SUPPORTED_LOCALES) {
    for (const p of coreListingPaths) {
      urls.push(new URL(`/${loc}${p}`, DOMAIN).toString());
    }
  }

  // 3. Add Multilingual published variants for Top Skills
  for (const skill of topSkills) {
    const routePath = getSkillRoutePath(skill);
    if (!routePath || !skill.owner) continue;

    const details = localeDetailsMap.get(getRouteKey(skill.owner, routePath));
    const canonical = details?.canonicalLocale || DEFAULT_LOCALE;
    const published = details?.publishedLocales || [];

    // Merge and deduplicate target locales
    const targetLocales = Array.from(new Set([canonical, ...published]));

    for (const loc of targetLocales) {
      urls.push(new URL(buildLocalizedSkillPath(loc, skill.owner, routePath), DOMAIN).toString());
    }
  }

  // 4. Deduplicate and cap URL list using WARMUP_URL_LIMIT
  const uniqueUrls = Array.from(new Set(urls));
  const finalUrls = uniqueUrls.slice(0, WARMUP_URL_LIMIT);

  console.log(`Prepared ${finalUrls.length} target URLs (${uniqueUrls.length} total generated, capped at limit of ${WARMUP_URL_LIMIT}).`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Fetch timeout: ${FETCH_TIMEOUT_MS}ms`);
  console.log(`Retries: ${MAX_RETRIES}`);
  console.log(`User agent: ${WARMUP_USER_AGENT}`);
  console.log(`Target domain: ${DOMAIN}\n`);

  let successCount = 0;
  let failCount = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  let cacheOthers = 0;

  for (let i = 0; i < finalUrls.length; i += CONCURRENCY) {
    const chunk = finalUrls.slice(i, i + CONCURRENCY);
    const promises = chunk.map(async (url) => {
      const result = await probeWarmupUrl(url);
      const cacheStatus = result.cfCacheStatus || 'MISS/NONE';
      const cacheLabel = `[CF-Cache: ${cacheStatus}]`;

      if (result.ok) {
        successCount++;
        const statusUpper = cacheStatus.toUpperCase();
        if (statusUpper.includes('HIT') || statusUpper.includes('REVALIDATED')) {
          cacheHits++;
        } else if (statusUpper.includes('MISS')) {
          cacheMisses++;
        } else {
          cacheOthers++;
        }

        const retryLabel = result.attempts > 1 ? ` after ${result.attempts} attempts` : '';
        console.log(`[HTTP ${result.status}] ${result.ms}ms ${cacheLabel}${retryLabel} -> ${url}`);
      } else {
        failCount++;
        const statusLabel = result.status ? `HTTP ${result.status}` : 'FETCH ERROR';
        const retryLabel = result.attempts > 1 ? ` after ${result.attempts} attempts` : '';
        const errorLabel = result.error ? ` (${result.error})` : '';
        console.error(`[${statusLabel}] Failed ${cacheLabel}${retryLabel}${errorLabel} -> ${url}`);
      }
    });

    await Promise.all(promises);
  }

  console.log('\nWarmup complete.');
  console.log('================');
  console.log(`Success: ${successCount}`);
  console.log(`Failed:  ${failCount}`);

  const totalHitsAndMisses = cacheHits + cacheMisses;
  const hitRate = totalHitsAndMisses > 0 ? ((cacheHits / totalHitsAndMisses) * 100).toFixed(1) : '0.0';
  console.log(`\nCloudflare Cache Summary:`);
  console.log(`- HIT/REVALIDATED: ${cacheHits}`);
  console.log(`- MISS:            ${cacheMisses}`);
  console.log(`- OTHER/UNKNOWN:   ${cacheOthers}`);
  console.log(`- Cache Hit Rate:  ${hitRate}%`);

  if (failCount > Math.max(10, finalUrls.length * 0.1)) {
    console.error(`Too many failures (${failCount}). Exiting with code 1.`);
    process.exit(1);
  }
}

runWarmup().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
