#!/usr/bin/env npx tsx

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HIDDEN_REASONING_PUBLIC_OUTPUT_PATTERNS } from '../src/lib/public-ai-output';

type SitemapsCollected = {
  sitemapUrls: string[];
  urlsBySitemap: Map<string, string[]>;
  allDiscoveredUrls: string[];
  sitemapErrors: Array<{
    sitemapUrl: string;
    error: string;
  }>;
};

type UrlCheckResult = {
  url: string;
  status: number;
  redirected: boolean;
  finalUrl: string;
  error?: string;
  attempts: number;
  fiveXxAttempts: number;
  recoveredFrom5xx: boolean;
  sawCloudflare1102: boolean;
  contentType?: string;
  seoSignals?: PageSeoSignals;
  onPageErrors: string[];
};

type PageSeoSignals = {
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  htmlLang: string | null;
  h1Count: number;
  jsonLdCount: number;
  internalCopyLeaks: string[];
};

type CrawlHealthJsonReport = {
  generatedAt: string;
  rootSitemap: string;
  totals: {
    sitemapFilesDiscovered: number;
    pageUrlsDiscovered: number;
    pageUrlsChecked: number;
  };
  statusSummary: {
    status2xx: number;
    status3xx: number;
    status4xx: number;
    status5xx: number;
    statusOther: number;
  };
  sampledCoverage: Array<{
    sitemapUrl: string;
    sampled: number;
    total: number;
  }>;
  redirects: UrlCheckResult[];
  flakyRecovered: UrlCheckResult[];
  cloudflare1102: UrlCheckResult[];
  onPageSeoErrors: UrlCheckResult[];
  errors: UrlCheckResult[];
  duplicates: string[];
  sitemapErrors: Array<{
    sitemapUrl: string;
    error: string;
  }>;
  results: UrlCheckResult[];
};

const PUBLIC_COPY_LEAK_PATTERNS = [
  ...HIDDEN_REASONING_PUBLIC_OUTPUT_PATTERNS.map((entry) => entry.pattern),
  /\buse\s+when\s+(?:creating|using|the\s+user|you|asked|working|submitting)\b/i,
  /\bfollow\s+these\s+\d+\s+steps?\s+exactly\b/i,
  /\bcritical\s+guidelines?\b/i,
  /\bavoid\s+redundancy\b/i,
  /\bdo\s+not\s+copy\b/i,
  /\byou\s+orchestrate\s+a\s+pr\s+code\s+review\s+debate\b/i,
  /\brecovery\s+(?:strategy|control\s+board|board|heavy)\b/i,
  /\breference-only\b/i,
  /\btrusted\s+next\s+steps?\b/i,
  /恢复期话术|(?:恢复|SEO|运营|审查|编辑部|内部|站点)\s*控制台|控制台\s*(?:视图|看板|复核|审查)|复核清单|编辑部审查/i,
];

const SITE_ORIGIN = 'https://killer-skills.com';
const cliArgs = process.argv.slice(2);
const allowBlockingExit = cliArgs.includes('--allow-blocking-exit');
const positionalBaseUrl = cliArgs.find((arg) => !arg.startsWith('--')) || SITE_ORIGIN;
const baseUrl = positionalBaseUrl.replace(/\/+$/, '');
const baseOrigin = new URL(baseUrl).origin;
const isLocalBaseUrl = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(baseOrigin);
const rootSitemapUrl = `${baseUrl}/sitemap.xml`;
const crawlDate = new Date().toISOString();
const crawlDateKey = crawlDate.slice(0, 10);

