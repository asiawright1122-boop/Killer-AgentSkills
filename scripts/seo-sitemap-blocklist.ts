#!/usr/bin/env npx tsx

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

type OutputPayload = {
  generatedAt: string;
  sourceReport: string | null;
  mode: 'merge' | 'replace';
  stats: {
    excludeExact: number;
    excludeRepo: number;
    ignored: number;
    d1Checked?: number;
    d1Missing?: number;
  };
  rules: {
    excludeExact: string[];
    excludeRepo: string[];
  };
};

const DEFAULT_REPORT_PATH = resolve(process.cwd(), 'reports/seo/latest-crawl-health.md');
const DEFAULT_JSON_REPORT_PATH = resolve(process.cwd(), 'reports/seo/latest-crawl-health.json');
const DEFAULT_OUTPUT_PATH = resolve(process.cwd(), 'data/seo-sitemap-blocklist.json');
const DEFAULT_SITEMAP_PATH = resolve(process.cwd(), 'data/sitemap-skills.json');
const WRANGLER_CONFIG_PATH = resolve(process.cwd(), 'wrangler.toml');
const SKILL_PATH_REGEX = /^\/[a-z]{2}\/skills\/([^/]+)\/(.+)$/i;
const D1_IN_CLAUSE_CHUNK_SIZE = 120;

type CrawlHealthJsonErrorItem = {
  url?: string;
  status?: number;
};

type CrawlHealthJsonPayload = {
  errors?: CrawlHealthJsonErrorItem[];
  results?: CrawlHealthJsonErrorItem[];
};

type SitemapSkillRecord = {
  owner?: unknown;
  routePath?: unknown;
};

type D1Config = {
  accountId: string;
  apiToken: string;
  databaseIds: string[];
};

type SitemapEntry = {
  owner: string;
  routePath: string;
};

function parseArgs(argv: string[]): {
  reportPath: string;
  jsonReportPath: string;
  outputPath: string;
  sitemapPath: string;
  includeD1Gaps: boolean;
  pruneStale: boolean;
  mode: 'merge' | 'replace';
} {
  let reportPath = DEFAULT_REPORT_PATH;
  let jsonReportPath = DEFAULT_JSON_REPORT_PATH;
  let outputPath = DEFAULT_OUTPUT_PATH;
  let sitemapPath = DEFAULT_SITEMAP_PATH;
  let includeD1Gaps = false;
  let pruneStale = false;
  let mode: 'merge' | 'replace' = 'merge';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--report' && argv[i + 1]) {
      reportPath = resolve(argv[i + 1]);
      i++;
      continue;
    }
    if (arg === '--output' && argv[i + 1]) {
      outputPath = resolve(argv[i + 1]);
      i++;
      continue;
    }
    if (arg === '--json-report' && argv[i + 1]) {
      jsonReportPath = resolve(argv[i + 1]);
      i++;
      continue;
    }
    if (arg === '--sitemap' && argv[i + 1]) {
      sitemapPath = resolve(argv[i + 1]);
      i++;
      continue;
    }
    if (arg === '--include-d1-gaps') {
      includeD1Gaps = true;
      continue;
    }
    if (arg === '--replace') {
      mode = 'replace';
    }
    if (arg === '--prune-stale') {
      pruneStale = true;
    }
  }

  return { reportPath, jsonReportPath, outputPath, sitemapPath, includeD1Gaps, pruneStale, mode };
}

function decodePathPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function extract404Urls(markdown: string): string[] {
  const urls: string[] = [];
  for (const line of markdown.split('\n')) {
    const match = line.match(/^- (https?:\/\/\S+)\s+->\s+404\b/i);
    if (!match) continue;
    urls.push(match[1]);
  }
  return urls;
}

