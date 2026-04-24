#!/usr/bin/env npx tsx

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileSitemapBlocklist, isSitemapSkillBlocked } from '../src/lib/sitemap-blocklist';
import { type SitemapSkillEntry } from '../src/lib/skill-route-paths';
import { isFileLikeSkillRouteTail } from './lib/coverage-url-classification';
import {
  pickBlocklistedSkillSample,
  pickSingleRouteRepoRedirectSample,
  pickSuppressedLocaleRedirectSample,
  readRedirectPathname,
  type SkillLocaleGovernanceRecord,
} from './lib/seo-smoke-samples';

type PageCheck = {
  path: string;
  canonical: string;
  locale: string;
  titleIncludes?: string;
  descriptionIncludes?: string;
  expectNoindex?: boolean;
  expectJsonLd?: boolean;
  expectBreadcrumbParity?: boolean;
  expectedBreadcrumbLabels?: string[];
  mustNotContain?: string[];
};

type RunningDevServer = {
  child: ChildProcessWithoutNullStreams;
  logs: string[];
};

const SITE_ORIGIN = 'https://killer-skills.com';
const SITEMAP_BLOCKLIST_PATH = resolve(process.cwd(), 'data/seo-sitemap-blocklist.json');
const SITEMAP_SKILLS_PATH = resolve(process.cwd(), 'data/sitemap-skills.json');
const SKILL_LOCALE_GOVERNANCE_PATH = resolve(process.cwd(), 'data/seo-skill-locale-governance.json');
const MISSING_DOCS_SLUG = '/en/docs/__seo-smoke_missing_slug_404_guard__';
const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504, 522, 524]);
const SKILL_FILE_EXT_REGEX = /\.(md|ts|js|py|json|go|yaml|yml|toml|rs|rb|css|html|xml|txt)$/i;
const I18N_KEY_REGEX =
  /\b(?:Aria|Blog|Common|Detail|Docs|Footer|Home|Marketplace|Navigation|Solutions)\.(?!astro\b|tsx\b|ts\b|jsx\b|js\b|json\b)[A-Za-z0-9_-]+\b/g;
const OG_LOCALE_BY_LOCALE: Record<string, string> = {
  ar: 'ar_AR',
  de: 'de_DE',
  en: 'en_US',
  es: 'es_ES',
  fr: 'fr_FR',
  ja: 'ja_JP',
  ko: 'ko_KR',
  pt: 'pt_PT',
  ru: 'ru_RU',
  zh: 'zh_CN',
};
const rawArgs = process.argv.slice(2);
const spawnDev = rawArgs.includes('--spawn-dev');
const positionalArgs = rawArgs.filter((arg) => !arg.startsWith('--'));
let activeBaseUrl = (positionalArgs[0] || 'http://127.0.0.1:4321').replace(/\/+$/, '');
let spawnedBaseUrl: string | null = null;
const isLocalBaseUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(activeBaseUrl);
const FETCH_TIMEOUT_MS = readPositiveInt(process.env.SEO_SMOKE_FETCH_TIMEOUT_MS, 15000);
const FETCH_RETRY_ATTEMPTS = readPositiveInt(
  process.env.SEO_SMOKE_FETCH_RETRIES,
  activeBaseUrl.startsWith('https://') ? 6 : 3,
);
const FETCH_RETRY_DELAY_MS = readPositiveInt(process.env.SEO_SMOKE_FETCH_RETRY_DELAY_MS, 2000);
const SEO_SMOKE_CACHE_BUST = process.env.SEO_SMOKE_CACHE_BUST === '1';
const SEO_SMOKE_SITEMAP_ONLY = process.env.SEO_SMOKE_SITEMAP_ONLY === '1';
const CACHE_BUST_VALUE = Date.now();

