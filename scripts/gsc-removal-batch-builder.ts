#!/usr/bin/env npx tsx
/**
 * GSC Removal Batch Builder
 *
 * Aggregates every removal-safe URL source into a single ranked batch for the
 * Google Search Console URL Removal tool:
 *
 *   1. Full Coverage Drilldown CSV — processed by generate-gsc-removal-list.ts
 *      with semantic reclassification (excludes canonical_keep URLs). This is
 *      the primary source and contributes ~1,000 URLs from the GSC 404 export.
 *   2. Categorized removal lists — per-category .txt files emitted by the same
 *      pipeline, used to assign accurate cluster labels.
 *   3. Coverage drilldown JSON cluster samples — topSamples per cluster, kept
 *      as a fallback when the full pipeline output is stale or missing.
 *   4. 404 remediation rules — middleware 410 Gone / 301 redirect rules from
 *      data/seo-404-rules.json (URLs already handled at runtime but may still
 *      be indexed).
 *
 * Priority order:
 *   1. source_file / source_file_path (highest volume of crawl traps)
 *   2. skill_blocklisted / known_skill_404 (deleted/renamed repos)
 *   3. trailing_slash
 *   4. query_parameter / repeated_segment / deep_skill_path / other
 *
 * Output:
 *   - reports/seo/latest-gsc-removal-batch.md (human-readable)
 *   - reports/seo/latest-gsc-removal-batch.csv (for GSC UI bulk submission)
 *   - reports/seo/latest-gsc-removal-batch.json (machine-readable)
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const SITE_URL = 'https://killer-skills.com';
const OUTPUT_DIR = resolve(process.cwd(), 'reports/seo');

type RemovalEntry = { url: string; cluster: string; priority: number };

type RemovalBatch = {
  generatedAt: string;
  totalUrls: number;
  sources: { source: string; count: number }[];
  byCluster: Record<string, { count: number; sample: string[] }>;
  urls: RemovalEntry[];
};

function loadJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf-8')) as T;
  } catch {
    return null;
  }
}

function loadTextLines(path: string): string[] {
  try {
    return readFileSync(resolve(process.cwd(), path), 'utf-8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Find the freshest dated file matching a prefix in the reports/seo directory.
 * Returns the absolute path or null when no match exists.
 */
function findLatestDatedFile(prefix: string): string | null {
  if (!existsSync(OUTPUT_DIR)) return null;
  const pattern = new RegExp(`^${prefix}-(\\d{4}-\\d{2}-\\d{2})\\.(txt|md|json)$`);
  let best: { path: string; date: string } | null = null;
  for (const fileName of readdirSync(OUTPUT_DIR)) {
    const match = fileName.match(pattern);
    if (!match) continue;
    const date = match[1];
    if (!best || date > best.date) {
      best = { path: resolve(OUTPUT_DIR, fileName), date };
    }
  }
  return best?.path ?? null;
}

/**
 * Map a semantic category from generate-gsc-removal-list.ts to a batch cluster
 * label and priority. Falls back to the heuristic cluster priority table.
 */
function getClusterPriority(cluster: string): number {
  const priorities: Record<string, number> = {
    source_file: 1,
    source_file_path: 1,
    skill_blocklisted: 2,
    known_skill_404: 2,
    skill_missing_or_unpublished: 2,
    trailing_slash: 3,
    query_param: 4,
    query_parameter: 4,
    repeated_segment: 5,
    deep_path: 6,
    deep_skill_path: 6,
    skill_repo_root_multi_target: 6,
    skill_route_mismatch_multi_target: 6,
    skill_repo_root_single_target: 7,
    skill_route_mismatch_single_target: 7,
    skill_noncanonical_locale: 7,
    docs_legacy_slug: 7,
    collection_legacy_slug: 7,
    middleware_410_gone: 4,
    middleware_301_redirect: 5,
    other: 8,
  };
  return priorities[cluster] ?? 8;
}

