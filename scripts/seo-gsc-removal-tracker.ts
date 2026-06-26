#!/usr/bin/env npx tsx
/**
 * GSC Removal Submission Tracker
 *
 * Supports Phase 155 (GSC Removal Batch Submission) by:
 *   1. `status`  — render a submission dashboard from the batch + tracker files
 *   2. `prefix`  — extract SAFE prefix-removal candidates (verifies no live
 *                  Tier-1 landing page would be collateral-removed)
 *   3. `mark`    — record that a cluster (or prefix) has been submitted
 *   4. `verify`  — re-run the URL Inspection sweep against the batch to confirm
 *                  removal progress (delegates to the inspection sweep)
 *
 * The actual URL removal is a manual operator task in the GSC web UI — Google
 * provides no URL Removal API. This script automates the planning, tracking,
 * and verification around that manual step.
 *
 * Usage:
 *   npx tsx scripts/seo-gsc-removal-tracker.ts status
 *   npx tsx scripts/seo-gsc-removal-tracker.ts prefix [--min-count 3]
 *   npx tsx scripts/seo-gsc-removal-tracker.ts mark --cluster source_file [--prefix /pt/skills/kindfi-org/kindfi/]
 *   npx tsx scripts/seo-gsc-removal-tracker.ts verify
 *
 * Outputs:
 *   - reports/seo/latest-gsc-removal-tracker.json   (mutable submission log)
 *   - reports/seo/latest-gsc-removal-tracker.md     (dashboard render)
 *   - reports/seo/latest-gsc-removal-prefix-plan.md (safe prefix candidates)
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const REPORT_DIR = resolve(process.cwd(), 'reports/seo');
const BATCH_JSON_PATH = resolve(REPORT_DIR, 'latest-gsc-removal-batch.json');
const TRACKER_JSON_PATH = resolve(REPORT_DIR, 'latest-gsc-removal-tracker.json');
const TRACKER_MD_PATH = resolve(REPORT_DIR, 'latest-gsc-removal-tracker.md');
const PREFIX_PLAN_MD_PATH = resolve(REPORT_DIR, 'latest-gsc-removal-prefix-plan.md');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type BatchUrl = { url: string; cluster: string; priority: number };
type Batch = {
  generatedAt: string;
  totalUrls: number;
  byCluster: Record<string, { count: number; sample: string[] }>;
  urls: BatchUrl[];
};

type SubmissionEntry = {
  cluster: string;
  prefix?: string;
  urlCount: number;
  submittedAt: string;
  method: 'prefix' | 'individual';
  note?: string;
};

type Tracker = {
  batchGeneratedAt: string;
  batchTotalUrls: number;
  submissions: SubmissionEntry[];
  lastUpdated: string;
};

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
const command = process.argv[2] as 'status' | 'prefix' | 'mark' | 'verify' | undefined;

function readArg(flag: string): string | undefined {
  const argv = process.argv;
  // Support `--flag=value`
  const eqForm = argv.find((a) => a.startsWith(`${flag}=`));
  if (eqForm) return eqForm.slice(flag.length + 1);
  // Support `--flag value` (space-separated)
  const idx = argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < argv.length) {
    const next = argv[idx + 1];
    if (!next.startsWith('--')) return next;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------------
function loadBatch(): Batch {
  if (!existsSync(BATCH_JSON_PATH)) {
    console.error(`No removal batch found at ${BATCH_JSON_PATH}.`);
    console.error('Run the gsc-removal-batch-builder first.');
    process.exit(1);
  }
  return JSON.parse(readFileSync(BATCH_JSON_PATH, 'utf-8')) as Batch;
}

function loadTracker(batch: Batch): Tracker {
  if (!existsSync(TRACKER_JSON_PATH)) {
    return {
      batchGeneratedAt: batch.generatedAt,
      batchTotalUrls: batch.totalUrls,
      submissions: [],
      lastUpdated: new Date().toISOString(),
    };
  }
  return JSON.parse(readFileSync(TRACKER_JSON_PATH, 'utf-8')) as Tracker;
}

function saveTracker(tracker: Tracker): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  tracker.lastUpdated = new Date().toISOString();
  writeFileSync(TRACKER_JSON_PATH, `${JSON.stringify(tracker, null, 2)}\n`, 'utf-8');
}

// ---------------------------------------------------------------------------
// Prefix safety analysis
//
// GSC "Remove all URLs with this prefix" removes EVERY URL whose string starts
// with the given prefix. If a live Tier-1 landing page shares that prefix, it
// gets collateral-removed. We therefore only recommend a prefix when EVERY URL
// under it (within the batch's known universe) is itself a removal target.
//
// We approximate "live landing page" as the repo root:
//   /{locale}/skills/{owner}/{repo}   (no trailing source-file path)
// If that exact URL is NOT in the removal batch, the prefix is unsafe.
// ---------------------------------------------------------------------------
function extractRepoPrefix(url: string): string | null {
  const match = url.match(
    /^https:\/\/killer-skills\.com(\/[a-z]{2}|\/core)\/skills\/[^/]+\/[^/]+/,
  );
  return match ? match[0] : null;
}

function findSafePrefixes(batch: Batch, minCount: number): Array<{
  prefix: string;
  urlCount: number;
  cluster: string;
}> {
  const removalSet = new Set(batch.urls.map((u) => u.url));

  // Group batch URLs by repo prefix
  const byPrefix = new Map<
    string,
    { urls: BatchUrl[]; cluster: string }
  >();
  for (const entry of batch.urls) {
    const prefix = extractRepoPrefix(entry.url);
    if (!prefix) continue;
    const existing = byPrefix.get(prefix);
    if (existing) {
      existing.urls.push(entry);
    } else {
      byPrefix.set(prefix, { urls: [entry], cluster: entry.cluster });
    }
  }

  const safe: Array<{ prefix: string; urlCount: number; cluster: string }> = [];
  for (const [prefix, { urls, cluster }] of byPrefix) {
    if (urls.length < minCount) continue;
    // The repo landing page (prefix with no trailing path) must itself be a
    // removal target, otherwise prefix removal would collateral-damage it.
    const landingPage = prefix;
    if (!removalSet.has(landingPage)) continue;
    safe.push({ prefix: `${prefix}/`, urlCount: urls.length, cluster });
  }

  return safe.sort((a, b) => b.urlCount - a.urlCount);
}

// ---------------------------------------------------------------------------
// Status dashboard
// ---------------------------------------------------------------------------
function clusterProgress(
  batch: Batch,
  tracker: Tracker,
): Array<{
  cluster: string;
  batchCount: number;
  submitted: number;
  remaining: number;
  complete: boolean;
}> {
  const submittedByCluster = new Map<string, number>();
  for (const sub of tracker.submissions) {
    submittedByCluster.set(
      sub.cluster,
      (submittedByCluster.get(sub.cluster) || 0) + sub.urlCount,
    );
  }

  return Object.entries(batch.byCluster)
    .map(([cluster, data]) => {
      const submitted = submittedByCluster.get(cluster) || 0;
      return {
        cluster,
        batchCount: data.count,
        submitted,
        remaining: Math.max(0, data.count - submitted),
        complete: submitted >= data.count,
      };
    })
    .sort((a, b) => b.batchCount - a.batchCount);
}

function renderStatus(batch: Batch, tracker: Tracker): void {
  const progress = clusterProgress(batch, tracker);
  const totalSubmitted = progress.reduce((s, c) => s + c.submitted, 0);
  const totalRemaining = batch.totalUrls - totalSubmitted;
  const pct = batch.totalUrls > 0 ? (totalSubmitted / batch.totalUrls) * 100 : 0;
  const clustersComplete = progress.filter((c) => c.complete).length;

  const lines = [
    `# GSC Removal Submission Tracker`,
    ``,
    `**Batch generated:** ${batch.generatedAt}`,
    `**Tracker last updated:** ${tracker.lastUpdated}`,
    `**Total URLs:** ${batch.totalUrls}`,
    `**Submitted:** ${totalSubmitted} / ${batch.totalUrls} (${pct.toFixed(1)}%)`,
    `**Remaining:** ${totalRemaining}`,
    `**Clusters complete:** ${clustersComplete} / ${progress.length}`,
    ``,
    `## Cluster Progress`,
    ``,
    `| Cluster | Batch | Submitted | Remaining | Status |`,
    `|---------|-------|-----------|-----------|--------|`,
    ...progress.map(
      (c) =>
        `| ${c.cluster} | ${c.batchCount} | ${c.submitted} | ${c.remaining} | ${
          c.complete ? '✅ complete' : '⬜ pending'
        } |`,
    ),
    ``,
    `## Submission Log`,
    ``,
  ];

  if (tracker.submissions.length === 0) {
    lines.push(`_No submissions recorded yet._`, ``);
  } else {
    lines.push(
      `| Time | Cluster | Method | Count | Detail |`,
      `|------|---------|--------|-------|--------|`,
      ...tracker.submissions
        .slice()
        .reverse()
        .map(
          (s) =>
            `| ${s.submittedAt} | ${s.cluster} | ${s.method} | ${s.urlCount} | ${
              s.prefix ? `prefix \`${s.prefix}\`` : s.note || 'individual URLs'
            } |`,
        ),
      ``,
    );
  }

  lines.push(
    `## Commands`,
    ``,
    `- \`npx tsx scripts/seo-gsc-removal-tracker.ts status\` — this dashboard`,
    `- \`npx tsx scripts/seo-gsc-removal-tracker.ts prefix\` — safe prefix-removal candidates`,
    `- \`npx tsx scripts/seo-gsc-removal-tracker.ts mark --cluster <name> [--prefix <p>] [--count N]\` — record a submission`,
    `- \`npx tsx scripts/seo-gsc-removal-tracker.ts verify\` — re-inspect batch URLs to confirm removal`,
    ``,
  );

  writeFileSync(TRACKER_MD_PATH, lines.join('\n'), 'utf-8');
  console.log(lines.join('\n'));
  console.log(`\nDashboard written: ${TRACKER_MD_PATH}`);
}

// ---------------------------------------------------------------------------
// Prefix plan render
// ---------------------------------------------------------------------------
function renderPrefixPlan(batch: Batch, minCount: number): void {
  const safe = findSafePrefixes(batch, minCount);
  const coveredUrls = safe.reduce((s, p) => s + p.urlCount, 0);
  const prefixCount = safe.length;
  const individualCount = batch.totalUrls - coveredUrls;

  const lines = [
    `# GSC Removal — Safe Prefix Plan`,
    ``,
    `**Batch:** ${batch.totalUrls} URLs (generated ${batch.generatedAt})`,
    `**Min URLs per prefix:** ${minCount}`,
    `**Safe prefix removals:** ${prefixCount} (covers ${coveredUrls} URLs)`,
    `**Remaining individual removals:** ${individualCount}`,
    `**Total operator requests:** ${prefixCount + individualCount} (down from ${batch.totalUrls})`,
    ``,
    `## Why "safe"`,
    ``,
    `GSC prefix removal removes EVERY URL starting with the prefix. A prefix is`,
    `only listed here when the repo landing page (\`/{locale}/skills/{owner}/{repo}\`)`,
    `is itself in the removal batch — so no live Tier-1 page is collateral-removed.`,
    ``,
    `## Recommended Prefix Removals`,
    ``,
    `| # | Prefix | URLs Covered | Cluster |`,
    `|---|--------|--------------|---------|`,
    ...safe.map(
      (p, i) =>
        `| ${i + 1} | \`${p.prefix}\` | ${p.urlCount} | ${p.cluster} |`,
    ),
    ``,
    `## Remaining Individual Removals by Cluster`,
    ``,
    `| Cluster | Individual URLs |`,
    `|---------|-----------------|`,
  ];

  // Compute remaining per cluster after applying safe prefixes
  const coveredByCluster = new Map<string, number>();
  for (const p of safe) {
    coveredByCluster.set(
      p.cluster,
      (coveredByCluster.get(p.cluster) || 0) + p.urlCount,
    );
  }
  for (const [cluster, data] of Object.entries(batch.byCluster)) {
    const covered = coveredByCluster.get(cluster) || 0;
    const remaining = data.count - covered;
    if (remaining > 0) {
      lines.push(`| ${cluster} | ${remaining} |`);
    }
  }
  lines.push(``, `## Operator Workflow`, ``, `1. Submit each prefix above via GSC → Removals → "Remove all URLs with this prefix"`, `2. Record each: \`npm run report:seo:gsc-removal-tracker -- mark --cluster <name> --prefix <prefix>\``, `3. Submit remaining individual URLs (see \`latest-gsc-removal-batch.csv\`)`, `4. Record: \`npm run report:seo:gsc-removal-tracker -- mark --cluster <name> --count <N>\``, `5. Verify: \`npm run report:seo:gsc-removal-tracker -- verify\``, ``);

  writeFileSync(PREFIX_PLAN_MD_PATH, lines.join('\n'), 'utf-8');
  console.log(lines.join('\n'));
  console.log(`\nPrefix plan written: ${PREFIX_PLAN_MD_PATH}`);
}

// ---------------------------------------------------------------------------
// Mark a submission
// ---------------------------------------------------------------------------
function markSubmission(batch: Batch, tracker: Tracker): void {
  const cluster = readArg('--cluster');
  const prefix = readArg('--prefix');
  const countArg = readArg('--count');
  const note = readArg('--note');

  if (!cluster) {
    console.error('Usage: mark --cluster <name> [--prefix <p>] [--count N] [--note "..."]');
    console.error(`Valid clusters: ${Object.keys(batch.byCluster).join(', ')}`);
    process.exit(1);
  }

  if (!batch.byCluster[cluster]) {
    console.error(`Unknown cluster: ${cluster}`);
    console.error(`Valid clusters: ${Object.keys(batch.byCluster).join(', ')}`);
    process.exit(1);
  }

  let urlCount: number;
  if (countArg) {
    urlCount = parseInt(countArg, 10);
    if (Number.isNaN(urlCount) || urlCount < 1) {
      console.error(`Invalid --count: ${countArg}`);
      process.exit(1);
    }
  } else if (prefix) {
    // Count batch URLs under this prefix
    urlCount = batch.urls.filter((u) => u.url.startsWith(prefix)).length;
    if (urlCount === 0) {
      console.error(`No batch URLs match prefix: ${prefix}`);
      process.exit(1);
    }
  } else {
    // Default: mark the entire cluster
    urlCount = batch.byCluster[cluster].count;
  }

  const entry: SubmissionEntry = {
    cluster,
    prefix,
    urlCount,
    submittedAt: new Date().toISOString(),
    method: prefix ? 'prefix' : 'individual',
    note,
  };

  tracker.submissions.push(entry);
  saveTracker(tracker);
  console.log(`✅ Recorded submission: ${cluster} (${urlCount} URLs, ${entry.method})`);
  console.log(`   Total submissions: ${tracker.submissions.length}`);

  // Re-render dashboard
  renderStatus(batch, tracker);
}

// ---------------------------------------------------------------------------
// Verify (delegate to inspection sweep)
// ---------------------------------------------------------------------------
function verify(): void {
  console.log('Verification delegates to the URL Inspection coverage sweep.');
  console.log('Run: npm run report:seo:url-inspection-coverage-sweep');
  console.log('');
  console.log('The sweep inspects batch URLs via the GSC URL Inspection API and');
  console.log('produces same-day evidence of de-indexing. Compare the sweep');
  console.log('verdict breakdown against the pre-submission baseline (expect');
  console.log('NEUTRAL/FAIL to increase as URLs are removed from the index).');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main(): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  const batch = loadBatch();
  const tracker = loadTracker(batch);

  switch (command) {
    case 'status':
      renderStatus(batch, tracker);
      break;
    case 'prefix': {
      const minCount = parseInt(readArg('--min-count') || '3', 10);
      renderPrefixPlan(batch, minCount);
      break;
    }
    case 'mark':
      markSubmission(batch, tracker);
      break;
    case 'verify':
      verify();
      break;
    default:
      console.error('Usage: npx tsx scripts/seo-gsc-removal-tracker.ts <status|prefix|mark|verify>');
      console.error('');
      console.error('Commands:');
      console.error('  status   Render the submission dashboard');
      console.error('  prefix   Extract safe prefix-removal candidates');
      console.error('  mark     Record a submission (--cluster, [--prefix], [--count])');
      console.error('  verify   Confirm removal progress via URL Inspection');
      process.exit(1);
  }
}

main();
