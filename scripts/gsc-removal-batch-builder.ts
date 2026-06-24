#!/usr/bin/env npx tsx
/**
 * GSC Removal Batch Builder
 *
 * Reads existing 404 remediation rules, coverage drilldown anomalies, and
 * sitemap blocklist data to produce a ranked list of URLs that should be
 * submitted for removal via the Google Search Console URL Removal tool.
 *
 * Priority order:
 *   1. source_file_path cluster (highest volume of crawl traps)
 *   2. known_skill_404 cluster (deleted/renamed repos)
 *   3. trailing_slash cluster
 *   4. query_parameter / repeated_segment / deep_skill_path / other
 *
 * Output:
 *   - reports/seo/latest-gsc-removal-batch.md (human-readable)
 *   - reports/seo/latest-gsc-removal-batch.csv (for GSC UI bulk submission)
 *   - reports/seo/latest-gsc-removal-batch.json (machine-readable)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const SITE_URL = 'https://killer-skills.com';
const OUTPUT_DIR = resolve(process.cwd(), 'reports/seo');

type RemovalEntry = { url: string; cluster: string; priority: number };

type RemovalBatch = {
  generatedAt: string;
  totalUrls: number;
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

function getClusterPriority(cluster: string): number {
  const priorities: Record<string, number> = {
    source_file_path: 1,
    known_skill_404: 2,
    trailing_slash: 3,
    query_parameter: 4,
    repeated_segment: 5,
    deep_skill_path: 6,
    other: 7,
  };
  return priorities[cluster] ?? 8;
}

function normalizeUrl(rawUrl: string): string {
  const url = rawUrl.trim().replace(/\/+$/, '');
  if (url.startsWith('http')) return url;
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function main(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const coverageDrilldown = loadJson<any>('reports/seo/latest-coverage-drilldown.json');
  const rules404 = loadJson<any>('data/seo-404-rules.json');

  const urls: RemovalEntry[] = [];

  // From coverage drilldown — clusterPriorities contains topSamples per cluster
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
      }
    }
  }

  // From 404 rules — URLs already handled by middleware (410 Gone / 301)
  if (rules404?.rules) {
    const goneRules: Array<{ path?: string; fromPath?: string }> = rules404.rules.gone410 || [];
    const redirectRules: Array<{ fromPath?: string; path?: string }> = rules404.rules.redirect301 || [];

    for (const rule of goneRules) {
      const path = rule.path || rule.fromPath;
      if (path) {
        urls.push({
          url: normalizeUrl(String(path)),
          cluster: 'middleware_410_gone',
          priority: getClusterPriority('known_skill_404'),
        });
      }
    }

    for (const rule of redirectRules) {
      const path = rule.fromPath || rule.path;
      if (path) {
        urls.push({
          url: normalizeUrl(String(path)),
          cluster: 'middleware_301_redirect',
          priority: getClusterPriority('trailing_slash'),
        });
      }
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
    `2. Start with source_file_path cluster (highest priority)`,
    `3. Then submit known_skill_404 cluster`,
    `4. Monitor coverage anomaly count weekly via recovery scorecard`,
    `5. Target: anomalies < 2,000 within 4 weeks`,
    ``,
    `## Removal Status Tracking`,
    ``,
    `| Cluster | Submitted | Confirmed Removed | Remaining |`,
    `|---------|----------|-------------------|-----------|`,
    `| source_file_path | - | - | - |`,
    `| known_skill_404 | - | - | - |`,
    `| trailing_slash | - | - | - |`,
    `| other | - | - | - |`,
  ].join('\n');

  writeFileSync(resolve(OUTPUT_DIR, 'latest-gsc-removal-batch.md'), md);

  console.log(
    `GSC removal batch: ${batch.totalUrls} URLs across ${Object.keys(byCluster).length} clusters`,
  );
  console.log(`Output: ${OUTPUT_DIR}/latest-gsc-removal-batch.{json,csv,md}`);
}

main();
