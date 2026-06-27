#!/usr/bin/env npx tsx
/**
 * GSC Removal Batch v2 Builder
 *
 * Phase 156 (Index Health Closure): Reads the latest coverage drilldown
 * and 404 remediation plan, excludes URLs already in the v1 (REMOV-01)
 * batch, ranks residual clusters by weighted impact, and selects the
 * top 3 clusters for a second-pass removal batch.
 *
 * Usage:
 *   npx tsx scripts/seo-gsc-removal-batch-v2.ts
 *   npx tsx scripts/seo-gsc-removal-batch-v2.ts --top-clusters 5
 *   npx tsx scripts/seo-gsc-removal-batch-v2.ts --dry-run
 *
 * Outputs:
 *   - reports/seo/latest-gsc-removal-batch-v2.csv  (one URL per line for GSC)
 *   - reports/seo/latest-gsc-removal-batch-v2.json  (structured batch with metadata)
 *   - reports/seo/latest-gsc-removal-batch-v2.md    (runbook with cluster breakdown)
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const REPORT_DIR = resolve(process.cwd(), 'reports/seo');
const DRILLDOWN_JSON = resolve(REPORT_DIR, 'latest-coverage-drilldown.json');
const REMEDIATION_JSON = resolve(REPORT_DIR, 'latest-404-remediation-plan.json');
const V1_BATCH_JSON = resolve(REPORT_DIR, 'latest-gsc-removal-batch.json');
const V2_CSV = resolve(REPORT_DIR, 'latest-gsc-removal-batch-v2.csv');
const V2_JSON = resolve(REPORT_DIR, 'latest-gsc-removal-batch-v2.json');
const V2_MD = resolve(REPORT_DIR, 'latest-gsc-removal-batch-v2.md');

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const topClustersArg = process.argv.find((a) => a.startsWith('--top-clusters='));
const TOP_CLUSTERS = topClustersArg ? parseInt(topClustersArg.split('=')[1], 10) : 3;

// ---------------------------------------------------------------------------
// Types (exported for testability)
// ---------------------------------------------------------------------------
type ClusterId =
  | 'query_parameter'
  | 'legacy_html'
  | 'source_file_path'
  | 'deep_skill_path'
  | 'trailing_slash'
  | 'repeated_segment'
  | 'sandbox_path'
  | 'known_skill_404'
  | 'other';

type ClusterStats = {
  cluster: ClusterId;
  sampleCount: number;
  estimatedAffected: number;
  weightedImpact: number;
  topSamples: string[];
};

type DrilldownReport = {
  generatedAt: string;
  totalAffectedPages: number;
  clusterPriorities: ClusterStats[];
};

type RemediationAction = {
  url: string;
  cluster: string;
  action: string;
  reason: string;
  targetUrl?: string;
  coveredByRuntime: boolean;
  runtimeCoverageSource: string;
};

type RemediationPlan = {
  generatedAt: string;
  issueName: string;
  totalSamples: number;
  actions: RemediationAction[];
};

type V1BatchUrl = { url: string; cluster: string; priority: number };
type V1Batch = {
  generatedAt: string;
  totalUrls: number;
  byCluster: Record<string, { count: number; sample: string[] }>;
  urls: V1BatchUrl[];
};

export type V2BatchUrl = {
  url: string;
  cluster: string;
  drilldownCluster: ClusterId;
  action: string;
  reason: string;
  priority: number;
};

export type V2ClusterBreakdown = {
  cluster: ClusterId;
  estimatedAffected: number;
  weightedImpact: number;
  selectedCount: number;
  totalCandidates: number;
  topSamples: string[];
  priorityRationale: string;
};

export type V2Batch = {
  generatedAt: string;
  sourceDrilldown: string;
  sourceRemediation: string;
  excludedV1Urls: number;
  targetClusters: ClusterId[];
  totalUrls: number;
  byCluster: Record<string, { count: number; sample: string[]; rationale: string }>;
  clusterBreakdown: V2ClusterBreakdown[];
  urls: V2BatchUrl[];
};

// ---------------------------------------------------------------------------
// Batch cluster → drilldown cluster mapping
// ---------------------------------------------------------------------------
export function mapBatchClusterToDrilldown(batchCluster: string): ClusterId[] {
  const mapping: Record<string, ClusterId[]> = {
    source_file: ['source_file_path'],
    skill_blocklisted: ['known_skill_404'],
    skill_missing_or_unpublished: ['known_skill_404'],
    trailing_slash: ['trailing_slash'],
    query_param: ['query_parameter'],
    middleware_301_redirect: ['other'],
    deep_path: ['deep_skill_path'],
    other: ['other'],
  };
  return mapping[batchCluster] || [batchCluster as ClusterId];
}

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------
function loadDrilldown(): DrilldownReport {
  if (!existsSync(DRILLDOWN_JSON)) {
    console.error(`No coverage drilldown found at ${DRILLDOWN_JSON}.`);
    console.error('Run: npm run report:seo:coverage-drilldown');
    process.exit(1);
  }
  return JSON.parse(readFileSync(DRILLDOWN_JSON, 'utf-8')) as DrilldownReport;
}

function loadRemediation(): RemediationPlan | null {
  if (!existsSync(REMEDIATION_JSON)) {
    console.warn(`No 404 remediation plan found at ${REMEDIATION_JSON}.`);
    console.warn('Run: npm run report:seo:404-plan');
    return null;
  }
  return JSON.parse(readFileSync(REMEDIATION_JSON, 'utf-8')) as RemediationPlan;
}

function loadV1Batch(): V1Batch | null {
  if (!existsSync(V1_BATCH_JSON)) {
    console.warn(`No v1 removal batch found at ${V1_BATCH_JSON}.`);
    console.warn('Building v2 batch without v1 exclusion.');
    return null;
  }
  return JSON.parse(readFileSync(V1_BATCH_JSON, 'utf-8')) as V1Batch;
}

// ---------------------------------------------------------------------------
// Batch generation logic
// ---------------------------------------------------------------------------

/**
 * Compute how many URLs from each v1 cluster hit each drilldown cluster.
 * Returns a map: drilldownCluster → count of v1 URLs that mapped to it.
 */