function extract404UrlsFromJson(rawJson: string): string[] {
  let parsed: CrawlHealthJsonPayload;
  try {
    parsed = JSON.parse(rawJson) as CrawlHealthJsonPayload;
  } catch (error) {
    throw new Error(`invalid crawl health json: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }

  const rows = Array.isArray(parsed.errors) ? parsed.errors : Array.isArray(parsed.results) ? parsed.results : [];

  const urls: string[] = [];
  for (const row of rows) {
    if (row?.status !== 404) continue;
    if (typeof row.url !== 'string' || !row.url) continue;
    urls.push(row.url);
  }

  return urls;
}

function extractVerifiedNon404SkillKeys(rawJson: string): Set<string> {
  const keys = new Set<string>();
  let parsed: { results?: Array<{ url?: string; status?: number }> };
  try {
    parsed = JSON.parse(rawJson) as typeof parsed;
  } catch {
    return keys;
  }
  const rows = Array.isArray(parsed.results) ? parsed.results : [];
  for (const row of rows) {
    if (typeof row.url !== 'string' || !row.url) continue;
    if (row.status === 404) continue;
    if (typeof row.status !== 'number' || row.status < 200 || row.status >= 400) continue;
    let urlObj: URL;
    try {
      urlObj = new URL(row.url);
    } catch {
      continue;
    }
    const skillMatch = urlObj.pathname.match(SKILL_PATH_REGEX);
    if (!skillMatch) continue;
    const owner = decodePathPart(skillMatch[1]).trim();
    const routePath = decodePathPart(skillMatch[2]).trim();
    if (!owner || !routePath) continue;
    keys.add(`${normalize(owner)}/${normalize(routePath)}`);
  }
  return keys;
}

function parseArrayOfNormalizedStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => normalize(String(item))).filter(Boolean);
}

function normalizeSitemapEntries(raw: unknown): SitemapEntry[] {
  const records = (Array.isArray(raw) ? raw : (raw as { skills?: SitemapSkillRecord[] })?.skills || []) as SitemapSkillRecord[];
  const entries: SitemapEntry[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    const owner = typeof record.owner === 'string' ? record.owner.trim() : '';
    const routePath = typeof record.routePath === 'string' ? record.routePath.trim() : '';
    if (!owner || !routePath) continue;

    const key = `${normalize(owner)}/${normalize(routePath)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ owner, routePath });
  }

  return entries;
}

function readDatabaseIdFromWrangler(): string {
  if (!existsSync(WRANGLER_CONFIG_PATH)) return '';
  const content = readFileSync(WRANGLER_CONFIG_PATH, 'utf8');
  const match = content.match(/\bdatabase_id\s*=\s*"([^"]+)"/);
  return match?.[1]?.trim() || '';
}

function resolveD1Config(): D1Config | null {
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = String(process.env.CLOUDFLARE_D1_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '').trim();
  const envDatabaseId = String(process.env.CLOUDFLARE_D1_DATABASE_ID || '').trim();
  const wranglerDatabaseId = String(readDatabaseIdFromWrangler() || '').trim();
  const databaseIds = Array.from(new Set([envDatabaseId, wranglerDatabaseId].filter(Boolean)));

  if (!accountId || !apiToken || databaseIds.length === 0) return null;
  return { accountId, apiToken, databaseIds };
}

