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

type LocaleGovernanceRecord = {
  owner?: string;
  routePath?: string;
  canonicalLocale?: string;
};

function readTopSkills(): SkillCacheEntry[] {
  const sourceFile = fs.existsSync(CACHE_FILE) ? CACHE_FILE : SITEMAP_SKILLS_FILE;
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`No warmup source found. Expected ${CACHE_FILE} or ${SITEMAP_SKILLS_FILE}.`);
  }

  console.log(`Warmup source: ${path.relative(process.cwd(), sourceFile)}`);
  const data = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  const skills: SkillCacheEntry[] = Array.isArray(data) ? data : data.skills || [];

  return skills
    .filter((skill) => skill.owner && skill.repo && getSkillRoutePath(skill))
    .sort(sortWarmupCandidates)
    .slice(0, LIMIT);
}

function readCanonicalLocaleMap(): Map<string, Locale> {
  const map = new Map<string, Locale>();
  if (!fs.existsSync(LOCALE_GOVERNANCE_FILE)) return map;

  const data = JSON.parse(fs.readFileSync(LOCALE_GOVERNANCE_FILE, 'utf8'));
  const records: LocaleGovernanceRecord[] = Array.isArray(data) ? data : data.skills || [];

  for (const record of records) {
    const owner = typeof record.owner === 'string' ? record.owner.trim() : '';
    const routePath = typeof record.routePath === 'string' ? record.routePath.trim() : '';
    const canonicalLocale = typeof record.canonicalLocale === 'string' ? record.canonicalLocale.trim() : '';
    if (!owner || !routePath || !supportedLocaleSet.has(canonicalLocale)) continue;

    map.set(`${owner.toLowerCase()}/${routePath.toLowerCase()}`, canonicalLocale as Locale);
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

async function probeWarmupUrl(
  url: string,
): Promise<{ ok: boolean; status?: number; ms: number; attempts: number; error?: string }> {
  const start = Date.now();
  let lastStatus: number | undefined;
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }

    try {
      const res = await fetchWithTimeout(url);
      lastStatus = res.status;
      await res.arrayBuffer();

      if (res.ok || !retryableStatuses.has(res.status)) {
        return {
          ok: res.ok,
          status: res.status,
          ms: Date.now() - start,
          attempts: attempt + 1,
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
    error: lastError,
  };
}

async function runWarmup() {
  console.log('Starting SSR cache warmup.');
  const topSkills = readTopSkills();
  const canonicalLocaleMap = readCanonicalLocaleMap();
  const urls: string[] = [];

  for (const skill of topSkills) {
    const routePath = getSkillRoutePath(skill);
    if (!routePath || !skill.owner) continue;

    const canonicalLocale =
      canonicalLocaleMap.get(`${skill.owner.toLowerCase()}/${routePath.toLowerCase()}`) || DEFAULT_LOCALE;
    urls.push(new URL(buildLocalizedSkillPath(canonicalLocale, skill.owner, routePath), DOMAIN).toString());
  }

  console.log(`Prepared ${urls.length} canonical target URLs (${topSkills.length} skills).`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Fetch timeout: ${FETCH_TIMEOUT_MS}ms`);
  console.log(`Retries: ${MAX_RETRIES}`);
  console.log(`User agent: ${WARMUP_USER_AGENT}`);
  console.log(`Target domain: ${DOMAIN}\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const chunk = urls.slice(i, i + CONCURRENCY);
    const promises = chunk.map(async (url) => {
      const result = await probeWarmupUrl(url);
      if (result.ok) {
        successCount++;
        const retryLabel = result.attempts > 1 ? ` after ${result.attempts} attempts` : '';
        console.log(`[HTTP ${result.status}] ${result.ms}ms${retryLabel} -> ${url}`);
      } else {
        failCount++;
        const statusLabel = result.status ? `HTTP ${result.status}` : 'FETCH ERROR';
        const retryLabel = result.attempts > 1 ? ` after ${result.attempts} attempts` : '';
        const errorLabel = result.error ? ` (${result.error})` : '';
        console.error(`[${statusLabel}] Failed${retryLabel}${errorLabel} -> ${url}`);
      }
    });

    await Promise.all(promises);
  }

  console.log('\nWarmup complete.');
  console.log('================');
  console.log(`Success: ${successCount}`);
  console.log(`Failed:  ${failCount}`);

  if (failCount > Math.max(10, urls.length * 0.1)) {
    console.error(`Too many failures (${failCount}). Exiting with code 1.`);
    process.exit(1);
  }
}

runWarmup().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