const checks: PageCheck[] = [
  {
    path: '/en',
    titleIncludes: 'AI Agent Skills',
    canonical: `${SITE_ORIGIN}/en`,
    locale: 'en',
    expectJsonLd: true,
  },
  {
    path: '/zh',
    titleIncludes: 'AI Agent Skills',
    canonical: `${SITE_ORIGIN}/zh`,
    locale: 'zh',
    expectJsonLd: true,
    mustNotContain: [
      'Home.seoIntro',
      'Submit Skill',
      'Search...',
      'Killer-Skills is an open-source directory and installation hub for 3,400+ AI agent skills.',
    ],
  },
  {
    path: '/en/skills',
    titleIncludes: 'Skills',
    canonical: `${SITE_ORIGIN}/en/skills`,
    locale: 'en',
    expectJsonLd: true,
  },
  {
    path: '/zh/skills',
    titleIncludes: 'AI Agent',
    canonical: `${SITE_ORIGIN}/zh/skills`,
    locale: 'zh',
    expectJsonLd: true,
    mustNotContain: ['Submit Skill', 'Search...'],
  },
  {
    path: '/en/collections',
    canonical: `${SITE_ORIGIN}/en/collections`,
    locale: 'en',
    expectJsonLd: true,
    expectBreadcrumbParity: true,
    expectedBreadcrumbLabels: ['Home', 'Collections'],
  },
];

function ensure(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readTagContent(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1] || null;
}