function normalizeUrl(rawUrl: string): string {
  const url = rawUrl.trim().replace(/\/+$/, '');
  if (url.startsWith('http')) return url;
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Build a URL → category lookup from the freshest per-category removal .txt
 * files emitted by generate-gsc-removal-list.ts. Each file is named
 * `gsc-removal-{category}-{date}.txt` and contains one URL per line. The
 * lookup lets us label every URL in the full removal list with its semantic
 * cluster instead of a generic label.
 *
 * Only the freshest dated set is used so stale categories don't bleed in.
 */
function buildCategoryLookup(): Map<string, string> {
  const lookup = new Map<string, string>();

  // Determine the freshest date across all category files so we read a
  // consistent set.
  if (!existsSync(OUTPUT_DIR)) return lookup;

  const categoryFiles = readdirSync(OUTPUT_DIR).filter((fileName) => {
    // Match gsc-removal-{category}-{date}.txt but exclude "full", "priority",
    // and "prefix-strategy" which are not per-category lists.
    return /^gsc-removal-(?!full|priority|prefix-strategy|summary|canonicalize|investigate|readiness)[a-z_]+-\d{4}-\d{2}-\d{2}\.txt$/.test(
      fileName,
    );
  });

  // Find the most recent date present across category files.
  let freshestDate = '';
  for (const fileName of categoryFiles) {
    const match = fileName.match(/-(\d{4}-\d{2}-\d{2})\.txt$/);
    if (match && match[1] > freshestDate) {
      freshestDate = match[1];
    }
  }
  if (!freshestDate) return lookup;

  for (const fileName of categoryFiles) {
    if (!fileName.endsWith(`-${freshestDate}.txt`)) continue;
    const categoryMatch = fileName.match(/^gsc-removal-([a-z_]+)-/);
    if (!categoryMatch) continue;
    const category = categoryMatch[1];
    const lines = loadTextLines(resolve(OUTPUT_DIR, fileName));
    for (const line of lines) {
      lookup.set(normalizeUrl(line), category);
    }
  }

  return lookup;
}

function main(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const coverageDrilldown = loadJson<any>('reports/seo/latest-coverage-drilldown.json');
  const rules404 = loadJson<any>('data/seo-404-rules.json');

  const urls: RemovalEntry[] = [];
  const sources: { source: string; count: number }[] = [];

  // --- Source 1: Full Coverage Drilldown CSV via generate-gsc-removal-list.ts ---
  //
  // The full pipeline (generate-gsc-removal-list.ts) reads the raw Coverage
  // Drilldown CSV, applies semantic reclassification, and excludes canonical_keep
  // URLs. Its gsc-removal-full-*.txt output is the authoritative removal-safe
  // list — far richer than the 6-per-cluster topSamples in the JSON summary.
  const fullRemovalListPath = findLatestDatedFile('gsc-removal-full');
  let fullRemovalCount = 0;
  if (fullRemovalListPath) {
    const fullUrls = loadTextLines(fullRemovalListPath);
    // Build a category lookup from the per-category .txt files so we can label
    // each URL with its semantic cluster rather than a generic "coverage_csv".
    const categoryLookup = buildCategoryLookup();
    for (const rawUrl of fullUrls) {
      const normalized = normalizeUrl(rawUrl);
      const cluster = categoryLookup.get(normalized) || 'coverage_csv';
      urls.push({
        url: normalized,
        cluster,
        priority: getClusterPriority(cluster),
      });
      fullRemovalCount++;
    }
    sources.push({ source: `gsc-removal-full (${basename(fullRemovalListPath)})`, count: fullRemovalCount });
  }

  // --- Source 2: Coverage drilldown JSON cluster samples (fallback) ---
  let jsonSampleCount = 0;
  if (coverageDrilldown?.clusterPriorities && Array.isArray(coverageDrilldown.clusterPriorities)) {
    for (const cluster of coverageDrilldown.clusterPriorities) {
      const clusterName = String(cluster.cluster || 'other');
      const clusterUrls: string[] = cluster.topSamples || [];
      for (const rawUrl of clusterUrls) {
        urls.push({
          url: normalizeUrl(String(rawUrl)),
          cluster: clusterName,
          priority: getClusterPriority(clusterName),
        });
        jsonSampleCount++;
      }
    }
    if (jsonSampleCount > 0) {
      sources.push({ source: 'latest-coverage-drilldown.json (cluster topSamples)', count: jsonSampleCount });
    }
  }

  // --- Source 3: 404 remediation rules (middleware 410 Gone / 301 redirect) ---
  let rulesCount = 0;
  if (rules404?.rules) {
    const goneRules: Array<{ path?: string; fromPath?: string }> = rules404.rules.gone410 || [];
    const redirectRules: Array<{ fromPath?: string; path?: string }> = rules404.rules.redirect301 || [];

    for (const rule of goneRules) {
      const path = rule.path || rule.fromPath;
      if (path) {
        urls.push({
          url: normalizeUrl(String(path)),
          cluster: 'middleware_410_gone',
          priority: getClusterPriority('middleware_410_gone'),
        });
        rulesCount++;
      }
    }

    for (const rule of redirectRules) {
      const path = rule.fromPath || rule.path;
      if (path) {
        urls.push({
          url: normalizeUrl(String(path)),
          cluster: 'middleware_301_redirect',
          priority: getClusterPriority('middleware_301_redirect'),
        });
        rulesCount++;
      }
    }
    if (rulesCount > 0) {
      sources.push({ source: 'data/seo-404-rules.json (410 + 301)', count: rulesCount });
    }
  }

  // Deduplicate by URL (keep highest priority = lowest number)
  const seen = new Map<string, RemovalEntry>();
  for (const entry of urls) {
    const existing = seen.get(entry.url);
    if (!existing || entry.priority < existing.priority) {
      seen.set(entry.url, entry);
    }
  }

  const deduped = Array.from(seen.values()).sort(
    (a, b) => a.priority - b.priority || a.cluster.localeCompare(b.cluster),
  );

  // Build cluster summary
  const byCluster: Record<string, { count: number; sample: string[] }> = {};
  for (const entry of deduped) {
    if (!byCluster[entry.cluster]) {
      byCluster[entry.cluster] = { count: 0, sample: [] };
    }
    byCluster[entry.cluster].count++;
    if (byCluster[entry.cluster].sample.length < 5) {
      byCluster[entry.cluster].sample.push(entry.url);
    }
  }

  const batch: RemovalBatch = {
    generatedAt: new Date().toISOString(),
    totalUrls: deduped.length,
    sources,
    byCluster,
    urls: deduped,
  };

  // Write JSON
  writeFileSync(
    resolve(OUTPUT_DIR, 'latest-gsc-removal-batch.json'),
    JSON.stringify(batch, null, 2),
  );

  // Write CSV (URL only, one per line — for manual GSC UI bulk submission)
  const csvLines = deduped.map((entry) => entry.url);
  writeFileSync(resolve(OUTPUT_DIR, 'latest-gsc-removal-batch.csv'), csvLines.join('\n'));

  // Write Markdown report
  const md = [
    `# GSC Removal Batch`,
    ``,
    `**Generated:** ${batch.generatedAt}`,
    `**Total URLs:** ${batch.totalUrls}`,
    ``,
    `## Sources`,
    ``,
    ...sources.map((s) => `- ${s.source}: ${s.count} URLs`),
    ``,
    `## Cluster Summary`,
    ``,
    `| Cluster | Count | Sample URLs |`,
    `|---------|-------|-------------|`,
    ...Object.entries(byCluster)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(
        ([cluster, data]) =>
          `| ${cluster} | ${data.count} | ${data.sample.slice(0, 2).join(', ')} |`,
      ),
    ``,
    `## Next Steps`,
    ``,
    `1. Submit URLs via GSC URL Removal tool (max ~1000/day)`,
    `2. Start with source_file / source_file_path cluster (highest priority)`,
    `3. Then submit skill_blocklisted / known_skill_404 cluster`,
    `4. Then trailing_slash + query_parameter + deep_path`,
    `5. Monitor coverage anomaly count weekly via recovery scorecard`,
    `6. Target: anomalies < 2,000 within 4 weeks`,
    ``,
    `## Removal Status Tracking`,
    ``,
    `| Cluster | Submitted | Confirmed Removed | Remaining |`,
    `|---------|----------|-------------------|-----------|`,
    ...Object.entries(byCluster)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([cluster, data]) => `| ${cluster} | - | - | ${data.count} |`),
  ].join('\n');

  writeFileSync(resolve(OUTPUT_DIR, 'latest-gsc-removal-batch.md'), md);

  console.log(
    `GSC removal batch: ${batch.totalUrls} URLs across ${Object.keys(byCluster).length} clusters`,
  );
  console.log(`Output: ${OUTPUT_DIR}/latest-gsc-removal-batch.{json,csv,md}`);
}

main();