const SKILLS_SITEMAP_SAMPLE_LIMIT = Number(process.env.SEO_CRAWL_SAMPLE_SKILLS_PER_SITEMAP || '40');
const NON_SKILLS_SITEMAP_SAMPLE_LIMIT = Number(process.env.SEO_CRAWL_SAMPLE_NON_SKILLS_PER_SITEMAP || '600');
const REQUEST_TIMEOUT_MS = Number(process.env.SEO_CRAWL_TIMEOUT_MS || '15000');
const CHECK_CONCURRENCY = Number(process.env.SEO_CRAWL_CONCURRENCY || '20');
const CHECK_RETRIES = Number(process.env.SEO_CRAWL_RETRIES || '3');
const CHECK_RETRY_DELAY_MS = Number(process.env.SEO_CRAWL_RETRY_DELAY_MS || '1000');
const HARD_FAIL_5XX_MIN = Number(process.env.SEO_CRAWL_HARD_FAIL_5XX_MIN || '3');
const HARD_FAIL_5XX_RATE = Number(process.env.SEO_CRAWL_HARD_FAIL_5XX_RATE || '0.005');
const HARD_FAIL_4XX_RATE = Number(process.env.SEO_CRAWL_HARD_FAIL_4XX_RATE || '0.05');
const HARD_FAIL_FLAKY_5XX_MIN = Number(process.env.SEO_CRAWL_HARD_FAIL_FLAKY_5XX_MIN || '5');
const HARD_FAIL_FLAKY_5XX_RATE = Number(process.env.SEO_CRAWL_HARD_FAIL_FLAKY_5XX_RATE || '0.02');
const HARD_FAIL_CF1102_MIN = Number(process.env.SEO_CRAWL_HARD_FAIL_CF1102_MIN || '1');
const HARD_FAIL_ONPAGE_SEO = process.env.SEO_CRAWL_HARD_FAIL_ONPAGE_SEO !== '0';
const HARD_FAIL_REDIRECTS = process.env.SEO_CRAWL_HARD_FAIL_REDIRECTS !== '0';

function ensure(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function parseLocs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gim))
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function isSitemapUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /\.xml$/i.test(parsed.pathname) && parsed.pathname.includes('/sitemap');
  } catch {
    return false;
  }
}

function toRequestUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.origin !== SITE_ORIGIN) return url;
  return `${baseOrigin}${parsed.pathname}${parsed.search}`;
}

