#!/usr/bin/env npx tsx
/**
 * GSC Removal Verification & Coverage Delta
 *
 * Phase 156 (Index Health Closure):
 *   1. `verify --batch <batch-file>`  — re-runs URL Inspection on submitted batch
 *      URLs and emits a per-URL status report (removed / pending / failed /
 *      not_found_in_index).
 *   2. `delta --before <before-sweep> --after <after-sweep>` — compares two
 *      coverage sweep JSON files, computes anomaly count delta per cluster,
 *      and emits a before/after delta report.
 *
 * Usage:
 *   npx tsx scripts/seo-gsc-removal-verification.ts verify --batch reports/seo/latest-gsc-removal-batch.json
 *   npx tsx scripts/seo-gsc-removal-verification.ts delta \
 *     --before reports/seo/pre-remov01-coverage-sweep.json \
 *     --after  reports/seo/latest-url-inspection-coverage-sweep.json
 *
 * Environment (for `verify`):
 *   GSC_CLIENT_EMAIL   — service account email
 *   GSC_PRIVATE_KEY    — service account private key
 *   GSC_SITE_URL       — site URL (e.g. https://killer-skills.com)
 *
 * Outputs:
 *   - reports/seo/latest-gsc-removal-verification.json   (per-URL status)
 *   - reports/seo/latest-gsc-removal-verification.md      (cluster summary)
 *   - reports/seo/latest-coverage-delta-report.json       (delta data)
 *   - reports/seo/latest-coverage-delta-report.md         (delta summary)
 */
import * as dotenv from 'dotenv';
import { createSign } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

