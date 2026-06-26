#!/usr/bin/env npx tsx
/**
 * SEO URL Inspection Coverage Sweep
 *
 * Samples URLs from the latest GSC removal batch and inspects each via the
 * Google Search Console URL Inspection API. Produces a coverage evidence
 * report that the authority-uplift scorecard can use as an alternative to
 * the stale Coverage Drilldown CSV export (which requires manual GSC UI
 * export). When this sweep report is ≤7 days old, the scorecard's
 * `coverageReady` gate passes even if the drilldown export is old.
 *
 * Usage:
 *   npx tsx scripts/seo-url-inspection-coverage-sweep.ts [--max-per-cluster 50] [--dry-run]
 *
 * Environment:
 *   GSC_CLIENT_EMAIL   — service account email
 *   GSC_PRIVATE_KEY    — service account private key
 *   GSC_SITE_URL       — site URL (e.g. https://killer-skills.com)
 *
 * Output:
 *   - reports/seo/latest-url-inspection-coverage-sweep.json
 *   - reports/seo/latest-url-inspection-coverage-sweep.md
 */
import * as dotenv from 'dotenv';
import { createSign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

dotenv.config();
const localEnv = resolve(process.cwd(), '.env.local');
if (existsSync(localEnv)) {
  dotenv.config({ path: localEnv, override: true });
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const maxPerClusterArg = process.argv.find((a) => a.startsWith('--max-per-cluster='));
const MAX_PER_CLUSTER = maxPerClusterArg ? parseInt(maxPerClusterArg.split('=')[1], 10) : 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type IndexStatusResult = {
  verdict?: string;
  coverageState?: string;
  robotsTxtState?: string;
  indexingState?: string;
  lastCrawlTime?: string;
  pageFetchState?: string;
  googleCanonical?: string;
  userCanonical?: string;
  referringUrls?: string[];
  sitemap?: string[];
};

type UrlInspectionResult = {
  inspectionResult?: {
    indexStatusResult?: IndexStatusResult;
  };
};

type InspectionRecord = {
  url: string;
  cluster: string;
  verdict: string;
  coverageState: string;
  indexingState: string;
  lastCrawlTime: string | null;
  pageFetchState: string;
  googleCanonical: string | null;
  robotsTxtState: string;
  inspectedAt: string;
  error?: string;
};

type ClusterSummary = {
  cluster: string;
  sampleSize: number;
  passCount: number;
  neutralCount: number;
  failCount: number;
  errorCount: number;
};

type CoverageSweepReport = {
  generatedAt: string;
  sourceRemovalBatch: string;
  totalBatchUrls: number;
  totalSampled: number;
  clustersInspected: number;
  overallPassRate: number;
  clusters: ClusterSummary[];
  verdictBreakdown: Record<string, number>;
  coverageStateBreakdown: Record<string, number>;
  records: InspectionRecord[];
};

// ---------------------------------------------------------------------------
// Auth helpers (same pattern as gsc-url-inspection-verify.ts)
// ---------------------------------------------------------------------------
function getConfig() {
  const clientEmail = (process.env.GSC_CLIENT_EMAIL || '').trim();
  const privateKey = (process.env.GSC_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  const siteUrl = (process.env.GSC_SITE_URL || '').trim();

  if (!clientEmail || !privateKey || !siteUrl) {
    console.error(
      'Missing GSC credentials. Set GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, and GSC_SITE_URL in .env.local',
    );
    process.exit(1);
  }

  return { clientEmail, privateKey, siteUrl };
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function fetchAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  );

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = base64UrlEncode(signer.sign(privateKey));
  const assertion = `${header}.${payload}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to fetch Google OAuth token (${response.status}): ${text}`);
  }

  let data: { access_token?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Google OAuth token response was not valid JSON: ${text.slice(0, 200)}`);
  }

  if (!data.access_token) {
    throw new Error(
      `Google OAuth token response did not include access_token. Response keys: ${Object.keys(data).join(', ')}`,
    );
  }

  return data.access_token;
}

async function inspectUrl(
  url: string,
  siteUrl: string,
  accessToken: string,
): Promise<UrlInspectionResult> {
  const endpoint = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inspectionUrl: url,
      siteUrl,
      languageCode: 'en-US',
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`URL Inspection API failed for ${url} (${response.status}): ${details}`);
  }

  return (await response.json()) as UrlInspectionResult;
}

// ---------------------------------------------------------------------------
// Removal batch parsing
// ---------------------------------------------------------------------------
function loadRemovalBatch(): {
  urls: Array<{ url: string; cluster: string }>;
  source: string;
} {
  const batchJsonPath = resolve(process.cwd(), 'reports/seo/latest-gsc-removal-batch.json');
  if (!existsSync(batchJsonPath)) {
    console.error('No removal batch found. Run gsc-removal-batch-builder.ts first.');
    process.exit(1);
  }

  const batch = JSON.parse(readFileSync(batchJsonPath, 'utf-8')) as {
    generatedAt: string;
    totalUrls: number;
    urls: Array<{ url: string; cluster: string }>;
  };

  return { urls: batch.urls, source: batchJsonPath };
}

/**
 * Sample up to MAX_PER_CLUSTER URLs per cluster, preserving priority order
 * (the batch is already sorted by priority).
 */
function sampleByCluster(
  urls: Array<{ url: string; cluster: string }>,
): Array<{ url: string; cluster: string }> {
  const byCluster = new Map<string, Array<{ url: string; cluster: string }>>();
  for (const entry of urls) {
    const list = byCluster.get(entry.cluster) || [];
    list.push(entry);
    byCluster.set(entry.cluster, list);
  }

  const sampled: Array<{ url: string; cluster: string }> = [];
  for (const [cluster, entries] of byCluster) {
    const count = Math.min(MAX_PER_CLUSTER, entries.length);
    sampled.push(...entries.slice(0, count));
  }

  return sampled;
}

// ---------------------------------------------------------------------------
// Delay between API calls (stay under GSC quota)
// ---------------------------------------------------------------------------
const SLEEP_MS = 500;
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const config = getConfig();
  const reportDir = resolve(process.cwd(), 'reports/seo');
  mkdirSync(reportDir, { recursive: true });

  // Load and sample
  const { urls: batchUrls, source: batchSource } = loadRemovalBatch();
  const sampled = sampleByCluster(batchUrls);

  console.log(`Total batch URLs: ${batchUrls.length}`);
  console.log(`Sampled for inspection: ${sampled.length} (max ${MAX_PER_CLUSTER}/cluster)`);
  console.log(`Clusters: ${new Set(sampled.map((s) => s.cluster)).size}`);

  if (dryRun) {
    console.log('\n[DRY RUN] Would inspect these URLs:');
    const byCluster = new Map<string, number>();
    for (const s of sampled) {
      byCluster.set(s.cluster, (byCluster.get(s.cluster) || 0) + 1);
    }
    for (const [cluster, count] of byCluster) {
      console.log(`  ${cluster}: ${count} URLs`);
    }
    console.log('\nRemove --dry-run to execute the sweep.');
    return;
  }

  // Authenticate
  console.log('Fetching GSC access token...');
  const accessToken = await fetchAccessToken(config.clientEmail, config.privateKey);
  console.log('Access token obtained. Starting inspection sweep...');

  // Inspect
  const records: InspectionRecord[] = [];
  const verdictBreakdown: Record<string, number> = {};
  const coverageStateBreakdown: Record<string, number> = {};
  const clusterSummaries = new Map<string, ClusterSummary>();

  for (let i = 0; i < sampled.length; i++) {
    const { url, cluster } = sampled[i];

    console.log(`[${i + 1}/${sampled.length}] Inspecting: ${url} (${cluster})`);

    // Initialize cluster summary
    if (!clusterSummaries.has(cluster)) {
      clusterSummaries.set(cluster, {
        cluster,
        sampleSize: 0,
        passCount: 0,
        neutralCount: 0,
        failCount: 0,
        errorCount: 0,
      });
    }

    try {
      const result = await inspectUrl(url, config.siteUrl, accessToken);
      const indexStatus = result.inspectionResult?.indexStatusResult;

      const verdict = indexStatus?.verdict || 'UNSPECIFIED';
      const coverageState = indexStatus?.coverageState || 'UNSPECIFIED';
      const indexingState = indexStatus?.indexingState || 'UNSPECIFIED';
      const lastCrawlTime = indexStatus?.lastCrawlTime || null;
      const pageFetchState = indexStatus?.pageFetchState || 'UNSPECIFIED';
      const googleCanonical = indexStatus?.googleCanonical || null;
      const robotsTxtState = indexStatus?.robotsTxtState || 'UNSPECIFIED';

      const record: InspectionRecord = {
        url,
        cluster,
        verdict,
        coverageState,
        indexingState,
        lastCrawlTime,
        pageFetchState,
        googleCanonical,
        robotsTxtState,
        inspectedAt: new Date().toISOString(),
      };

      records.push(record);
      verdictBreakdown[verdict] = (verdictBreakdown[verdict] || 0) + 1;
      coverageStateBreakdown[coverageState] = (coverageStateBreakdown[coverageState] || 0) + 1;

      const summary = clusterSummaries.get(cluster)!;
      summary.sampleSize++;
      if (verdict === 'PASS') summary.passCount++;
      else if (verdict === 'NEUTRAL') summary.neutralCount++;
      else if (verdict === 'FAIL') summary.failCount++;
      else summary.errorCount++;

      console.log(`  → verdict=${verdict} | coverage=${coverageState} | fetchState=${pageFetchState}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`  → ERROR: ${errMsg}`);

      records.push({
        url,
        cluster,
        verdict: 'ERROR',
        coverageState: 'ERROR',
        indexingState: 'ERROR',
        lastCrawlTime: null,
        pageFetchState: 'ERROR',
        googleCanonical: null,
        robotsTxtState: 'ERROR',
        inspectedAt: new Date().toISOString(),
        error: errMsg,
      });

      verdictBreakdown['ERROR'] = (verdictBreakdown['ERROR'] || 0) + 1;

      const summary = clusterSummaries.get(cluster)!;
      summary.sampleSize++;
      summary.errorCount++;
    }

    if (i < sampled.length - 1) {
      await sleep(SLEEP_MS);
    }
  }

  // Build report
  const totalPass = records.filter((r) => r.verdict === 'PASS').length;
  const totalSampled = records.length;
  const overallPassRate = totalSampled > 0 ? totalPass / totalSampled : 0;

  const report: CoverageSweepReport = {
    generatedAt: new Date().toISOString(),
    sourceRemovalBatch: batchSource,
    totalBatchUrls: batchUrls.length,
    totalSampled,
    clustersInspected: clusterSummaries.size,
    overallPassRate,
    clusters: Array.from(clusterSummaries.values()),
    verdictBreakdown,
    coverageStateBreakdown,
    records,
  };

  // Write JSON
  const jsonPath = resolve(reportDir, 'latest-url-inspection-coverage-sweep.json');
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  // Write Markdown
  const mdLines = [
    `# URL Inspection Coverage Sweep`,
    ``,
    `**Generated:** ${report.generatedAt}`,
    `**Source:** ${report.sourceRemovalBatch}`,
    `**Total batch URLs:** ${report.totalBatchUrls}`,
    `**Sampled for inspection:** ${report.totalSampled}`,
    `**Clusters inspected:** ${report.clustersInspected}`,
    `**Overall pass rate:** ${(report.overallPassRate * 100).toFixed(1)}%`,
    ``,
    `## Cluster Summary`,
    ``,
    `| Cluster | Sampled | PASS | NEUTRAL | FAIL | ERROR |`,
    `|---------|---------|------|---------|------|-------|`,
    ...report.clusters
      .sort((a, b) => b.sampleSize - a.sampleSize)
      .map(
        (c) =>
          `| ${c.cluster} | ${c.sampleSize} | ${c.passCount} | ${c.neutralCount} | ${c.failCount} | ${c.errorCount} |`,
      ),
    ``,
    `## Verdict Breakdown`,
    ``,
    ...Object.entries(verdictBreakdown)
      .sort(([, a], [, b]) => b - a)
      .map(([k, v]) => `- ${k}: ${v}`),
    ``,
    `## Coverage State Breakdown`,
    ``,
    ...Object.entries(coverageStateBreakdown)
      .sort(([, a], [, b]) => b - a)
      .map(([k, v]) => `- ${k}: ${v}`),
    ``,
    `## Purpose`,
    ``,
    `This sweep provides same-day coverage evidence as an alternative to the`,
    `manually-exported GSC Coverage Drilldown CSV. When this report is ≤7 days`,
    `old, the authority-uplift scorecard's coverage-freshness gate accepts it as`,
    `sufficient evidence to open the discovery expansion boundary.`,
    ``,
  ];

  const mdPath = resolve(reportDir, 'latest-url-inspection-coverage-sweep.md');
  writeFileSync(mdPath, mdLines.join('\n'), 'utf8');

  console.log(`\nCoverage sweep complete.`);
  console.log(`Sampled: ${totalSampled} | PASS: ${totalPass} | Pass rate: ${(overallPassRate * 100).toFixed(1)}%`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
}

main().catch((error) => {
  console.error('Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