export function computeV1Coverage(
  v1Batch: V1Batch,
): Map<ClusterId, { v1Urls: number; drilldownClusters: ClusterId[] }> {
  const result = new Map<ClusterId, { v1Urls: number; drilldownClusters: ClusterId[] }>();

  for (const [batchCluster, data] of Object.entries(v1Batch.byCluster)) {
    const drilldownClusters = mapBatchClusterToDrilldown(batchCluster);
    for (const dc of drilldownClusters) {
      const existing = result.get(dc) || { v1Urls: 0, drilldownClusters: [] };
      existing.v1Urls += data.count;
      if (!existing.drilldownClusters.includes(dc)) {
        existing.drilldownClusters.push(dc);
      }
      result.set(dc, existing);
    }
  }

  return result;
}

/**
 * Build the v2 removal batch by selecting URLs from the remediation plan
 * that belong to the top residual drilldown clusters and are NOT in the
 * v1 batch.
 */
export function buildV2Batch(
  drilldown: DrilldownReport,
  remediation: RemediationPlan | null,
  v1Batch: V1Batch | null,
  topN: number,
): V2Batch {
  // Build v1 URL exclusion set
  const v1UrlSet = new Set<string>();
  if (v1Batch) {
    for (const u of v1Batch.urls) {
      v1UrlSet.add(u.url);
    }
  }

  // Compute v1 coverage per drilldown cluster
  const v1Coverage = v1Batch ? computeV1Coverage(v1Batch) : new Map<ClusterId, { v1Urls: number; drilldownClusters: ClusterId[] }>();

  // Rank drilldown clusters by weighted impact (residual)
  const residualClusters = drilldown.clusterPriorities
    .map((cp) => ({
      cluster: cp.cluster,
      estimatedAffected: cp.estimatedAffected,
      weightedImpact: cp.weightedImpact,
      v1AlreadyCovered: v1Coverage.get(cp.cluster)?.v1Urls || 0,
      topSamples: cp.topSamples || [],
    }))
    .sort((a, b) => b.weightedImpact - a.weightedImpact);

  // Select top N clusters (by residual weighted impact)
  const selectedClusters = residualClusters.slice(0, topN).map((rc) => rc.cluster);

  // Build URL candidates from remediation plan
  const candidates: V2BatchUrl[] = [];
  if (remediation) {
    for (const action of remediation.actions) {
      if (v1UrlSet.has(action.url)) continue;
      // The remediation plan uses cluster IDs like source_file_path, trailing_slash etc.
      // which match the drilldown cluster IDs.
      const remediationCluster = action.cluster as ClusterId;
      if (!selectedClusters.includes(remediationCluster)) continue;
      // Only include URLs with actionable statuses (gone_410 or redirect_301)
      if (action.action !== 'gone_410' && action.action !== 'redirect_301') continue;

      candidates.push({
        url: action.url,
        cluster: action.cluster,
        drilldownCluster: remediationCluster,
        action: action.action,
        reason: action.reason,
        priority: action.action === 'gone_410' ? 1 : 2, // gone → higher priority
      });
    }
  }

  // If we couldn't get enough from the remediation plan, add top sample URLs
  // from the drilldown directly (valid for gone_410 treatment)
  const candidateUrlSet = new Set(candidates.map((c) => c.url));
  for (const rc of residualClusters.filter((rc) => selectedClusters.includes(rc.cluster))) {
    for (const sampleUrl of rc.topSamples) {
      if (candidateUrlSet.has(sampleUrl)) continue;
      if (v1UrlSet.has(sampleUrl)) continue;
      candidates.push({
        url: sampleUrl,
        cluster: rc.cluster,
        drilldownCluster: rc.cluster,
        action: 'gone_410',
        reason: 'coverage_drilldown_sample',
        priority: 3, // lower priority than remediation plan entries
      });
      candidateUrlSet.add(sampleUrl);
    }
  }

  // Sort by priority (lower = more important)
  candidates.sort((a, b) => a.priority - b.priority);

  // Build cluster breakdown
  const clusterBreakdown: V2ClusterBreakdown[] = [];
  const byClusterMap = new Map<ClusterId, V2BatchUrl[]>();
  for (const c of candidates) {
    const list = byClusterMap.get(c.drilldownCluster) || [];
    list.push(c);
    byClusterMap.set(c.drilldownCluster, list);
  }

  const byCluster: Record<string, { count: number; sample: string[]; rationale: string }> = {};

  for (const rc of residualClusters.filter((rc) => selectedClusters.includes(rc.cluster))) {
    const clusterUrls = byClusterMap.get(rc.cluster) || [];
    const cp = drilldown.clusterPriorities.find((p) => p.cluster === rc.cluster);

    clusterBreakdown.push({
      cluster: rc.cluster,
      estimatedAffected: rc.estimatedAffected,
      weightedImpact: rc.weightedImpact,
      selectedCount: clusterUrls.length,
      totalCandidates: clusterUrls.length,
      topSamples: clusterUrls.slice(0, 5).map((u) => u.url),
      priorityRationale: `Weighted impact: ${rc.weightedImpact}, estimated affected: ${rc.estimatedAffected}, v1 already covered: ${rc.v1AlreadyCovered} URLs`,
    });

    byCluster[rc.cluster] = {
      count: clusterUrls.length,
      sample: clusterUrls.slice(0, 5).map((u) => u.url),
      rationale: `Residual from v1 — weighted impact ${rc.weightedImpact}, ${rc.estimatedAffected} est. affected, v1 covered ${rc.v1AlreadyCovered}`,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceDrilldown: DRILLDOWN_JSON,
    sourceRemediation: remediation ? REMEDIATION_JSON : 'missing',
    excludedV1Urls: v1UrlSet.size,
    targetClusters: selectedClusters,
    totalUrls: candidates.length,
    byCluster,
    clusterBreakdown,
    urls: candidates,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderCsv(batch: V2Batch): string {
  return batch.urls.map((u) => u.url).join('\n') + '\n';
}

function renderMarkdown(batch: V2Batch): string {
  const lines = [
    `# GSC Removal Batch v2 (Second Pass)`,
    ``,
    `**Generated:** ${batch.generatedAt}`,
    `**Source drilldown:** ${batch.sourceDrilldown}`,
    `**Source remediation:** ${batch.sourceRemediation}`,
    `**Excluded v1 URLs:** ${batch.excludedV1Urls}`,
    `**Target clusters:** ${batch.targetClusters.join(', ')}`,
    `**Total URLs:** ${batch.totalUrls}`,
    ``,
    `## Cluster Breakdown`,
    ``,
    `| Cluster | Selected | Est. Affected | Weighted Impact | Rationale |`,
    `|---------|----------|---------------|----------------|-----------|`,
    ...batch.clusterBreakdown.map(
      (c) =>
        `| ${c.cluster} | ${c.selectedCount} | ${c.estimatedAffected} | ${c.weightedImpact} | ${c.priorityRationale} |`,
    ),
    ``,
    `## Cluster Details`,
    ``,
  ];

  for (const c of batch.clusterBreakdown) {
    lines.push(`### ${c.cluster}`);
    lines.push('');
    lines.push(`- Est. affected pages: ${c.estimatedAffected}`);
    lines.push(`- Weighted impact: ${c.weightedImpact}`);
    lines.push(`- Selected URLs: ${c.selectedCount}`);
    lines.push(`- Rationale: ${c.priorityRationale}`);
    lines.push('');
    if (c.topSamples.length > 0) {
      lines.push(`Sample URLs:`);
      for (const url of c.topSamples) {
        lines.push(`- \`${url}\``);
      }
    }
    lines.push('');
  }

  // Per-cluster URL counts
  lines.push(`## URLs by Cluster`);
  lines.push('');
  lines.push(`| Cluster | Count | Rationale |`);
  lines.push(`|---------|-------|-----------|`);
  for (const [cluster, data] of Object.entries(batch.byCluster)) {
    lines.push(`| ${cluster} | ${data.count} | ${data.rationale} |`);
  }
  lines.push('');

  // Operator runbook
  lines.push(`## Operator Runbook`);
  lines.push('');
  lines.push(`1. Submit each URL in \`reports/seo/latest-gsc-removal-batch-v2.csv\` via GSC → Removals → "Temporarily remove URL"`);
  lines.push(`2. For same-owner/same-repo URLs, consider prefix removal (use \`npm run report:seo:gsc-removal-tracker -- prefix\`)`);
  lines.push(`3. Record each cluster: \`npm run report:seo:gsc-removal-tracker -- mark --cluster <name> --count <N>\``);
  lines.push(`4. Wait 24-48 hours after final submission`);
  lines.push(`5. Verify: \`npm run report:seo:gsc-removal-verification -- verify --batch reports/seo/latest-gsc-removal-batch-v2.json\``);
  lines.push(`6. Compute delta: \`npm run report:seo:coverage-delta -- --before <pre-sweep> --after <post-sweep>\``);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Cross-reference analysis (REMOV-01 batch vs coverage clusters)
// ---------------------------------------------------------------------------
function renderCrossref(v1Batch: V1Batch | null, drilldown: DrilldownReport): string {
  if (!v1Batch) return '_No v1 batch available for cross-reference._';

  const v1Coverage = computeV1Coverage(v1Batch);
  const lines: string[] = [];

  lines.push('| REMOV-01 Cluster | URLs in Batch | Coverage Cluster(s) Hit | Est. Anomalies Addressed |');
  lines.push('|------------------|-------------|----------------------|--------------------------|');

  let totalEstimated = 0;
  for (const [batchCluster, data] of Object.entries(v1Batch.byCluster)) {
    const drilldownClusters = mapBatchClusterToDrilldown(batchCluster);
    const clusterIds = drilldownClusters.join(', ') || '(unmapped)';

    // Estimate anomalies addressed: use drilldown's estimatedAffected for each
    // mapped cluster, scaled by batch URLs / total in that cluster
    let estAnomalies = 0;
    for (const dc of drilldownClusters) {
      const cp = drilldown.clusterPriorities.find((p) => p.cluster === dc);
      if (cp) {
        // Simple proportional estimate: batch URLs / sample count * estimatedAffected
        const ratio = cp.sampleCount > 0 ? Math.min(1, data.count / cp.sampleCount) : 1;
        estAnomalies += Math.round(cp.estimatedAffected * ratio);
      }
    }

    totalEstimated += estAnomalies;
    lines.push(`| ${batchCluster} | ${data.count} | ${clusterIds} | ~${estAnomalies} |`);
  }

  lines.push('');
  lines.push(`**Total estimated anomalies addressed by REMOV-01:** ~${totalEstimated}`);
  lines.push('');
  lines.push(`**Baseline:** 10,783 anomalies`);
  lines.push(`**Estimated residual after REMOV-01:** ~${10783 - totalEstimated}`);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main(): void {
  mkdirSync(REPORT_DIR, { recursive: true });

  const drilldown = loadDrilldown();
  const remediation = loadRemediation();
  const v1Batch = loadV1Batch();

  console.log('Coverage drilldown loaded:');
  console.log(`  Total affected pages: ${drilldown.totalAffectedPages}`);
  console.log(`  Cluster priorities: ${drilldown.clusterPriorities.length}`);

  if (v1Batch) {
    console.log(`V1 batch: ${v1Batch.totalUrls} URLs (excluded from v2)`);
  }

  console.log(`\nBuilding v2 batch (top ${TOP_CLUSTERS} residual clusters)...`);

  const batch = buildV2Batch(drilldown, remediation, v1Batch, TOP_CLUSTERS);

  console.log(`V2 batch: ${batch.totalUrls} URLs across ${batch.targetClusters.length} clusters`);
  for (const [cluster, data] of Object.entries(batch.byCluster)) {
    console.log(`  ${cluster}: ${data.count} URLs`);
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Remove --dry-run to write output files.');
    console.log(`Would write: ${V2_CSV}, ${V2_JSON}, ${V2_MD}`);
    return;
  }

  // Write outputs
  writeFileSync(V2_CSV, renderCsv(batch), 'utf-8');
  writeFileSync(V2_JSON, `${JSON.stringify(batch, null, 2)}\n`, 'utf-8');

  // Build markdown with crossref appendix
  const crossrefMd = renderCrossref(v1Batch, drilldown);
  const batchMd = renderMarkdown(batch);
  const fullMd = batchMd + '\n## REMOV-01 Cross-Reference\n\n' + crossrefMd;

  writeFileSync(V2_MD, fullMd, 'utf-8');

  // Also write crossref as standalone file
  const CROSSREF_MD = resolve(REPORT_DIR, 'latest-remov01-coverage-crossref.md');
  writeFileSync(CROSSREF_MD, `# REMOV-01 Coverage Cross-Reference\n\nGenerated: ${new Date().toISOString()}\n\n${crossrefMd}`, 'utf-8');

  console.log(`\nV2 batch written:`);
  console.log(`  CSV: ${V2_CSV} (${batch.totalUrls} URLs)`);
  console.log(`  JSON: ${V2_JSON}`);
  console.log(`  Markdown: ${V2_MD}`);
  console.log(`  Cross-reference: ${CROSSREF_MD}`);
}

// Only run main when executed directly (not when imported by tests)
const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main();
}
