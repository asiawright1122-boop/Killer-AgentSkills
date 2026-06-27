#!/usr/bin/env npx tsx
/**
 * SEO Traffic Proof Dashboard
 *
 * Combines GSC CTR data, URL Inspection sweep results, and the search
 * compliance matrix into a single weekly dashboard. This is the "traffic
 * proof dashboard" required by FRESH-01 to close REC-24.
 *
 * Usage:
 *   npx tsx scripts/seo-traffic-proof-dashboard.ts
 *
 * Output:
 *   - reports/seo/latest-traffic-proof.json
 *   - reports/seo/latest-traffic-proof.md
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  buildSearchComplianceMatrixReportFromFiles,
  DEFAULT_CRAWL_HEALTH_JSON_PATH,
  DEFAULT_COVERAGE_DRILLDOWN_JSON_PATH,
  DEFAULT_TRAFFIC_JSON_PATH,
  DEFAULT_RECOVERY_PROOF_WINDOW_JSON_PATH,
  DEFAULT_AUTHORITY_UPLIFT_JSON_PATH,
  DEFAULT_RECOVERY_EXPERIMENT_LADDER_JSON_PATH,
  DEFAULT_URL_INSPECTION_SWEEP_JSON_PATH,
  DEFAULT_GUIDELINES_RESEARCH_PATH,
  type SearchComplianceMatrixReport,
} from './lib/search-compliance-matrix';

// ---------------------------------------------------------------------------
// Default paths
// ---------------------------------------------------------------------------
const REPORT_DIR = resolve(process.cwd(), 'reports/seo');
const JSON_OUTPUT = resolve(REPORT_DIR, 'latest-traffic-proof.json');
const MD_OUTPUT = resolve(REPORT_DIR, 'latest-traffic-proof.md');

const COVERAGE_DRILLDOWN_JSON = resolve(process.cwd(), DEFAULT_COVERAGE_DRILLDOWN_JSON_PATH);
const SWEEP_JSON = resolve(process.cwd(), DEFAULT_URL_INSPECTION_SWEEP_JSON_PATH);
const CTR_JSON = resolve(process.cwd(), DEFAULT_TRAFFIC_JSON_PATH);
const OPPORTUNITY_BOARD_JSON = resolve(process.cwd(), 'reports/seo/latest-gsc-opportunity-board.json');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type SweepRecord = {
  url: string;
  cluster: string;
  verdict: string;
  coverageState: string;
  lastCrawlTime: string | null;
  googleCanonical: string | null;
};

type SweepJson = {
  generatedAt?: string;
  sourceMode?: string;
  totalSampled?: number;
  overallPassRate?: number;
  clustersInspected?: number;
  clusters?: Array<{ cluster: string; sampleSize: number; passCount: number; neutralCount: number; failCount: number }>;
  records?: SweepRecord[];
};

type CoverageDrilldownJson = {
  generatedAt?: string;
  sourceFreshnessStatus?: string;
  sourceFreshnessDate?: string | null;
  sourceFreshnessDays?: number | null;
  totalAffectedPages?: number;
  clusterPriorities?: Array<{ cluster?: string; estimatedAffected?: number; weightedImpact?: number }>;
};

type CtrJson = {
  generatedAt?: string;
  status?: string;
  sourceMode?: string;
  currentPeriod?: { start?: string; end?: string };
  previousPeriod?: { start?: string; end?: string };
  queryRows?: number | null;
  pageRows?: number | null;
  priorityQueryOpportunities?: number | null;
  priorityPageOpportunities?: number | null;
};

type OpportunityBoardJson = {
  items?: Array<{
    lane?: string;
    actions?: string[];
  }>;
};

type FreshnessSlaStatus = {
  drilldown: { ageDays: number | null; status: 'fresh' | 'stale' | 'missing' };
  sweep: { ageDays: number | null; status: 'fresh' | 'stale' | 'missing'; sampled: number };
  combined: 'fresh' | 'stale' | 'missing';
};

type TrafficProofReport = {
  generatedAt: string;
  credentialsPresent: boolean;
  freshnessSla: FreshnessSlaStatus;
  p0SurfaceHealth: Array<{
    url: string;
    cluster: string;
    verdict: string;
    coverageState: string;
    lastCrawlTime: string | null;
  }>;
  gscTrafficSummary: {
    status: string | null;
    sourceMode: string | null;
    currentPeriod: { start: string | null; end: string | null };
    queryRows: number | null;
    pageRows: number | null;
    priorityQueryOpportunities: number | null;
    priorityPageOpportunities: number | null;
  };
  blocklistedUrlSummary: {
    blocklistedInGscCount: number;
    source: string;
  };
  complianceStatus: {
    overallVerdict: string;
    headline: string;
    counts: Record<string, number>;
  };
  trendSnapshot: {
    coverageAffectedPages: number | null;
    coverageSourceAgeDays: number | null;
    sweepSampled: number | null;
    sweepPassRate: number | null;
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DAY_MS = 24 * 60 * 60 * 1000;

function computeAgeDays(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const parsed = new Date(isoDate);
  if (!Number.isFinite(parsed.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / DAY_MS));
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

function freshnessLabel(ageDays: number | null, maxDays: number): 'fresh' | 'stale' | 'missing' {
  if (ageDays === null) return 'missing';
  return ageDays <= maxDays ? 'fresh' : 'stale';
}

// ---------------------------------------------------------------------------
// Build report
// ---------------------------------------------------------------------------
function buildReport(): TrafficProofReport {
  // Load source artifacts
  const coverage = readJson<CoverageDrilldownJson>(COVERAGE_DRILLDOWN_JSON);
  const sweep = readJson<SweepJson>(SWEEP_JSON);
  const ctr = readJson<CtrJson>(CTR_JSON);
  const opportunityBoard = readJson<OpportunityBoardJson>(OPPORTUNITY_BOARD_JSON);

  // Resolve CI credential presence
  const credentialsPresent = process.env.CREDENTIALS_PRESENT !== 'false';

  // Count blocklisted skill URLs in GSC from opportunity board
  let blocklistedInGscCount = 0;
  if (Array.isArray(opportunityBoard?.items)) {
    blocklistedInGscCount = opportunityBoard.items.filter(
      (item: { lane?: string; actions?: string[] }) =>
        item.lane === 'canonicalization' &&
        Array.isArray(item.actions) &&
        item.actions.some((a: string) => a.toLowerCase().includes('blocklisted')),
    ).length;
  }

  const blocklistedUrlSummary = {
    blocklistedInGscCount,
    source: opportunityBoard ? 'opportunity-board' : 'unavailable',
  };

  // Compute freshness SLA
  const drilldownAgeDays = coverage?.sourceFreshnessDays ?? computeAgeDays(coverage?.generatedAt);
  const sweepAgeDays = computeAgeDays(sweep?.generatedAt);
  const sweepSampled = sweep?.totalSampled ?? 0;
  const sweepIsFresh = sweepAgeDays !== null && sweepAgeDays <= 7 && sweepSampled >= 10;

  const freshnessSla: FreshnessSlaStatus = {
    drilldown: {
      ageDays: drilldownAgeDays,
      status: freshnessLabel(drilldownAgeDays, 7),
    },
    sweep: {
      ageDays: sweepAgeDays,
      status: sweepIsFresh ? 'fresh' : sweepAgeDays !== null ? 'stale' : 'missing',
      sampled: sweepSampled,
    },
    combined: sweepIsFresh || freshnessLabel(drilldownAgeDays, 7) === 'fresh' ? 'fresh'
      : drilldownAgeDays !== null || sweepAgeDays !== null ? 'stale'
      : 'missing',
  };

  // P0 Surface Health from sweep records
  const p0SurfaceHealth = (sweep?.records || [])
    .filter((r) => r.cluster?.startsWith('p0_surface'))
    .map((r) => ({
      url: r.url,
      cluster: r.cluster,
      verdict: r.verdict,
      coverageState: r.coverageState,
      lastCrawlTime: r.lastCrawlTime,
    }));

  // GSC Traffic Summary
  const gscTrafficSummary = {
    status: ctr?.status ?? null,
    sourceMode: ctr?.sourceMode ?? null,
    currentPeriod: {
      start: ctr?.currentPeriod?.start ?? null,
      end: ctr?.currentPeriod?.end ?? null,
    },
    queryRows: ctr?.queryRows ?? null,
    pageRows: ctr?.pageRows ?? null,
    priorityQueryOpportunities: ctr?.priorityQueryOpportunities ?? null,
    priorityPageOpportunities: ctr?.priorityPageOpportunities ?? null,
  };

  // Compliance status
  let complianceReport: SearchComplianceMatrixReport | null = null;
  try {
    complianceReport = buildSearchComplianceMatrixReportFromFiles();
  } catch {
    // Graceful degradation — compliance matrix may not have all inputs
  }

  const complianceStatus = complianceReport
    ? {
        overallVerdict: complianceReport.overallVerdict,
        headline: complianceReport.headline,
        counts: complianceReport.counts as Record<string, number>,
      }
    : {
        overallVerdict: 'unavailable',
        headline: 'Compliance matrix could not be built from available report artifacts.',
        counts: { pass: 0, watch: 0, block: 0, unavailable: 0 },
      };

  // Trend snapshot
  const trendSnapshot = {
    coverageAffectedPages: coverage?.totalAffectedPages ?? null,
    coverageSourceAgeDays: drilldownAgeDays,
    sweepSampled: sweepSampled || null,
    sweepPassRate: sweep?.overallPassRate ?? null,
  };

  return {
    generatedAt: new Date().toISOString(),
    credentialsPresent,
    freshnessSla,
    p0SurfaceHealth,
    gscTrafficSummary,
    blocklistedUrlSummary,
    complianceStatus,
    trendSnapshot,
  };
}

// ---------------------------------------------------------------------------
// Render Markdown
// ---------------------------------------------------------------------------
function renderMarkdown(report: TrafficProofReport): string {
  const lines: string[] = [];

  lines.push('# Traffic Proof Dashboard');
  lines.push('');
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push('');

  // Freshness SLA Status
  lines.push('## Freshness SLA Status');
  lines.push('');
  const sla = report.freshnessSla;
  const combinedEmoji = sla.combined === 'fresh' ? '✅' : sla.combined === 'stale' ? '⚠️' : '❌';
  lines.push(`**Combined freshness:** ${combinedEmoji} \`${sla.combined}\``);
  lines.push('');
  lines.push('| Source | Age | Status | Details |');
  lines.push('|--------|-----|--------|---------|');
  lines.push(
    `| Coverage Drilldown | ${sla.drilldown.ageDays ?? 'n/a'} day(s) | ${sla.drilldown.status} | Manual CSV export |`,
  );
  lines.push(
    `| URL Inspection Sweep | ${sla.sweep.ageDays ?? 'n/a'} day(s) | ${sla.sweep.status} | sampled=${sla.sweep.sampled} |`,
  );
  lines.push('');

  // P0 Surface Health
  lines.push('## P0 Surface Health');
  lines.push('');
  const p0 = report.p0SurfaceHealth;
  if (p0.length === 0) {
    lines.push('_No P0 surface inspection records available. Run `npm run report:seo:coverage-sweep:p0` to generate._');
  } else {
    lines.push('| Surface | Verdict | Coverage State | Last Crawled |');
    lines.push('|---------|---------|---------------|-------------|');
    for (const item of p0) {
      const shortPath = item.url.replace(/^https:\/\/killer-skills\.com/, '');
      lines.push(`| \`${shortPath}\` | ${item.verdict} | ${item.coverageState} | ${item.lastCrawlTime || 'n/a'} |`);
    }
  }
  lines.push('');

  // GSC Traffic Summary
  lines.push('## GSC Traffic Summary');
  lines.push('');
  const t = report.gscTrafficSummary;
  if (t.sourceMode === 'live-api') {
    lines.push(`- **Status:** ${t.status || 'n/a'}`);
    lines.push(`- **Source:** ${t.sourceMode}`);
    lines.push(`- **Period:** ${t.currentPeriod.start || '?'} to ${t.currentPeriod.end || '?'}`);
    lines.push(`- **Query rows:** ${t.queryRows ?? 'n/a'}`);
    lines.push(`- **Page rows:** ${t.pageRows ?? 'n/a'}`);
    lines.push(`- **Priority query opportunities:** ${t.priorityQueryOpportunities ?? 'n/a'}`);
    lines.push(`- **Priority page opportunities:** ${t.priorityPageOpportunities ?? 'n/a'}`);
  } else {
    lines.push(
      t.sourceMode === 'missing-config'
        ? '_GSC API not configured. Set GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, GSC_SITE_URL._'
        : '_GSC traffic data unavailable._',
    );
  }
  lines.push('');

  // Blocklisted URL Summary
  lines.push('## Blocklisted URL Summary');
  lines.push('');
  const bl = report.blocklistedUrlSummary;
  if (bl.blocklistedInGscCount > 50) {
    lines.push(`🔴 **${bl.blocklistedInGscCount}** blocklisted skill URLs still appear in GSC page data (source: ${bl.source}). Continue REMOV-01 submission.`);
  } else if (bl.blocklistedInGscCount > 10) {
    lines.push(`🟡 **${bl.blocklistedInGscCount}** blocklisted skill URLs still appear in GSC page data (source: ${bl.source}).`);
  } else if (bl.blocklistedInGscCount > 0) {
    lines.push(`🟢 **${bl.blocklistedInGscCount}** blocklisted skill URLs in GSC page data (source: ${bl.source}). Within acceptable range.`);
  } else {
    lines.push('✅ No blocklisted skill URLs detected in GSC page data.');
  }
  lines.push('');

  // Compliance Status
  lines.push('## Compliance Status');
  lines.push('');
  const c = report.complianceStatus;
  lines.push(`- **Overall verdict:** \`${c.overallVerdict}\``);
  lines.push(`- **Headline:** ${c.headline}`);
  lines.push(
    `- **Counts:** pass=${c.counts.pass}, watch=${c.counts.watch}, block=${c.counts.block}, unavailable=${c.counts.unavailable}`,
  );
  lines.push('');

  // Trend Snapshot
  lines.push('## Trend Snapshot');
  lines.push('');
  const trend = report.trendSnapshot;
  lines.push(`- **Coverage affected pages:** ${trend.coverageAffectedPages ?? 'n/a'}`);
  lines.push(`- **Coverage source age:** ${trend.coverageSourceAgeDays ?? 'n/a'} day(s)`);
  lines.push(`- **Sweep sampled:** ${trend.sweepSampled ?? 'n/a'}`);
  lines.push(`- **Sweep pass rate:** ${trend.sweepPassRate != null ? (trend.sweepPassRate * 100).toFixed(1) + '%' : 'n/a'}`);
  lines.push('');

  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  mkdirSync(REPORT_DIR, { recursive: true });

  const report = buildReport();
  const markdown = renderMarkdown(report);

  writeFileSync(JSON_OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(MD_OUTPUT, markdown, 'utf8');

  console.log(`Traffic proof dashboard generated.`);
  console.log(`JSON: ${JSON_OUTPUT}`);
  console.log(`Markdown: ${MD_OUTPUT}`);
  console.log(`Freshness SLA: ${report.freshnessSla.combined}`);
  console.log(`P0 surfaces inspected: ${report.p0SurfaceHealth.length}`);
  console.log(`GSC source: ${report.gscTrafficSummary.sourceMode || 'n/a'}`);
  console.log(`Compliance verdict: ${report.complianceStatus.overallVerdict}`);
}

main();