dotenv.config();
const localEnv = resolve(process.cwd(), '.env.local');
if (existsSync(localEnv)) {
  dotenv.config({ path: localEnv, override: true });
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const REPORT_DIR = resolve(process.cwd(), 'reports/seo');
const VERIFICATION_JSON = resolve(REPORT_DIR, 'latest-gsc-removal-verification.json');
const VERIFICATION_MD = resolve(REPORT_DIR, 'latest-gsc-removal-verification.md');
const DELTA_JSON = resolve(REPORT_DIR, 'latest-coverage-delta-report.json');
const DELTA_MD = resolve(REPORT_DIR, 'latest-coverage-delta-report.md');

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
const command = process.argv[2] as 'verify' | 'delta' | undefined;

function readArg(flag: string): string | undefined {
  const argv = process.argv;
  const eqForm = argv.find((a) => a.startsWith(`${flag}=`));
  if (eqForm) return eqForm.slice(flag.length + 1);
  const idx = argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < argv.length) {
    const next = argv[idx + 1];
    if (!next.startsWith('--')) return next;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Types (exported for testability)
// ---------------------------------------------------------------------------
export type VerificationStatus = 'removed' | 'pending' | 'failed' | 'not_found_in_index';

export type VerificationRecord = {
  url: string;
  cluster: string;
  status: VerificationStatus;
  verdict: string;
  coverageState: string;
  inspectedAt: string;
  error?: string;
};

export type ClusterVerificationSummary = {
  cluster: string;
  total: number;
  removed: number;
  pending: number;
  failed: number;
  notFoundInIndex: number;
};

export type VerificationReport = {
  generatedAt: string;
  sourceBatch: string;
  totalUrls: number;
  inspected: number;
  clusters: ClusterVerificationSummary[];
  records: VerificationRecord[];
};

export type SweepRecord = {
  url: string;
  cluster: string;
  verdict: string;
  coverageState: string;
  inspectedAt: string;
};

export type SweepClusterSummary = {
  cluster: string;
  sampleSize: number;
  passCount: number;
  neutralCount: number;
  failCount: number;
  errorCount: number;
};

export type CoverageSweepReport = {
  generatedAt: string;
  totalSampled: number;
  clusters: SweepClusterSummary[];
  records: SweepRecord[];
};

export type ClusterDelta = {
  cluster: string;
  beforeVerdictCounts: Record<string, number>;
  afterVerdictCounts: Record<string, number>;
  beforeTotal: number;
  afterTotal: number;
  netChange: number;
  passDelta: number;
  neutralDelta: number;
  failDelta: number;
  errorDelta: number;
};

export type DeltaReport = {
  generatedAt: string;
  beforeSource: string;
  afterSource: string;
  totalClustersBefore: number;
  totalClustersAfter: number;
  clusters: ClusterDelta[];
  overallNetChange: number;
};

// ---------------------------------------------------------------------------
// Auth helpers (same pattern as seo-url-inspection-coverage-sweep.ts)
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
): Promise<{
  verdict: string;
  coverageState: string;
  indexingState: string;
  lastCrawlTime: string | null;
  pageFetchState: string;
}> {
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

  const result = (await response.json()) as {
    inspectionResult?: {
      indexStatusResult?: {
        verdict?: string;
        coverageState?: string;
        indexingState?: string;
        lastCrawlTime?: string;
        pageFetchState?: string;
      };
    };
  };

  const indexStatus = result.inspectionResult?.indexStatusResult;
  return {
    verdict: indexStatus?.verdict || 'UNSPECIFIED',
    coverageState: indexStatus?.coverageState || 'UNSPECIFIED',
    indexingState: indexStatus?.indexingState || 'UNSPECIFIED',
    lastCrawlTime: indexStatus?.lastCrawlTime || null,
    pageFetchState: indexStatus?.pageFetchState || 'UNSPECIFIED',
  };
}

// ---------------------------------------------------------------------------
// Verification logic
// ---------------------------------------------------------------------------

/**
 * Map URL Inspection verdict + coverageState to a removal verification status.
 *
 * - "removed": NEUTRAL or FAIL verdict means GSC is no longer actively
 *   indexing the URL (removal succeeded).
 * - "not_found_in_index": The URL was never indexed (not in GSC at all).
 * - "pending": NEUTRAL with "Submitted URL not selected as canonical" or
 *   similar — Google has the removal request but hasn't fully processed.
 * - "failed": PASS verdict after removal request means the URL is still
 *   indexed (removal failed or hasn't taken effect yet).
 */
export function classifyRemovalStatus(
  verdict: string,
  coverageState: string,
): VerificationStatus {
  if (verdict === 'PASS') return 'failed';
  if (verdict === 'NEUTRAL') {
    // NEUTRAL with "URL is not indexed" style coverage states = success
    if (
      coverageState.includes('not found') ||
      coverageState.includes('not indexed') ||
      coverageState.includes('Not found') ||
      coverageState.includes('URL is not known') ||
      coverageState.includes('Submitted URL not selected as canonical')
    ) {
      return 'removed';
    }
    // NEUTRAL with crawl/pending states = still processing
    if (
      coverageState.includes('Submitted URL') ||
      coverageState.includes('Crawled') ||
      coverageState.includes('Discovered')
    ) {
      return 'pending';
    }
    // Default NEUTRAL → removed (URL is not actively indexed)
    return 'removed';
  }
  if (verdict === 'FAIL') {
    // FAIL can also mean "not found in index" — check coverageState
    if (coverageState.includes('Not found') || coverageState.includes('not found')) {
      return 'not_found_in_index';
    }
    return 'removed';
  }
  // ERROR or UNSPECIFIED → pending (can't confirm, need re-check)
  return 'pending';
}

const SLEEP_MS = 500;
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runVerify(): Promise<void> {
  const batchArg = readArg('--batch') || resolve(REPORT_DIR, 'latest-gsc-removal-batch.json');
  const maxPerClusterArg = readArg('--max-per-cluster');
  const MAX_PER_CLUSTER = maxPerClusterArg ? parseInt(maxPerClusterArg, 10) : 50;
  const dryRun = process.argv.includes('--dry-run');

  if (!existsSync(batchArg)) {
    console.error(`No removal batch found at ${batchArg}.`);
    console.error('Run the gsc-removal-batch-builder first.');
    process.exit(1);
  }

  const batch = JSON.parse(readFileSync(batchArg, 'utf-8')) as {
    generatedAt: string;
    totalUrls: number;
    byCluster: Record<string, { count: number; sample: string[] }>;
    urls: Array<{ url: string; cluster: string; priority: number }>;
  };

  // Sample up to MAX_PER_CLUSTER URLs per cluster (same as coverage sweep)
  const byCluster = new Map<string, Array<{ url: string; cluster: string }>>();
  for (const entry of batch.urls) {
    const list = byCluster.get(entry.cluster) || [];
    list.push(entry);
    byCluster.set(entry.cluster, list);
  }

  const sampled: Array<{ url: string; cluster: string }> = [];
  for (const [cluster, entries] of byCluster) {
    const count = Math.min(MAX_PER_CLUSTER, entries.length);
    sampled.push(...entries.slice(0, count));
  }

  console.log(`Batch: ${batch.totalUrls} URLs (generated ${batch.generatedAt})`);
  console.log(`Sampled for verification: ${sampled.length} (max ${MAX_PER_CLUSTER}/cluster)`);
  console.log(`Clusters: ${byCluster.size}`);

  if (dryRun) {
    console.log('\n[DRY RUN] Would verify these URLs:');
    const clusterCounts = new Map<string, number>();
    for (const s of sampled) {
      clusterCounts.set(s.cluster, (clusterCounts.get(s.cluster) || 0) + 1);
    }
    for (const [cluster, count] of clusterCounts) {
      console.log(`  ${cluster}: ${count} URLs`);
    }
    console.log('\nRemove --dry-run to execute verification.');
    return;
  }

  // Authenticate
  const config = getConfig();
  console.log('Fetching GSC access token...');
  const accessToken = await fetchAccessToken(config.clientEmail, config.privateKey);
  console.log('Access token obtained. Starting verification sweep...');

  // Inspect each URL
  const records: VerificationRecord[] = [];
  const clusterSummaries = new Map<string, ClusterVerificationSummary>();

  for (const [cluster] of byCluster) {
    clusterSummaries.set(cluster, {
      cluster,
      total: 0,
      removed: 0,
      pending: 0,
      failed: 0,
      notFoundInIndex: 0,
    });
  }

  for (let i = 0; i < sampled.length; i++) {
    const { url, cluster } = sampled[i];
    console.log(`[${i + 1}/${sampled.length}] Verifying: ${url} (${cluster})`);

    try {
      const result = await inspectUrl(url, config.siteUrl, accessToken);
      const status = classifyRemovalStatus(result.verdict, result.coverageState);

      const record: VerificationRecord = {
        url,
        cluster,
        status,
        verdict: result.verdict,
        coverageState: result.coverageState,
        inspectedAt: new Date().toISOString(),
      };
      records.push(record);

      const summary = clusterSummaries.get(cluster)!;
      summary.total++;
      switch (status) {
        case 'removed':
          summary.removed++;
          break;
        case 'pending':
          summary.pending++;
          break;
        case 'failed':
          summary.failed++;
          break;
        case 'not_found_in_index':
          summary.notFoundInIndex++;
          break;
      }

      console.log(`  → status=${status} | verdict=${result.verdict} | coverage=${result.coverageState}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`  → ERROR: ${errMsg}`);

      records.push({
        url,
        cluster,
        status: 'pending',
        verdict: 'ERROR',
        coverageState: 'ERROR',
        inspectedAt: new Date().toISOString(),
        error: errMsg,
      });

      const summary = clusterSummaries.get(cluster)!;
      summary.total++;
      summary.pending++;
    }

    if (i < sampled.length - 1) {
      await sleep(SLEEP_MS);
    }
  }

  // Build verification report
  const report: VerificationReport = {
    generatedAt: new Date().toISOString(),
    sourceBatch: batchArg,
    totalUrls: batch.totalUrls,
    inspected: records.length,
    clusters: Array.from(clusterSummaries.values()).sort((a, b) => b.total - a.total),
    records,
  };

  // Write JSON
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(VERIFICATION_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');

  // Write Markdown
  const totalRemoved = records.filter((r) => r.status === 'removed' || r.status === 'not_found_in_index').length;
  const totalPending = records.filter((r) => r.status === 'pending').length;
  const totalFailed = records.filter((r) => r.status === 'failed').length;
  const removalRate = records.length > 0 ? (totalRemoved / records.length) * 100 : 0;

  const mdLines = [
    `# GSC Removal Verification Report`,
    ``,
    `**Generated:** ${report.generatedAt}`,
    `**Source batch:** ${report.sourceBatch}`,
    `**Total batch URLs:** ${report.totalUrls}`,
    `**Sampled for verification:** ${report.inspected}`,
    `**Removal rate:** ${removalRate.toFixed(1)}% (${totalRemoved}/${report.inspected})`,
    `**Still pending:** ${totalPending}`,
    `**Still indexed (failed):** ${totalFailed}`,
    ``,
    `## Cluster Summary`,
    ``,
    `| Cluster | Sampled | Removed | Not Found | Pending | Still Indexed |`,
    `|---------|---------|---------|-----------|---------|----------------|`,
    ...report.clusters.map(
      (c) =>
        `| ${c.cluster} | ${c.total} | ${c.removed} | ${c.notFoundInIndex} | ${c.pending} | ${c.failed} |`,
    ),
    ``,
    `## Status Definitions`,
    ``,
    `- **removed**: URL returns NEUTRAL/FAIL verdict → no longer actively indexed (removal succeeded)`,
    `- **not_found_in_index**: URL was never in the GSC index`,
    `- **pending**: Removal request submitted but verdict is unclear or still processing`,
    `- **failed (still indexed)**: URL still returns PASS verdict → removal has not taken effect`,
    ``,
    `## Next Steps`,
    ``,
    `- If removal rate > 80%: run coverage delta to quantify index health improvement`,
    `- If pending > 20%: re-run verification after 24-48 hours`,
    `- If failed > 10%: investigate individual URLs for crawl traps or conflicting signals`,
    ``,
  ];

  writeFileSync(VERIFICATION_MD, mdLines.join('\n'), 'utf-8');
  console.log(`\nVerification complete.`);
  console.log(`Removal rate: ${removalRate.toFixed(1)}% (${totalRemoved}/${report.inspected})`);
  console.log(`Pending: ${totalPending} | Still indexed: ${totalFailed}`);
  console.log(`JSON: ${VERIFICATION_JSON}`);
  console.log(`Markdown: ${VERIFICATION_MD}`);
}

// ---------------------------------------------------------------------------
// Delta logic
// ---------------------------------------------------------------------------

/**
 * Load a coverage sweep JSON file, normalizing the shape to either the
 * URL Inspection sweep format or the Coverage Drilldown format (cluster
 * stats with estimatedAffected).
 */
function loadSweep(path: string): { clusters: SweepClusterSummary[]; records: SweepRecord[] } | null {
  if (!existsSync(path)) {
    console.error(`Sweep file not found: ${path}`);
    return null;
  }

  const raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;

  // URL Inspection coverage sweep format
  if (Array.isArray(raw.clusters) && Array.isArray(raw.records)) {
    return {
      clusters: raw.clusters as SweepClusterSummary[],
      records: raw.records as SweepRecord[],
    };
  }

  return null;
}

/**
 * Map a batch cluster name to the coverage drilldown cluster name.
 * The removal batch uses slightly different cluster IDs than the
 * coverage drilldown classification.
 */
export function mapBatchClusterToDrilldown(batchCluster: string): string[] {
  const mapping: Record<string, string[]> = {
    source_file: ['source_file_path'],
    skill_blocklisted: ['known_skill_404', 'other'],
    skill_missing_or_unpublished: ['known_skill_404', 'other'],
    trailing_slash: ['trailing_slash'],
    query_param: ['query_parameter'],
    middleware_301_redirect: ['other'],
    deep_path: ['deep_skill_path'],
    other: ['other', 'repeated_segment', 'sandbox_path'],
  };
  return mapping[batchCluster] || [batchCluster];
}

export function computeDelta(
  before: CoverageSweepReport | null,
  after: CoverageSweepReport | null,
): DeltaReport {
  const beforeClusters = new Map<string, SweepClusterSummary>();
  const afterClusters = new Map<string, SweepClusterSummary>();

  if (before) {
    for (const c of before.clusters) {
      beforeClusters.set(c.cluster, c);
    }
  }
  if (after) {
    for (const c of after.clusters) {
      afterClusters.set(c.cluster, c);
    }
  }

  const allClusters = new Set([...beforeClusters.keys(), ...afterClusters.keys()]);

  const clusterDeltas: ClusterDelta[] = [];
  let overallNetChange = 0;

  for (const cluster of allClusters) {
    const beforeC = beforeClusters.get(cluster);
    const afterC = afterClusters.get(cluster);

    const beforeVerdictCounts: Record<string, number> = beforeC
      ? { PASS: beforeC.passCount, NEUTRAL: beforeC.neutralCount, FAIL: beforeC.failCount, ERROR: beforeC.errorCount }
      : {};

    const afterVerdictCounts: Record<string, number> = afterC
      ? { PASS: afterC.passCount, NEUTRAL: afterC.neutralCount, FAIL: afterC.failCount, ERROR: afterC.errorCount }
      : {};

    const beforeTotal = beforeC?.sampleSize || 0;
    const afterTotal = afterC?.sampleSize || 0;

    const passDelta = (afterC?.passCount || 0) - (beforeC?.passCount || 0);
    const neutralDelta = (afterC?.neutralCount || 0) - (beforeC?.neutralCount || 0);
    const failDelta = (afterC?.failCount || 0) - (beforeC?.failCount || 0);
    const errorDelta = (afterC?.errorCount || 0) - (beforeC?.errorCount || 0);

    // Net change: positive means more non-PASS verdicts (fewer indexed = good for removal)
    const netChange = neutralDelta + failDelta + errorDelta - passDelta;
    overallNetChange += netChange;

    clusterDeltas.push({
      cluster,
      beforeVerdictCounts,
      afterVerdictCounts,
      beforeTotal,
      afterTotal,
      netChange,
      passDelta,
      neutralDelta,
      failDelta,
      errorDelta,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    beforeSource: before?.generatedAt || 'missing',
    afterSource: after?.generatedAt || 'missing',
    totalClustersBefore: beforeClusters.size,
    totalClustersAfter: afterClusters.size,
    clusters: clusterDeltas.sort((a, b) => b.netChange - a.netChange),
    overallNetChange,
  };
}

function runDelta(): void {
  const beforeArg = readArg('--before');
  const afterArg = readArg('--after');

  if (!beforeArg || !afterArg) {
    console.error('Usage: delta --before <before-sweep.json> --after <after-sweep.json>');
    process.exit(1);
  }

  const beforePath = resolve(beforeArg);
  const afterPath = resolve(afterArg);

  const before = loadSweep(beforePath);
  const after = loadSweep(afterPath);

  if (!before && !after) {
    console.error('Neither before nor after sweep files could be loaded.');
    process.exit(1);
  }

  const report = computeDelta(
    before as CoverageSweepReport | null,
    after as CoverageSweepReport | null,
  );

  // Write JSON
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(DELTA_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');

  // Write Markdown
  const mdLines = [
    `# Coverage Delta Report`,
    ``,
    `**Generated:** ${report.generatedAt}`,
    `**Before sweep:** ${report.beforeSource}`,
    `**After sweep:** ${report.afterSource}`,
    `**Clusters before:** ${report.totalClustersBefore}`,
    `**Clusters after:** ${report.totalClustersAfter}`,
    `**Overall net change (removal progress):** ${report.overallNetChange > 0 ? '+' : ''}${report.overallNetChange}`,
    ``,
    `> Positive net change means more URLs moved to NEUTRAL/FAIL (no longer indexed).`,
    `> Negative net change means more URLs are back to PASS (still or newly indexed).`,
    ``,
    `## Per-Cluster Delta`,
    ``,
    `| Cluster | Before | After | PASS Δ | NEUTRAL Δ | FAIL Δ | ERROR Δ | Net Change |`,
    `|---------|--------|-------|--------|-----------|--------|---------|------------|`,
    ...report.clusters.map(
      (c) =>
        `| ${c.cluster} | ${c.beforeTotal} | ${c.afterTotal} | ${c.passDelta >= 0 ? '+' : ''}${c.passDelta} | ${c.neutralDelta >= 0 ? '+' : ''}${c.neutralDelta} | ${c.failDelta >= 0 ? '+' : ''}${c.failDelta} | ${c.errorDelta >= 0 ? '+' : ''}${c.errorDelta} | ${c.netChange >= 0 ? '+' : ''}${c.netChange} |`,
    ),
    ``,
    `## Interpretation`,
    ``,
  ];

  const improved = report.clusters.filter((c) => c.netChange > 0);
  const regressed = report.clusters.filter((c) => c.netChange < 0);

  if (improved.length > 0) {
    mdLines.push(`### Improved clusters (fewer PASS verdicts)`);
    mdLines.push('');
    for (const c of improved) {
      mdLines.push(`- **${c.cluster}**: +${c.netChange} URLs no longer PASS-indexed`);
    }
    mdLines.push('');
  }

  if (regressed.length > 0) {
    mdLines.push(`### Regressed clusters (more PASS verdicts)`);
    mdLines.push('');
    for (const c of regressed) {
      mdLines.push(`- **${c.cluster}**: ${c.netChange} URLs moved back to PASS (still indexed)`);
    }
    mdLines.push('');
  }

  if (report.overallNetChange > 0) {
    mdLines.push(`**Overall:** Removal progress is positive (+${report.overallNetChange} net non-PASS shifts). Continue monitoring and proceed with second-pass batch if needed.`);
  } else if (report.overallNetChange < 0) {
    mdLines.push(`**Overall:** Removal progress has regressed (${report.overallNetChange} net PASS shifts). Investigate regressed clusters before submitting second-pass batch.`);
  } else {
    mdLines.push(`**Overall:** No net change detected. Allow more time for GSC processing and re-run delta.`);
  }
  mdLines.push('');

  writeFileSync(DELTA_MD, mdLines.join('\n'), 'utf-8');
  console.log(`Coverage delta report generated.`);
  console.log(`Overall net change: ${report.overallNetChange > 0 ? '+' : ''}${report.overallNetChange}`);
  console.log(`Improved clusters: ${improved.length} | Regressed: ${regressed.length}`);
  console.log(`JSON: ${DELTA_JSON}`);
  console.log(`Markdown: ${DELTA_MD}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main(): void {
  mkdirSync(REPORT_DIR, { recursive: true });

  switch (command) {
    case 'verify':
      runVerify().catch((error) => {
        console.error('Fatal error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      });
      break;
    case 'delta':
      runDelta();
      break;
    default:
      console.error('Usage: npx tsx scripts/seo-gsc-removal-verification.ts <verify|delta>');
      console.error('');
      console.error('Commands:');
      console.error('  verify   Verify removal batch URLs via GSC URL Inspection');
      console.error('  delta     Compare two coverage sweep files for before/after delta');
      process.exit(1);
  }
}

// Only run main when executed directly (not when imported by tests)
const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main();
}