function escapeSqlValue(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function queryD1(config: D1Config, sql: string): Promise<Array<Record<string, unknown>>> {
  let lastError = 'unknown D1 error';

  for (const databaseId of config.databaseIds) {
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${databaseId}/query`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      errors?: Array<{ message?: string }>;
      result?: Array<{ success?: boolean; errors?: Array<{ message?: string }>; results?: Array<Record<string, unknown>> }>;
    };
    const statements = Array.isArray(payload.result) ? payload.result : [];
    const statementFailures = statements.filter((statement) => statement?.success === false);

    if (!response.ok || payload.success === false || statementFailures.length > 0) {
      const message =
        payload.errors?.[0]?.message ||
        statementFailures?.[0]?.errors?.[0]?.message ||
        statements?.[0]?.errors?.[0]?.message ||
        `${response.status} ${response.statusText}`;
      lastError = String(message);
      const notFound = /database\s+[a-f0-9-]+\s+could not be found/i.test(lastError);
      if (notFound) continue;
      throw new Error(`D1 query failed: ${lastError}`);
    }

    const first = statements[0];
    return Array.isArray(first?.results) ? first.results : [];
  }

  throw new Error(`D1 query failed: ${lastError}`);
}

async function collectMissingSitemapEntriesInD1(entries: SitemapEntry[], config: D1Config): Promise<SitemapEntry[]> {
  if (entries.length === 0) return [];

  const idToEntry = new Map<string, SitemapEntry>();
  for (const entry of entries) {
    const id = `${entry.owner}/${entry.routePath}`;
    idToEntry.set(id, entry);
  }
  const ids = Array.from(idToEntry.keys());
  const existingIds = new Set<string>();

  for (let i = 0; i < ids.length; i += D1_IN_CLAUSE_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + D1_IN_CLAUSE_CHUNK_SIZE);
    const inClause = chunk.map((id) => escapeSqlValue(id)).join(', ');
    const sql = `SELECT id FROM skills WHERE id IN (${inClause});`;
    const rows = await queryD1(config, sql);
    for (const row of rows) {
      const id = typeof row.id === 'string' ? row.id : '';
      if (id) existingIds.add(id);
    }
  }

  return ids.filter((id) => !existingIds.has(id)).map((id) => idToEntry.get(id)!).filter(Boolean);
}

function loadExistingRules(outputPath: string): { exactKeys: Set<string>; repoKeys: Set<string> } {
  if (!existsSync(outputPath)) {
    return { exactKeys: new Set<string>(), repoKeys: new Set<string>() };
  }

  try {
    const parsed = JSON.parse(readFileSync(outputPath, 'utf8')) as OutputPayload;
    return {
      exactKeys: new Set(parseArrayOfNormalizedStrings(parsed?.rules?.excludeExact)),
      repoKeys: new Set(parseArrayOfNormalizedStrings(parsed?.rules?.excludeRepo)),
    };
  } catch (error) {
    console.warn(
      `Failed to parse existing sitemap blocklist (${outputPath}), continuing without merge source: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return { exactKeys: new Set<string>(), repoKeys: new Set<string>() };
  }
}

async function main() {
  const { reportPath, jsonReportPath, outputPath, sitemapPath, includeD1Gaps, pruneStale, mode } = parseArgs(process.argv.slice(2));
  const hasJsonReport = existsSync(jsonReportPath);
  const hasMarkdownReport = existsSync(reportPath);
  if (!hasJsonReport && !hasMarkdownReport) {
    console.error(`Missing crawl report: ${reportPath}`);
    console.error(`Missing crawl json report: ${jsonReportPath}`);
    process.exit(1);
  }

  let sourceReportPath: string | null = null;
  let urls: string[] = [];

  if (hasJsonReport) {
    const jsonRaw = readFileSync(jsonReportPath, 'utf8');
    urls = extract404UrlsFromJson(jsonRaw);
    sourceReportPath = jsonReportPath;
  }

  if (urls.length === 0 && hasMarkdownReport) {
    const markdown = readFileSync(reportPath, 'utf8');
    urls = extract404Urls(markdown);
    sourceReportPath = reportPath;
  }

  const exactKeys = new Set<string>();
  const repoKeys = new Set<string>();
  let ignored = 0;

  for (const url of urls) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      ignored++;
      continue;
    }

    const skillMatch = parsed.pathname.match(SKILL_PATH_REGEX);
    if (!skillMatch) {
      ignored++;
      continue;
    }

    const owner = decodePathPart(skillMatch[1]).trim();
    const routePath = decodePathPart(skillMatch[2]).trim();
    if (!owner || !routePath) {
      ignored++;
      continue;
    }

    exactKeys.add(`${normalize(owner)}/${normalize(routePath)}`);

    const routeSegments = routePath.split('/').filter(Boolean);
    if (routeSegments.length >= 1) {
      // Any 404 under /skills/<owner>/<route...> implies the root repo slug
      // (<owner>/<first-segment>) is currently non-indexable in practice.
      // Add repo-level exclusion to suppress future sub-path variants in sitemap output.
      repoKeys.add(`${normalize(owner)}/${normalize(routeSegments[0])}`);
    }
  }

  const crawlExactCount = exactKeys.size;
  const crawlRepoCount = repoKeys.size;

  let d1Checked = 0;
  let d1Missing = 0;
  if (includeD1Gaps) {
    if (!existsSync(sitemapPath)) {
      throw new Error(`Missing sitemap source: ${sitemapPath}`);
    }

    const d1Config = resolveD1Config();
    if (!d1Config) {
      throw new Error(
        'include-d1-gaps requires CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (or CLOUDFLARE_D1_TOKEN) and a D1 database id',
      );
    }

    const sitemapRaw = JSON.parse(readFileSync(sitemapPath, 'utf8')) as unknown;
    const sitemapEntries = normalizeSitemapEntries(sitemapRaw);
    d1Checked = sitemapEntries.length;

    const missingEntries = await collectMissingSitemapEntriesInD1(sitemapEntries, d1Config);
    d1Missing = missingEntries.length;
    for (const entry of missingEntries) {
      const ownerKey = normalize(entry.owner);
      const routeKey = normalize(entry.routePath);
      exactKeys.add(`${ownerKey}/${routeKey}`);

      const repoSegment = routeKey.split('/').filter(Boolean)[0];
      if (repoSegment) {
        repoKeys.add(`${ownerKey}/${repoSegment}`);
      }
    }
  }

  if (mode === 'merge') {
    const existing = loadExistingRules(outputPath);
    for (const key of existing.exactKeys) exactKeys.add(key);
    for (const key of existing.repoKeys) repoKeys.add(key);
  }

  // --prune-stale: remove entries that the latest crawl verified as non-404.
  // Only prunes entries with positive evidence (2xx/3xx in crawl results).
  // Entries not checked in this crawl are conservatively kept.
  let pruned = 0;
  if (pruneStale && hasJsonReport) {
    const verifiedOk = extractVerifiedNon404SkillKeys(readFileSync(jsonReportPath, 'utf8'));
    for (const key of verifiedOk) {
      if (exactKeys.delete(key)) pruned++;
    }
    // Prune repo-level keys only if ALL exact entries under that repo are gone
    for (const repoKey of Array.from(repoKeys)) {
      const hasRemainingExact = Array.from(exactKeys).some((k) => k.startsWith(`${repoKey}/`) || k === repoKey);
      if (!hasRemainingExact) {
        repoKeys.delete(repoKey);
        pruned++;
      }
    }
    if (pruned > 0) console.log(`[prune-stale] removed ${pruned} entries verified as non-404`);
  }

  const sourceReport = sourceReportPath
    ? sourceReportPath.startsWith(process.cwd())
      ? relative(process.cwd(), sourceReportPath) || sourceReportPath
      : sourceReportPath
    : null;

  const output: OutputPayload = {
    generatedAt: new Date().toISOString(),
    sourceReport,
    mode,
    stats: {
      excludeExact: exactKeys.size,
      excludeRepo: repoKeys.size,
      ignored,
      ...(includeD1Gaps ? { d1Checked, d1Missing } : {}),
    },
    rules: {
      excludeExact: Array.from(exactKeys).sort((a, b) => a.localeCompare(b)),
      excludeRepo: Array.from(repoKeys).sort((a, b) => a.localeCompare(b)),
    },
  };

  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Wrote sitemap blocklist: ${outputPath}`);
  console.log(
    `mode=${mode}, crawlExact=${crawlExactCount}, crawlRepo=${crawlRepoCount}, mergedExact=${output.stats.excludeExact}, mergedRepo=${output.stats.excludeRepo}`,
  );
  if (includeD1Gaps) {
    console.log(`d1Checked=${d1Checked}, d1Missing=${d1Missing}`);
  }
  console.log(`excludeExact=${output.stats.excludeExact}, excludeRepo=${output.stats.excludeRepo}, ignored=${ignored}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
