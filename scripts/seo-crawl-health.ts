#!/usr/bin/env npx tsx

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type SitemapsCollected = {
  sitemapUrls: string[];
  urlsBySitemap: Map<string, string[]>;
  allDiscoveredUrls: string[];
};

type UrlCheckResult = {
  url: string;
  status: number;
  redirected: boolean;
  finalUrl: string;
  error?: string;
};

const SITE_ORIGIN = 'https://killer-skills.com';
const baseUrl = (process.argv[2] || SITE_ORIGIN).replace(/\/+$/, '');
const baseOrigin = new URL(baseUrl).origin;
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

function classifyStatus(status: number): '2xx' | '3xx' | '4xx' | '5xx' | 'other' {
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 300 && status < 400) return '3xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500 && status < 600) return '5xx';
  return 'other';
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

  while (queue.length > 0) {
    const sitemapUrl = queue.shift()!;
    if (visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);
    sitemapUrls.push(sitemapUrl);

    const xml = await fetchText(sitemapUrl);
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

  return { sitemapUrls, urlsBySitemap, allDiscoveredUrls };
}

function buildSample(crawl: SitemapsCollected): { sampledUrls: string[]; bySitemap: Map<string, number> } {
  const sampled: string[] = [];
  const bySitemap = new Map<string, number>();

  for (const [sitemapUrl, locs] of crawl.urlsBySitemap.entries()) {
    const pageLocs = locs.filter((loc) => !isSitemapUrl(loc));
    if (pageLocs.length === 0) continue;

    const parsed = new URL(sitemapUrl);
    const isSkillsSitemap = /\/sitemap-skills-\d+\.xml$/i.test(parsed.pathname);
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

  for (let attempt = 1; attempt <= CHECK_RETRIES + 1; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const requestUrl = toRequestUrl(url);
      const response = await fetch(requestUrl, { signal: controller.signal, redirect: 'follow' });
      lastStatus = response.status;
      lastFinalUrl = response.url;
      lastRedirected = response.redirected;

      if (response.status >= 500 && attempt <= CHECK_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, attempt * CHECK_RETRY_DELAY_MS));
        continue;
      }

      return {
        url,
        status: response.status,
        redirected: response.redirected,
        finalUrl: response.url,
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
  const duplicates = findDuplicates(crawl.allDiscoveredUrls);

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

  if (errors.length > 0) {
    lines.push('');
    lines.push('## Errors (4xx/5xx/Network)');
    lines.push('');
    for (const row of errors.slice(0, 50)) {
      lines.push(`- ${row.url} -> ${row.status || 'NETWORK_ERROR'}${row.error ? ` (${row.error})` : ''}`);
    }
    if (errors.length > 50) {
      lines.push(`- ... and ${errors.length - 50} more`);
    }
  }

  return `${lines.join('\n')}\n`;
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

function writeReports(content: string): void {
  const reportDir = resolve(process.cwd(), 'reports/seo');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(resolve(reportDir, `crawl-health-${crawlDateKey}.md`), content, 'utf8');
  writeFileSync(resolve(reportDir, 'latest-crawl-health.md'), content, 'utf8');
}

async function main() {
  console.log(`[crawl-health] collecting sitemap graph from ${rootSitemapUrl}`);
  const crawl = await collectSitemaps(rootSitemapUrl);
  const { sampledUrls, bySitemap } = buildSample(crawl);
  console.log(`[crawl-health] discovered=${crawl.allDiscoveredUrls.length}, sampled=${sampledUrls.length}`);

  const results = await checkUrls(sampledUrls);
  const report = buildReport(crawl, sampledUrls, bySitemap, results);
  writeReports(report);

  const status4xxCount = results.filter((r) => r.status >= 400 && r.status < 500).length;
  const status4xxRate = results.length > 0 ? status4xxCount / results.length : 0;
  const status5xxCount = results.filter((r) => r.status >= 500).length;
  const status5xxRate = results.length > 0 ? status5xxCount / results.length : 0;
  const hasHard4xx = status4xxRate > HARD_FAIL_4XX_RATE;
  const hasHard5xx = status5xxCount >= HARD_FAIL_5XX_MIN || status5xxRate > HARD_FAIL_5XX_RATE;
  const networkErrors = results.filter((r) => r.status === 0).length;
  const networkErrorRate = results.length > 0 ? networkErrors / results.length : 0;
  const hasNetworkInstability = networkErrors >= 5 && networkErrorRate > 0.05;
  const hasDuplicates = findDuplicates(crawl.allDiscoveredUrls).length > 0;
  const hasSevereSignal = hasHard4xx || hasHard5xx || hasDuplicates || hasNetworkInstability;

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
  if (hasSevereSignal) {
    console.error('[crawl-health] failed: hard crawl/indexing errors detected');
    process.exit(1);
  }

  console.log('[crawl-health] passed');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
