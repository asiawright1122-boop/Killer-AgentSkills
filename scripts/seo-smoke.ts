#!/usr/bin/env npx tsx

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

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
  },
  {
    path: '/en/skills',
    titleIncludes: 'Skills',
    canonical: `${SITE_ORIGIN}/en/skills`,
    locale: 'en',
    expectJsonLd: true,
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
  const skillSitemapLocs = sitemapLocs.filter((loc) => /\/sitemap-skills-\d+\.xml$/.test(new URL(loc).pathname));
  ensure(skillSitemapLocs.length > 0, 'sitemap index must include at least one /sitemap-skills-{n}.xml');

  const allSkillLocs: string[] = [];
  const allSkillPaths: string[] = [];
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
      /^\/[a-z]{2}\/skills\/[^/]+\/[^/]+$/.test(parsed.pathname),
      `skills sitemap loc has invalid path depth/format: ${loc}`,
    );

    const segments = parsed.pathname.split('/').filter(Boolean);
    const repoSegment = segments[segments.length - 1] || '';
    ensure(!SKILL_FILE_EXT_REGEX.test(repoSegment), `skills sitemap loc must not use file-like repo slug: ${loc}`);
    allSkillPaths.push(`${parsed.pathname}${parsed.search}`);
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

  const fakeSubSkillPath = `${parentPath}/__seo_smoke_invalid_sub_skill_guard__`;
  const redirectResponse = await fetchRedirectWithRetry(withCacheBust(fakeSubSkillPath), 301);
  const location = redirectResponse.headers.get('location') || '';

  ensure(
    location === parentPath,
    `${fakeSubSkillPath}: expected redirect location "${parentPath}", got "${location || 'missing'}"`,
  );
  console.log(`SEO smoke passed: invalid sub-skill redirects to parent (${fakeSubSkillPath} -> ${parentPath})`);
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
    const representativeSkillPath = await resolveRepresentativeSkillPath(skillPaths);
    await runRepresentativeSkillCheck(representativeSkillPath);
    await runInvalidSubSkillRedirectCheck(representativeSkillPath);

    console.log(`SEO smoke completed successfully against ${activeBaseUrl}`);
  } finally {
    await stopLocalDevServer(devServer);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