function sampleEvenly<T>(items: T[], limit: number): T[] {
  if (limit <= 0) return [];
  if (items.length <= limit) return items;
  if (limit === 1) return [items[0]];

  const sampled: T[] = [];
  const step = (items.length - 1) / (limit - 1);
  for (let i = 0; i < limit; i++) {
    sampled.push(items[Math.round(i * step)]);
  }
  return sampled;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function stripTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function readTagContent(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

function countMatches(html: string, pattern: RegExp): number {
  return Array.from(html.matchAll(pattern)).length;
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

function extractSeoMetadataText(html: string): string {
  return [
    readTagContent(html, /<title>([\s\S]*?)<\/title>/i),
    readTagContent(html, /<meta\s+name="description"\s+content="(.*?)"/i),
    readTagContent(html, /<meta\s+property="og:description"\s+content="(.*?)"/i),
    readTagContent(html, /<meta\s+name="twitter:description"\s+content="(.*?)"/i),
    ...extractJsonLdPayloadPreviews(html),
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');
}

function findInternalCopyLeaks(html: string): string[] {
  const publicText = `${stripTags(html)} ${extractSeoMetadataText(html)}`;
  return PUBLIC_COPY_LEAK_PATTERNS.map((pattern) => publicText.match(pattern)?.[0])
    .filter((value): value is string => Boolean(value))
    .filter(
      (value, index, all) => all.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index,
    );
}

function normalizeComparableUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function extractPageSeoSignals(html: string): PageSeoSignals {
  return {
    title: readTagContent(html, /<title>([\s\S]*?)<\/title>/i),
    description: readTagContent(html, /<meta\s+name="description"\s+content="(.*?)"/i),
    canonical: readTagContent(html, /<link\s+rel="canonical"\s+href="(.*?)"/i),
    robots: readTagContent(html, /<meta\s+name="robots"\s+content="(.*?)"/i),
    htmlLang: readTagContent(html, /<html[^>]*\slang="([^"]+)"/i),
    h1Count: countMatches(html, /<h1(?:\s|>)/gi),
    jsonLdCount: countMatches(html, /<script[^>]*type="application\/ld\+json"[^>]*>/gi),
    internalCopyLeaks: findInternalCopyLeaks(html),
  };
}

function validateSitemapPageSeo(url: string, signals: PageSeoSignals): string[] {
  const errors: string[] = [];
  const expectedCanonical = normalizeComparableUrl(url);
  const canonical = signals.canonical ? normalizeComparableUrl(signals.canonical) : null;
  const robots = signals.robots?.toLowerCase() || '';
  const titleLength = signals.title?.length || 0;
  const descriptionLength = signals.description?.length || 0;
  const descriptionMinLength = getDescriptionMinLength(signals.htmlLang);

  if (!signals.title) errors.push('missing title');
  if (signals.title && (titleLength < 10 || titleLength > 85)) errors.push(`title length ${titleLength}`);
  if (!signals.description) errors.push('missing meta description');
  if (signals.description && (descriptionLength < descriptionMinLength || descriptionLength > 180)) {
    errors.push(`meta description length ${descriptionLength}`);
  }
  if (!signals.canonical) errors.push('missing canonical');
  if (canonical && canonical !== expectedCanonical) {
    errors.push(`canonical mismatch: ${signals.canonical}`);
  }
  if (robots.includes('noindex') || /\bnone\b/.test(robots)) {
    errors.push(`robots blocks indexing: ${signals.robots}`);
  }
  if (!signals.htmlLang) errors.push('missing html lang');
  if (signals.h1Count < 1) errors.push('missing h1');
  if (signals.internalCopyLeaks.length > 0) {
    errors.push(`internal copy leak: ${signals.internalCopyLeaks.slice(0, 5).join(', ')}`);
  }

  return errors;
}

function getDescriptionMinLength(htmlLang: string | null): number {
  const locale = htmlLang?.split('-')[0]?.toLowerCase();
  if (locale === 'zh' || locale === 'ja' || locale === 'ko') return 24;
  if (locale === 'ar') return 35;
  if (locale === 'ru') return 40;
  return 50;
}

function classifyStatus(status: number): '2xx' | '3xx' | '4xx' | '5xx' | 'other' {
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 300 && status < 400) return '3xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500 && status < 600) return '5xx';
  return 'other';
}

function routeBucketFromUrl(url: string): string {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url;
  }

  if (/^\/[a-z]{2}\/skills\/[^/]+\/.+/.test(pathname)) return 'skills_detail';
  if (/^\/[a-z]{2}\/skills$/.test(pathname)) return 'skills_index';
  if (/^\/[a-z]{2}\/collections(?:\/|$)/.test(pathname)) return 'collections';
  if (/^\/[a-z]{2}\/categories(?:\/|$)/.test(pathname)) return 'categories';
  if (/^\/[a-z]{2}\/solutions(?:\/|$)/.test(pathname)) return 'solutions';
  if (/^\/[a-z]{2}\/blog(?:\/|$)/.test(pathname)) return 'blog';
  if (/^\/[a-z]{2}\/docs(?:\/|$)/.test(pathname)) return 'docs';
  return 'other';
}

function countByRouteBucket(rows: UrlCheckResult[]): Array<{ bucket: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const bucket = routeBucketFromUrl(row.finalUrl || row.url);
    counts.set(bucket, (counts.get(bucket) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => b.count - a.count);
}

async function fetchText(url: string): Promise<string> {
  const requestUrl = toRequestUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(requestUrl, { signal: controller.signal, redirect: 'follow' });
    ensure(response.ok, `${requestUrl}: expected 200, got ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function collectSitemaps(startSitemapUrl: string): Promise<SitemapsCollected> {
  const queue = [startSitemapUrl];
  const visited = new Set<string>();
  const sitemapUrls: string[] = [];
  const urlsBySitemap = new Map<string, string[]>();
  const sitemapErrors: Array<{ sitemapUrl: string; error: string }> = [];

  while (queue.length > 0) {
    const sitemapUrl = queue.shift()!;
    if (visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);
    sitemapUrls.push(sitemapUrl);

    let xml: string;
    try {
      xml = await fetchText(sitemapUrl);
    } catch (error) {
      sitemapErrors.push({
        sitemapUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    const locs = parseLocs(xml);
    urlsBySitemap.set(sitemapUrl, locs);

    for (const loc of locs) {
      if (isSitemapUrl(loc) && !visited.has(loc)) {
        queue.push(loc);
      }
    }
  }

  const allDiscoveredUrls = unique(
    Array.from(urlsBySitemap.entries()).flatMap(([, locs]) => locs.filter((loc) => !isSitemapUrl(loc))),
  );

  return { sitemapUrls, urlsBySitemap, allDiscoveredUrls, sitemapErrors };
}

function buildSample(crawl: SitemapsCollected): { sampledUrls: string[]; bySitemap: Map<string, number> } {
  const sampled: string[] = [];
  const bySitemap = new Map<string, number>();

  for (const [sitemapUrl, locs] of crawl.urlsBySitemap.entries()) {
    const pageLocs = locs.filter((loc) => !isSitemapUrl(loc));
    if (pageLocs.length === 0) continue;

    const parsed = new URL(sitemapUrl);
    const isSkillsSitemap = /\/sitemap-skills(?:-\d+)?\.xml$/i.test(parsed.pathname);
    const limit = isSkillsSitemap ? SKILLS_SITEMAP_SAMPLE_LIMIT : NON_SKILLS_SITEMAP_SAMPLE_LIMIT;
    const selected = sampleEvenly(pageLocs, limit);
    sampled.push(...selected);
    bySitemap.set(sitemapUrl, selected.length);
  }

  return { sampledUrls: unique(sampled), bySitemap };
}

async function checkUrl(url: string): Promise<UrlCheckResult> {
  let lastError: string | undefined;
  let lastStatus = 0;
  let lastFinalUrl = url;
  let lastRedirected = false;
  let attempts = 0;
  let fiveXxAttempts = 0;
  let sawCloudflare1102 = false;

  for (let attempt = 1; attempt <= CHECK_RETRIES + 1; attempt++) {
    attempts = attempt;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const requestUrl = toRequestUrl(url);
      const response = await fetch(requestUrl, { signal: controller.signal, redirect: 'follow' });
      const contentType = response.headers.get('content-type') || undefined;
      lastStatus = response.status;
      lastFinalUrl = response.url;
      lastRedirected = response.redirected;
      let seoSignals: PageSeoSignals | undefined;
      let onPageErrors: string[] = [];

      if (response.status >= 500) {
        fiveXxAttempts++;
        try {
          const body = await response.text();
          if (/\berror code:\s*1102\b/i.test(body)) {
            sawCloudflare1102 = true;
          }
        } catch {
          // ignore body parse failures
        }

        if (attempt <= CHECK_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, attempt * CHECK_RETRY_DELAY_MS));
          continue;
        }
      } else if (
        response.status >= 200 &&
        response.status < 300 &&
        contentType?.includes('text/html') &&
        !(isLocalBaseUrl && routeBucketFromUrl(url) === 'skills_detail')
      ) {
        const body = await response.text();
        seoSignals = extractPageSeoSignals(body);
        onPageErrors = validateSitemapPageSeo(url, seoSignals);
      }

      return {
        url,
        status: response.status,
        redirected: response.redirected,
        finalUrl: response.url,
        attempts,
        fiveXxAttempts,
        recoveredFrom5xx: response.status < 500 && fiveXxAttempts > 0,
        sawCloudflare1102,
        contentType,
        seoSignals,
        onPageErrors,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt <= CHECK_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, attempt * CHECK_RETRY_DELAY_MS));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    url,
    status: lastStatus,
    redirected: lastRedirected,
    finalUrl: lastFinalUrl,
    error: lastError || 'unknown error',
    attempts,
    fiveXxAttempts,
    recoveredFrom5xx: lastStatus > 0 && lastStatus < 500 && fiveXxAttempts > 0,
    sawCloudflare1102,
    onPageErrors: [],
  };
}

async function checkUrls(urls: string[]): Promise<UrlCheckResult[]> {
  const results: UrlCheckResult[] = [];
  const queue = [...urls];

  const workers = Array.from({ length: Math.min(CHECK_CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const nextUrl = queue.shift();
      if (!nextUrl) return;
      results.push(await checkUrl(nextUrl));
    }
  });

  await Promise.all(workers);
  return results;
}

function buildReport(
  crawl: SitemapsCollected,
  sampledUrls: string[],
  sampledBySitemap: Map<string, number>,
  results: UrlCheckResult[],
): string {
  const statusBuckets = { ['2xx']: 0, ['3xx']: 0, ['4xx']: 0, ['5xx']: 0, ['other']: 0 };
  for (const result of results) {
    statusBuckets[classifyStatus(result.status)]++;
  }

  const redirects = results.filter((r) => r.redirected);
  const errors = results.filter((r) => r.status === 0 || r.status >= 400);
  const networkErrors = results.filter((r) => r.status === 0);
  const networkErrorRate = results.length > 0 ? networkErrors.length / results.length : 0;
  const flakyRecovered = results.filter((r) => r.recoveredFrom5xx);
  const urlsWith5xxAttempts = results.filter((r) => r.fiveXxAttempts > 0);
  const cloudflare1102Hits = results.filter((r) => r.sawCloudflare1102);
  const onPageSeoErrors = results.filter((r) => r.onPageErrors.length > 0);
  const duplicates = findDuplicates(crawl.allDiscoveredUrls);
  const flakyByRouteBucket = countByRouteBucket(flakyRecovered);
  const errorByRouteBucket = countByRouteBucket(errors);
  const onPageSeoErrorsByRouteBucket = countByRouteBucket(onPageSeoErrors);

  const lines: string[] = [];
  lines.push('# SEO Crawl Health Report');
  lines.push('');
  lines.push(`- Generated: ${crawlDate}`);
  lines.push(`- Root sitemap: ${rootSitemapUrl}`);
  lines.push(`- Sitemap files discovered: ${crawl.sitemapUrls.length}`);
  lines.push(`- Page URLs discovered (full): ${crawl.allDiscoveredUrls.length}`);
  lines.push(`- Page URLs checked (sampled): ${sampledUrls.length}`);
  lines.push('');
  lines.push('## HTTP Status Summary');
  lines.push('');
  lines.push(`- 2xx: ${statusBuckets['2xx']}`);
  lines.push(`- 3xx: ${statusBuckets['3xx']}`);
  lines.push(`- 4xx: ${statusBuckets['4xx']}`);
  lines.push(`- 5xx: ${statusBuckets['5xx']}`);
  lines.push(`- Other/Network: ${statusBuckets['other']}`);
  lines.push(`- Network failure rate: ${(networkErrorRate * 100).toFixed(2)}%`);
  lines.push(`- URLs with any 5xx attempt: ${urlsWith5xxAttempts.length}`);
  lines.push(`- Recovered flaky 5xx URLs: ${flakyRecovered.length}`);
  lines.push(`- Cloudflare 1102 signals: ${cloudflare1102Hits.length}`);
  lines.push(`- On-page SEO errors in sampled sitemap URLs: ${onPageSeoErrors.length}`);
  lines.push(`- Sitemap fetch errors: ${crawl.sitemapErrors.length}`);

  if (flakyByRouteBucket.length > 0) {
    lines.push('- Recovered flaky 5xx by route bucket:');
    for (const item of flakyByRouteBucket.slice(0, 8)) {
      lines.push(`  - ${item.bucket}: ${item.count}`);
    }
  }

  if (errorByRouteBucket.length > 0) {
    lines.push('- Error URLs by route bucket:');
    for (const item of errorByRouteBucket.slice(0, 8)) {
      lines.push(`  - ${item.bucket}: ${item.count}`);
    }
  }
  if (onPageSeoErrorsByRouteBucket.length > 0) {
    lines.push('- On-page SEO errors by route bucket:');
    for (const item of onPageSeoErrorsByRouteBucket.slice(0, 8)) {
      lines.push(`  - ${item.bucket}: ${item.count}`);
    }
  }
  lines.push('');
  lines.push('## Sitemap Sampling Coverage');
  lines.push('');
  for (const [sitemapUrl, count] of sampledBySitemap.entries()) {
    const total = crawl.urlsBySitemap.get(sitemapUrl)?.filter((loc) => !isSitemapUrl(loc)).length || 0;
    lines.push(`- ${sitemapUrl}: sampled ${count}/${total}`);
  }

  if (duplicates.length > 0) {
    lines.push('');
    lines.push('## Duplicate URLs In Sitemaps');
    lines.push('');
    for (const dup of duplicates.slice(0, 30)) {
      lines.push(`- ${dup}`);
    }
    if (duplicates.length > 30) {
      lines.push(`- ... and ${duplicates.length - 30} more`);
    }
  }

  if (crawl.sitemapErrors.length > 0) {
    lines.push('');
    lines.push('## Sitemap Fetch Errors');
    lines.push('');
    for (const row of crawl.sitemapErrors.slice(0, 30)) {
      lines.push(`- ${row.sitemapUrl} -> ${row.error}`);
    }
    if (crawl.sitemapErrors.length > 30) {
      lines.push(`- ... and ${crawl.sitemapErrors.length - 30} more`);
    }
  }

  if (redirects.length > 0) {
    lines.push('');
    lines.push('## Redirected URLs (Sample)');
    lines.push('');
    for (const row of redirects.slice(0, 30)) {
      lines.push(`- ${row.url} -> ${row.finalUrl} (${row.status})`);
    }
    if (redirects.length > 30) {
      lines.push(`- ... and ${redirects.length - 30} more`);
    }
  }

  if (flakyRecovered.length > 0) {
    lines.push('');
    lines.push('## Recovered Flaky 5xx (Sample)');
    lines.push('');
    for (const row of flakyRecovered.slice(0, 30)) {
      lines.push(`- ${row.url} -> ${row.finalUrl} (${row.status}, retries=${row.fiveXxAttempts})`);
    }
    if (flakyRecovered.length > 30) {
      lines.push(`- ... and ${flakyRecovered.length - 30} more`);
    }
  }

  if (cloudflare1102Hits.length > 0) {
    lines.push('');
    lines.push('## Cloudflare 1102 Signals (Sample)');
    lines.push('');
    for (const row of cloudflare1102Hits.slice(0, 30)) {
      lines.push(`- ${row.url} -> ${row.status || 'NETWORK_ERROR'} (attempts=${row.attempts})`);
    }
    if (cloudflare1102Hits.length > 30) {
      lines.push(`- ... and ${cloudflare1102Hits.length - 30} more`);
    }
  }

  if (onPageSeoErrors.length > 0) {
    lines.push('');
    lines.push('## On-Page SEO Errors In Sampled Sitemap URLs');
    lines.push('');
    for (const row of onPageSeoErrors.slice(0, 50)) {
      lines.push(`- ${row.url} -> ${row.onPageErrors.join('; ')}`);
    }
    if (onPageSeoErrors.length > 50) {
      lines.push(`- ... and ${onPageSeoErrors.length - 50} more`);
    }
  }

  if (errors.length > 0) {
    lines.push('');
    lines.push('## Errors (4xx/5xx/Network)');
    lines.push('');
    for (const row of errors.slice(0, 50)) {
      const errorBits: string[] = [];
      if (row.error) errorBits.push(row.error);
      if (row.fiveXxAttempts > 0) errorBits.push(`5xx-attempts=${row.fiveXxAttempts}`);
      if (row.recoveredFrom5xx) errorBits.push('recovered-after-retry');
      if (row.sawCloudflare1102) errorBits.push('cf-1102');
      lines.push(
        `- ${row.url} -> ${row.status || 'NETWORK_ERROR'}${errorBits.length > 0 ? ` (${errorBits.join('; ')})` : ''}`,
      );
    }
    if (errors.length > 50) {
      lines.push(`- ... and ${errors.length - 50} more`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function buildJsonReport(
  crawl: SitemapsCollected,
  sampledUrls: string[],
  sampledBySitemap: Map<string, number>,
  results: UrlCheckResult[],
): CrawlHealthJsonReport {
  const statusBuckets = { ['2xx']: 0, ['3xx']: 0, ['4xx']: 0, ['5xx']: 0, ['other']: 0 };
  for (const result of results) {
    statusBuckets[classifyStatus(result.status)]++;
  }

  const redirects = results.filter((r) => r.redirected);
  const errors = results.filter((r) => r.status === 0 || r.status >= 400);
  const flakyRecovered = results.filter((r) => r.recoveredFrom5xx);
  const cloudflare1102 = results.filter((r) => r.sawCloudflare1102);
  const onPageSeoErrors = results.filter((r) => r.onPageErrors.length > 0);
  const duplicates = findDuplicates(crawl.allDiscoveredUrls);

  return {
    generatedAt: crawlDate,
    rootSitemap: rootSitemapUrl,
    totals: {
      sitemapFilesDiscovered: crawl.sitemapUrls.length,
      pageUrlsDiscovered: crawl.allDiscoveredUrls.length,
      pageUrlsChecked: sampledUrls.length,
    },
    statusSummary: {
      status2xx: statusBuckets['2xx'],
      status3xx: statusBuckets['3xx'],
      status4xx: statusBuckets['4xx'],
      status5xx: statusBuckets['5xx'],
      statusOther: statusBuckets['other'],
    },
    sampledCoverage: Array.from(sampledBySitemap.entries()).map(([sitemapUrl, sampled]) => ({
      sitemapUrl,
      sampled,
      total: crawl.urlsBySitemap.get(sitemapUrl)?.filter((loc) => !isSitemapUrl(loc)).length || 0,
    })),
    redirects,
    flakyRecovered,
    cloudflare1102,
    onPageSeoErrors,
    errors,
    duplicates,
    sitemapErrors: crawl.sitemapErrors,
    results,
  };
}

function findDuplicates(urls: string[]): string[] {
  const counts = new Map<string, number>();
  for (const url of urls) {
    counts.set(url, (counts.get(url) || 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([url]) => url);
}

function writeReports(markdown: string, json: CrawlHealthJsonReport): void {
  const reportDir = resolve(process.cwd(), 'reports/seo');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(resolve(reportDir, `crawl-health-${crawlDateKey}.md`), markdown, 'utf8');
  writeFileSync(resolve(reportDir, 'latest-crawl-health.md'), markdown, 'utf8');
  writeFileSync(resolve(reportDir, `crawl-health-${crawlDateKey}.json`), `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  writeFileSync(resolve(reportDir, 'latest-crawl-health.json'), `${JSON.stringify(json, null, 2)}\n`, 'utf8');
}

async function main() {
  console.log(`[crawl-health] collecting sitemap graph from ${rootSitemapUrl}`);
  const crawl = await collectSitemaps(rootSitemapUrl);
  const { sampledUrls, bySitemap } = buildSample(crawl);
  console.log(`[crawl-health] discovered=${crawl.allDiscoveredUrls.length}, sampled=${sampledUrls.length}`);

  const results = await checkUrls(sampledUrls);
  const report = buildReport(crawl, sampledUrls, bySitemap, results);
  const jsonReport = buildJsonReport(crawl, sampledUrls, bySitemap, results);
  writeReports(report, jsonReport);

  const status4xxCount = results.filter((r) => r.status >= 400 && r.status < 500).length;
  const status4xxRate = results.length > 0 ? status4xxCount / results.length : 0;
  const status5xxCount = results.filter((r) => r.status >= 500).length;
  const status5xxRate = results.length > 0 ? status5xxCount / results.length : 0;
  const flakyRecoveredCount = results.filter((r) => r.recoveredFrom5xx).length;
  const flakyRecoveredRate = results.length > 0 ? flakyRecoveredCount / results.length : 0;
  const cloudflare1102Count = results.filter((r) => r.sawCloudflare1102).length;
  const redirectCount = results.filter((r) => r.redirected).length;
  const onPageSeoErrorCount = results.filter((r) => r.onPageErrors.length > 0).length;
  const hasHard4xx = status4xxRate > HARD_FAIL_4XX_RATE;
  const hasHard5xx = status5xxCount >= HARD_FAIL_5XX_MIN || status5xxRate > HARD_FAIL_5XX_RATE;
  const hasHardFlaky5xx =
    flakyRecoveredCount >= HARD_FAIL_FLAKY_5XX_MIN || flakyRecoveredRate > HARD_FAIL_FLAKY_5XX_RATE;
  const hasCloudflare1102 = cloudflare1102Count >= HARD_FAIL_CF1102_MIN;
  const hasRedirects = HARD_FAIL_REDIRECTS && redirectCount > 0;
  const hasOnPageSeoErrors = HARD_FAIL_ONPAGE_SEO && onPageSeoErrorCount > 0;
  const networkErrors = results.filter((r) => r.status === 0).length;
  const networkErrorRate = results.length > 0 ? networkErrors / results.length : 0;
  const hasNetworkInstability = networkErrors >= 5 && networkErrorRate > 0.05;
  const hasDuplicates = findDuplicates(crawl.allDiscoveredUrls).length > 0;
  const hasSitemapErrors = crawl.sitemapErrors.length > 0;
  const hasSevereSignal =
    hasHard4xx ||
    hasHard5xx ||
    hasHardFlaky5xx ||
    hasCloudflare1102 ||
    hasRedirects ||
    hasOnPageSeoErrors ||
    hasDuplicates ||
    hasNetworkInstability ||
    hasSitemapErrors;

  console.log(report);
  if (!hasHard4xx && status4xxCount > 0) {
    console.warn(
      `[crawl-health] tolerated dynamic 4xx errors (skills missing): ${status4xxCount}/${results.length} (${(
        status4xxRate * 100
      ).toFixed(2)}%)`,
    );
  }
  if (!hasHard5xx && status5xxCount > 0) {
    console.warn(
      `[crawl-health] tolerated transient 5xx errors: ${status5xxCount}/${results.length} (${(
        status5xxRate * 100
      ).toFixed(2)}%)`,
    );
  }
  if (!hasHardFlaky5xx && flakyRecoveredCount > 0) {
    console.warn(
      `[crawl-health] recovered flaky 5xx URLs detected: ${flakyRecoveredCount}/${results.length} (${(
        flakyRecoveredRate * 100
      ).toFixed(2)}%)`,
    );
  }
  if (cloudflare1102Count > 0) {
    const cloudflare1102Message = `[crawl-health] Cloudflare 1102 signals detected: ${cloudflare1102Count}/${results.length}`;
    if (hasCloudflare1102) {
      console.error(cloudflare1102Message);
    } else {
      console.warn(cloudflare1102Message);
    }
  }
  if (redirectCount > 0) {
    const redirectMessage = `[crawl-health] sitemap URLs redirected: ${redirectCount}/${results.length}`;
    if (hasRedirects) {
      console.error(redirectMessage);
    } else {
      console.warn(redirectMessage);
    }
  }
  if (onPageSeoErrorCount > 0) {
    const onPageMessage = `[crawl-health] sampled sitemap pages with on-page SEO errors: ${onPageSeoErrorCount}/${results.length}`;
    if (hasOnPageSeoErrors) {
      console.error(onPageMessage);
    } else {
      console.warn(onPageMessage);
    }
  }
  if (hasSitemapErrors) {
    console.error(`[crawl-health] sitemap fetch failures detected: ${crawl.sitemapErrors.length}`);
  }
  if (hasSevereSignal) {
    console.error('[crawl-health] failed: hard crawl/indexing errors detected');
    if (!allowBlockingExit) {
      process.exit(1);
    }
    console.warn('[crawl-health] continuing with exit code 0 because --allow-blocking-exit was set');
    return;
  }

  console.log('[crawl-health] passed');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