function withCacheBust(path: string): string {
  if (!SEO_SMOKE_CACHE_BUST) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}seo_smoke_cache_bust=${CACHE_BUST_VALUE}`;
}

function isTransientFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError') return true;
  return /fetch failed|network|econnreset|enotfound|etimedout|socket hang up|unexpected eof/i.test(error.message);
}

async function fetchWithRetry(path: string, expectedStatus?: number): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= FETCH_RETRY_ATTEMPTS; attempt += 1) {
    const requestUrl = `${activeBaseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(requestUrl, { signal: controller.signal });
      const passed = expectedStatus != null ? response.status === expectedStatus : response.ok;

      if (passed) {
        return response;
      }

      const expectedLabel = expectedStatus != null ? expectedStatus : 200;
      lastError = new Error(`${path}: expected ${expectedLabel}, got ${response.status}`);

      if (TRANSIENT_STATUS_CODES.has(response.status) && attempt < FETCH_RETRY_ATTEMPTS) {
        const waitMs = FETCH_RETRY_DELAY_MS * attempt;
        console.warn(
          `SEO smoke retry ${attempt}/${FETCH_RETRY_ATTEMPTS - 1} for ${path}: status ${response.status}, waiting ${waitMs}ms`,
        );
        await sleep(waitMs);
        continue;
      }

      throw lastError;
    } catch (error) {
      if (attempt < FETCH_RETRY_ATTEMPTS && isTransientFetchError(error)) {
        const waitMs = FETCH_RETRY_DELAY_MS * attempt;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `SEO smoke retry ${attempt}/${FETCH_RETRY_ATTEMPTS - 1} for ${path}: ${message}, waiting ${waitMs}ms`,
        );
        await sleep(waitMs);
        continue;
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(`${path}: request failed (${String(error)})`, { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error(`${path}: request failed after ${FETCH_RETRY_ATTEMPTS} attempts`);
}

async function fetchRedirectWithRetry(path: string, expectedStatus = 301): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= FETCH_RETRY_ATTEMPTS; attempt += 1) {
    const requestUrl = `${activeBaseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(requestUrl, { signal: controller.signal, redirect: 'manual' });
      if (response.status === expectedStatus) {
        return response;
      }

      lastError = new Error(`${path}: expected ${expectedStatus}, got ${response.status}`);

      if (TRANSIENT_STATUS_CODES.has(response.status) && attempt < FETCH_RETRY_ATTEMPTS) {
        const waitMs = FETCH_RETRY_DELAY_MS * attempt;
        console.warn(
          `SEO smoke retry ${attempt}/${FETCH_RETRY_ATTEMPTS - 1} for ${path}: status ${response.status}, waiting ${waitMs}ms`,
        );
        await sleep(waitMs);
        continue;
      }

      throw lastError;
    } catch (error) {
      if (attempt < FETCH_RETRY_ATTEMPTS && isTransientFetchError(error)) {
        const waitMs = FETCH_RETRY_DELAY_MS * attempt;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `SEO smoke retry ${attempt}/${FETCH_RETRY_ATTEMPTS - 1} for ${path}: ${message}, waiting ${waitMs}ms`,
        );
        await sleep(waitMs);
        continue;
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(`${path}: request failed (${String(error)})`, { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error(`${path}: request failed after ${FETCH_RETRY_ATTEMPTS} attempts`);
}

async function fetchText(path: string): Promise<string> {
  const response = await fetchWithRetry(path);
  return response.text();
}

function parseXmlLocs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gim))
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function findDuplicates(items: string[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([item]) => item);
}

function toLocalPath(url: string): string {
  const parsed = new URL(url);
  ensure(parsed.origin === SITE_ORIGIN, `sitemap loc origin mismatch: ${url}`);
  return `${parsed.pathname}${parsed.search}`;
}

function loadSitemapBlocklist() {
  if (!existsSync(SITEMAP_BLOCKLIST_PATH)) {
    return null;
  }

  try {
    const raw = JSON.parse(readFileSync(SITEMAP_BLOCKLIST_PATH, 'utf8'));
    return compileSitemapBlocklist(raw);
  } catch (error) {
    throw new Error(
      `failed to parse sitemap blocklist (${SITEMAP_BLOCKLIST_PATH}): ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function loadJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch (error) {
    throw new Error(`failed to parse JSON (${filePath}): ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}

function loadSitemapSkills(): SitemapSkillEntry[] {
  const raw = loadJsonFile<Array<Partial<SitemapSkillEntry>> | { skills?: Array<Partial<SitemapSkillEntry>> }>(
    SITEMAP_SKILLS_PATH,
  );
  const records = Array.isArray(raw) ? raw : raw?.skills || [];

  return records
    .map((record) => ({
      owner: typeof record.owner === 'string' ? record.owner.trim() : '',
      repo: typeof record.repo === 'string' ? record.repo.trim() : '',
      routePath: typeof record.routePath === 'string' ? record.routePath.trim() : '',
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
    }))
    .filter((record) => record.owner && record.repo && record.routePath);
}

function loadSkillLocaleGovernance(): SkillLocaleGovernanceRecord[] {
  const raw = loadJsonFile<{ skills?: SkillLocaleGovernanceRecord[]; records?: SkillLocaleGovernanceRecord[] }>(
    SKILL_LOCALE_GOVERNANCE_PATH,
  );
  return raw?.skills || raw?.records || [];
}

function stripTags(value: string): string {
  return value
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function flattenJsonLdNode(node: unknown): Array<Record<string, any>> {
  if (Array.isArray(node)) {
    return node.flatMap((item) => flattenJsonLdNode(item));
  }

  if (!node || typeof node !== 'object') {
    return [];
  }

  const record = node as Record<string, any>;
  const graphNodes = flattenJsonLdNode(record['@graph']);
  return [record, ...graphNodes];
}

function extractJsonLdObjects(html: string): Array<Record<string, any>> {
  const objects: Array<Record<string, any>> = [];

  for (const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    const payload = decodeHtmlEntities(match[1]?.trim() || '');
    if (!payload) continue;

    try {
      const parsed = JSON.parse(payload);
      objects.push(...flattenJsonLdNode(parsed));
    } catch {
      continue;
    }
  }

  return objects;
}

function extractBreadcrumbJsonLdLabels(html: string): string[] {
  for (const object of extractJsonLdObjects(html)) {
    if (object['@type'] !== 'BreadcrumbList' || !Array.isArray(object.itemListElement)) {
      continue;
    }

    return object.itemListElement.map((item: Record<string, any>) => String(item?.name || '').trim()).filter(Boolean);
  }

  for (const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    const payload = decodeHtmlEntities(match[1] || '');
    if (!payload.includes('"@type":"BreadcrumbList"') && !payload.includes('"@type": "BreadcrumbList"')) {
      continue;
    }

    const names = Array.from(payload.matchAll(/"name"\s*:\s*"([^"]+)"/g))
      .map((nameMatch) => nameMatch[1]?.trim())
      .filter((value): value is string => Boolean(value));

    if (names.length > 0) {
      return names;
    }
  }

  return [];
}

function extractJsonLdPayloadPreviews(html: string): string[] {
  return Array.from(html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) =>
      decodeHtmlEntities(match[1] || '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 4);
}

function extractVisibleBreadcrumbLabels(html: string): string[] {
  const navMatch = html.match(/<nav[^>]*aria-label="Breadcrumb"[^>]*>([\s\S]*?)<\/nav>/i);
  if (!navMatch) return [];

  return Array.from(navMatch[1].matchAll(/<(?:a|span)[^>]*>([\s\S]*?)<\/(?:a|span)>/gi))
    .map((match) => stripTags(match[1] || ''))
    .filter((value) => Boolean(value) && value !== '/');
}

function extractHreflangs(html: string): string[] {
  return Array.from(html.matchAll(/<link[^>]*rel="alternate"[^>]*hreflang="([^"]+)"[^>]*>/gi))
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function assertNoRawI18nKeys(path: string, html: string) {
  const matches = Array.from(new Set(html.match(I18N_KEY_REGEX) || []));
  ensure(matches.length === 0, `${path}: leaked raw translation keys (${matches.slice(0, 5).join(', ')})`);
}

function assertLocaleMetadata(check: PageCheck, html: string) {
  const htmlLang = readTagContent(html, /<html[^>]*\slang="([^"]+)"/i);
  const ogLocale = readTagContent(html, /<meta\s+property="og:locale"\s+content="(.*?)"/i);
  const hreflangs = extractHreflangs(html);
  const expectedOgLocale = OG_LOCALE_BY_LOCALE[check.locale];

  ensure(
    htmlLang === check.locale,
    `${check.path}: expected html lang "${check.locale}", got "${htmlLang || 'missing'}"`,
  );
  ensure(
    hreflangs.includes(check.locale),
    `${check.path}: expected hreflang "${check.locale}" to be present (got ${hreflangs.join(', ') || 'none'})`,
  );
  ensure(hreflangs.includes('x-default'), `${check.path}: expected hreflang "x-default" to be present`);

  if (expectedOgLocale) {
    ensure(
      ogLocale === expectedOgLocale,
      `${check.path}: expected og:locale "${expectedOgLocale}", got "${ogLocale || 'missing'}"`,
    );
  }
}

function assertBreadcrumbParity(check: PageCheck, html: string) {
  if (!check.expectBreadcrumbParity) return;

  const visibleLabels = extractVisibleBreadcrumbLabels(html);
  const jsonLdLabels = extractBreadcrumbJsonLdLabels(html);
  const payloadPreviews = extractJsonLdPayloadPreviews(html);

  ensure(visibleLabels.length > 0, `${check.path}: expected visible breadcrumb labels`);
  ensure(
    jsonLdLabels.length >= visibleLabels.length,
    `${check.path}: expected breadcrumb JSON-LD labels\nVisible: ${visibleLabels.join(' > ')}\nJSON-LD payloads:\n${payloadPreviews.join('\n---\n') || 'none'}`,
  );
  ensure(
    JSON.stringify(jsonLdLabels.slice(0, visibleLabels.length)) === JSON.stringify(visibleLabels),
    `${check.path}: breadcrumb JSON-LD does not match visible breadcrumb (${visibleLabels.join(' > ')} vs ${jsonLdLabels.join(' > ')})`,
  );

  if (check.expectedBreadcrumbLabels) {
    ensure(
      JSON.stringify(visibleLabels) === JSON.stringify(check.expectedBreadcrumbLabels),
      `${check.path}: breadcrumb labels mismatch (${visibleLabels.join(' > ')})`,
    );
  }
}

function validateCheck(check: PageCheck, html: string) {
  const title = readTagContent(html, /<title>(.*?)<\/title>/i);
  const description = readTagContent(html, /<meta\s+name="description"\s+content="(.*?)"/i);
  const canonical = readTagContent(html, /<link\s+rel="canonical"\s+href="(.*?)"/i);
  const robots = readTagContent(html, /<meta\s+name="robots"\s+content="(.*?)"/i);

  ensure(Boolean(title), `${check.path}: missing <title>`);
  ensure(Boolean(description), `${check.path}: missing meta description`);
  ensure(Boolean(canonical), `${check.path}: missing canonical`);
  ensure(title!.length >= 10 && title!.length <= 85, `${check.path}: title length out of range (${title!.length})`);
  ensure(
    description!.length >= 50 && description!.length <= 180,
    `${check.path}: description length out of range (${description!.length})`,
  );
  ensure(canonical === check.canonical, `${check.path}: canonical mismatch (${canonical})`);

  if (check.titleIncludes) {
    ensure(title!.includes(check.titleIncludes), `${check.path}: title missing "${check.titleIncludes}"`);
  }

  if (check.descriptionIncludes) {
    ensure(
      description!.includes(check.descriptionIncludes),
      `${check.path}: description missing "${check.descriptionIncludes}"`,
    );
  }

  if (check.expectNoindex) {
    ensure(robots?.includes('noindex') === true, `${check.path}: expected noindex robots tag`);
  } else {
    ensure(robots?.includes('index') === true, `${check.path}: expected index robots tag`);
  }

  if (check.expectJsonLd) {
    ensure(html.includes('application/ld+json'), `${check.path}: expected structured data script`);
  }

  assertLocaleMetadata(check, html);
  assertNoRawI18nKeys(check.path, html);
  assertBreadcrumbParity(check, html);

  if (check.mustNotContain) {
    for (const needle of check.mustNotContain) {
      ensure(!html.includes(needle), `${check.path}: unexpected HTML content "${needle}"`);
    }
  }
}

async function runCheck(check: PageCheck) {
  const html = await fetchText(withCacheBust(check.path));
  validateCheck(check, html);
  console.log(`SEO smoke passed: ${check.path}`);
}

async function runMissingDocs404Check() {
  await fetchWithRetry(withCacheBust(MISSING_DOCS_SLUG), 404);
  console.log('SEO smoke passed: docs missing slug returns 404');
}

async function runSkillsSitemapChecks(): Promise<string[]> {
  const sitemapIndexXml = await fetchText(withCacheBust('/sitemap.xml'));
  const sitemapLocs = parseXmlLocs(sitemapIndexXml);
  const skillSitemapLocs = sitemapLocs.filter((loc) => /\/sitemap-skills(?:-\d+)?\.xml$/.test(new URL(loc).pathname));
  ensure(skillSitemapLocs.length > 0, 'sitemap index must include at least one skills sitemap XML');

  const allSkillLocs: string[] = [];
  const allSkillPaths: string[] = [];
  const blocklist = loadSitemapBlocklist();
  const blockedLocs: string[] = [];
  for (const sitemapLoc of skillSitemapLocs) {
    const localPath = toLocalPath(sitemapLoc);
    const xml = await fetchText(withCacheBust(localPath));
    allSkillLocs.push(...parseXmlLocs(xml));
  }

  const duplicateLocs = findDuplicates(allSkillLocs);
  ensure(
    duplicateLocs.length === 0,
    `skills sitemap duplicate URLs detected:\n${duplicateLocs
      .slice(0, 10)
      .map((item) => `- ${item}`)
      .join('\n')}`,
  );

  for (const loc of allSkillLocs) {
    const parsed = new URL(loc);
    ensure(parsed.origin === SITE_ORIGIN, `skills sitemap loc must use canonical origin: ${loc}`);
    ensure(parsed.search === '', `skills sitemap loc must not contain query params: ${loc}`);
    ensure(
      /^\/[a-z]{2}\/skills\/[^/]+\/[^/]+(?:\/[^/]+)?$/.test(parsed.pathname),
      `skills sitemap loc has invalid path depth/format: ${loc}`,
    );

    const segments = parsed.pathname.split('/').filter(Boolean);
    const routeSegments = segments.slice(3);
    ensure(
      routeSegments.length === 1 || routeSegments.length === 2,
      `skills sitemap loc has invalid route depth: ${loc}`,
    );
    ensure(
      !isFileLikeSkillRouteTail(routeSegments, SKILL_FILE_EXT_REGEX),
      `skills sitemap loc must not use file-like tail segments: ${loc}`,
    );

    if (blocklist) {
      const owner = segments[2] || '';
      const routePath = routeSegments.join('/');
      if (isSitemapSkillBlocked(owner, routePath, blocklist)) {
        blockedLocs.push(loc);
      }
    }

    allSkillPaths.push(`${parsed.pathname}${parsed.search}`);
  }

  if (blocklist) {
    ensure(
      blockedLocs.length === 0,
      `skills sitemap contains blocklisted URLs:\n${blockedLocs
        .slice(0, 15)
        .map((item) => `- ${item}`)
        .join('\n')}`,
    );
    console.log(
      `SEO smoke passed: sitemap blocklist exclusion (${blocklist.exactKeys.size} exact, ${blocklist.repoKeys.size} repo rules)`,
    );
  } else {
    console.warn(`SEO smoke skipped sitemap blocklist exclusion check: ${SITEMAP_BLOCKLIST_PATH} not found`);
  }

  console.log(`SEO smoke passed: skills sitemap dedupe + URL shape (${allSkillLocs.length} URLs)`);
  return allSkillPaths;
}

async function resolveRepresentativeSkillPath(skillPaths: string[]): Promise<string | null> {
  ensure(skillPaths.length > 0, 'skills sitemap must contain at least one skill URL');

  for (const skillPath of skillPaths.slice(0, 20)) {
    try {
      await fetchWithRetry(withCacheBust(skillPath));
      return skillPath;
    } catch {
      continue;
    }
  }

  if (isLocalBaseUrl) {
    console.warn(
      'SEO smoke skipped skill detail checks: local preview has no accessible skill detail pages from sitemap sample.',
    );
    return null;
  }

  throw new Error('skills sitemap sample paths did not resolve to any 200 skill detail page');
}

async function runRepresentativeSkillCheck(skillPath: string | null) {
  if (!skillPath) return;

  const locale = skillPath.split('/').filter(Boolean)[0] || 'en';
  const html = await fetchText(withCacheBust(skillPath));
  validateCheck(
    {
      path: skillPath,
      canonical: `${SITE_ORIGIN}${skillPath}`,
      locale,
      expectJsonLd: true,
      expectBreadcrumbParity: true,
    },
    html,
  );

  ensure(!html.includes('aggregateRating'), `${skillPath}: unexpected HTML content "aggregateRating"`);
  ensure(!html.includes('ratingValue'), `${skillPath}: unexpected HTML content "ratingValue"`);
  console.log(`SEO smoke passed: representative skill detail page (${skillPath})`);
}

async function runInvalidSubSkillRedirectCheck(parentPath: string | null) {
  if (!parentPath) return;

  const pathSegments = parentPath.split('/').filter(Boolean);
  const repoLevelPath = pathSegments.length >= 5 ? `/${pathSegments.slice(0, 4).join('/')}` : parentPath;
  const fakeSubSkillPath = `${repoLevelPath}/__seo_smoke_invalid_sub_skill_guard__`;
  const redirectResponse = await fetchRedirectWithRetry(withCacheBust(fakeSubSkillPath), 301);
  const location = redirectResponse.headers.get('location') || '';
  const redirectedPathname = readRedirectPathname(location);

  ensure(
    redirectedPathname === repoLevelPath,
    `${fakeSubSkillPath}: expected redirect location "${repoLevelPath}", got "${location || 'missing'}"`,
  );
  console.log(`SEO smoke passed: invalid sub-skill redirects to parent (${fakeSubSkillPath} -> ${repoLevelPath})`);
}

async function runSingleRouteRepoRedirectCheck() {
  const sample = pickSingleRouteRepoRedirectSample(loadSitemapSkills(), loadSitemapBlocklist());
  if (!sample) {
    console.warn('SEO smoke skipped repo-root single-route redirect check: no eligible sample found');
    return;
  }

  const response = await fetchRedirectWithRetry(withCacheBust(sample.sourcePath), 301);
  const location = response.headers.get('location') || '';
  const redirectedPathname = readRedirectPathname(location);
  ensure(
    redirectedPathname === sample.expectedPath,
    `${sample.sourcePath}: expected repo-root redirect to "${sample.expectedPath}", got "${location || 'missing'}"`,
  );
  console.log(
    `SEO smoke passed: repo-root redirects to sole public skill (${sample.sourcePath} -> ${sample.expectedPath})`,
  );
}

async function runSuppressedLocaleRedirectCheck() {
  const sample = pickSuppressedLocaleRedirectSample(
    loadSitemapSkills(),
    loadSkillLocaleGovernance(),
    loadSitemapBlocklist(),
  );
  if (!sample) {
    console.warn('SEO smoke skipped suppressed-locale redirect check: no eligible governance sample found');
    return;
  }

  const response = await fetchRedirectWithRetry(withCacheBust(sample.sourcePath), 301);
  const location = response.headers.get('location') || '';
  const redirectedPathname = readRedirectPathname(location);
  ensure(
    redirectedPathname === sample.expectedPath,
    `${sample.sourcePath}: expected locale-governed redirect to "${sample.expectedPath}", got "${location || 'missing'}"`,
  );
  console.log(
    `SEO smoke passed: suppressed locale redirects to canonical (${sample.sourcePath} -> ${sample.expectedPath})`,
  );
}

async function runBlocklistedSkill410Check() {
  const sample = pickBlocklistedSkillSample(loadSitemapBlocklist());
  if (!sample) {
    console.warn('SEO smoke skipped blocklisted skill 410 check: no eligible blocklist sample found');
    return;
  }

  const response = await fetchWithRetry(withCacheBust(sample.sourcePath), 410);
  const robots = response.headers.get('x-robots-tag') || response.headers.get('X-Robots-Tag') || '';
  ensure(
    robots.toLowerCase() === 'noindex, nofollow',
    `${sample.sourcePath}: expected X-Robots-Tag noindex, nofollow, got "${robots || 'missing'}"`,
  );
  console.log(`SEO smoke passed: blocklisted skill returns 410 (${sample.sourcePath})`);
}

function captureLog(logs: string[], chunk: Buffer | string) {
  const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
  logs.push(...lines);
  if (logs.length > 200) {
    logs.splice(0, logs.length - 200);
  }

  for (const line of lines) {
    const urlMatch = line.match(/https?:\/\/127\.0\.0\.1:\d+/i);
    if (urlMatch) {
      activeBaseUrl = urlMatch[0].replace(/\/+$/, '');
      spawnedBaseUrl = activeBaseUrl;
    }
  }
}

async function startLocalDevServer(): Promise<RunningDevServer> {
  ensure(isLocalBaseUrl, '--spawn-dev only supports local base URLs');
  spawnedBaseUrl = null;

  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(command, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4321'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logs: string[] = [];
  child.stdout.on('data', (chunk) => captureLog(logs, chunk));
  child.stderr.on('data', (chunk) => captureLog(logs, chunk));

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode != null) {
      throw new Error(`dev server exited early with code ${child.exitCode}\n${logs.slice(-40).join('\n')}`);
    }

    if (!spawnedBaseUrl) {
      await sleep(500);
      continue;
    }

    try {
      const response = await fetch(`${spawnedBaseUrl}/en`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        activeBaseUrl = spawnedBaseUrl;
        return { child, logs };
      }
    } catch {
      // keep waiting
    }

    await sleep(1000);
  }

  child.kill('SIGTERM');
  throw new Error(`timed out waiting for dev server\n${logs.slice(-40).join('\n')}`);
}

async function stopLocalDevServer(server: RunningDevServer | null) {
  if (!server) return;
  if (server.child.exitCode != null) return;

  server.child.kill('SIGTERM');

  await Promise.race([
    new Promise<void>((resolve) => {
      server.child.once('exit', () => resolve());
    }),
    sleep(5000),
  ]);

  if (server.child.exitCode == null) {
    server.child.kill('SIGKILL');
  }
}

async function main() {
  let devServer: RunningDevServer | null = null;

  try {
    if (spawnDev) {
      devServer = await startLocalDevServer();
      console.log(`SEO smoke spawned local dev server at ${activeBaseUrl}`);
    }

    for (const check of checks) {
      await runCheck(check);
    }

    await runMissingDocs404Check();
    const skillPaths = await runSkillsSitemapChecks();
    if (!SEO_SMOKE_SITEMAP_ONLY) {
      await runSingleRouteRepoRedirectCheck();
      await runSuppressedLocaleRedirectCheck();
      await runBlocklistedSkill410Check();
      const representativeSkillPath = await resolveRepresentativeSkillPath(skillPaths);
      await runRepresentativeSkillCheck(representativeSkillPath);
      await runInvalidSubSkillRedirectCheck(representativeSkillPath);
    } else {
      console.log('SEO smoke skipped representative skill checks (SEO_SMOKE_SITEMAP_ONLY=1)');
    }

    console.log(`SEO smoke completed successfully against ${activeBaseUrl}`);
  } finally {
    await stopLocalDevServer(devServer);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
