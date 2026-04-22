import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

export const DEFAULT_RECOVERY_PROOF_WINDOW_MD_PATH = 'reports/seo/latest-recovery-proof-window.md';
export const DEFAULT_RECOVERY_PROOF_WINDOW_JSON_PATH = 'reports/seo/latest-recovery-proof-window.json';
export const DEFAULT_RECOVERY_PROOF_WINDOW_DIR = 'reports/seo/recovery-proof-windows';
export const DEFAULT_RECOVERY_PROOF_WINDOW_BASELINE_JSON_PATH = `${DEFAULT_RECOVERY_PROOF_WINDOW_DIR}/baseline.json`;
export const DEFAULT_TRAFFIC_REPORT_JSON_PATH = 'reports/gsc/latest-ctr-report.json';
export const DEFAULT_TRAFFIC_REPORT_MD_PATH = 'reports/gsc/latest-ctr-report.md';
export const DEFAULT_COVERAGE_DRILLDOWN_JSON_PATH = 'reports/seo/latest-coverage-drilldown.json';
export const DEFAULT_COVERAGE_DRILLDOWN_MD_PATH = 'reports/seo/latest-coverage-drilldown.md';
export const DEFAULT_RECOVERY_SCORECARD_JSON_PATH = 'reports/seo/latest-recovery-scorecard.json';
export const DEFAULT_RECOVERY_SCORECARD_MD_PATH = 'reports/seo/latest-recovery-scorecard.md';
export const DEFAULT_RECOVERY_CONTROL_BOARD_JSON_PATH = 'reports/seo/latest-recovery-control-board.json';
export const DEFAULT_RECOVERY_CONTROL_BOARD_MD_PATH = 'reports/seo/latest-recovery-control-board.md';
export const DEFAULT_RECOVERY_EXECUTION_QUEUE_JSON_PATH = 'reports/seo/latest-recovery-execution-queue.json';
export const DEFAULT_RECOVERY_EXECUTION_QUEUE_MD_PATH = 'reports/seo/latest-recovery-execution-queue.md';
export const DEFAULT_AUTHORITY_SURFACE_PROGRAM_JSON_PATH = 'reports/seo/latest-authority-surface-program.json';
export const DEFAULT_AUTHORITY_SURFACE_PROGRAM_MD_PATH = 'reports/seo/latest-authority-surface-program.md';

export type RecoveryProofVerdict = 'ready' | 'warning' | 'blocking';
export type RecoveryProofTrend = 'better' | 'flat' | 'worse' | 'unknown';

export type RecoveryProofWindowMetrics = {
  trafficQueryRows: number | null;
  trafficPageRows: number | null;
  coverageAffectedPages: number | null;
  coverageSourceAgeDays: number | null;
  executionReadyCount: number | null;
  executionBlockedCount: number | null;
  authorityPrimarySurfaces: number | null;
  authorityEditorialQueueItems: number | null;
};

export type RecoveryProofWindowComparison = {
  id: keyof RecoveryProofWindowMetrics;
  label: string;
  current: number | null;
  baseline: number | null;
  delta: number | null;
  preferredDirection: 'higher' | 'lower';
  trend: RecoveryProofTrend;
};

export type RecoveryProofWindowReport = {
  generatedAt: string;
  snapshotDate: string;
  snapshotDirectory: string;
  baselinePath: string;
  baselineLabel: string;
  baselineDate: string | null;
  baselineSeeded: boolean;
  trustVerdict: RecoveryProofVerdict;
  headline: string;
  metrics: RecoveryProofWindowMetrics;
  comparisons: RecoveryProofWindowComparison[];
  blockers: string[];
  nextActions: string[];
  sourceSummary: {
    trafficStatus: string | null;
    trafficSourceMode: string | null;
    trafficPeriod: { start: string; end: string } | null;
    coverageFreshnessStatus: string | null;
    coverageSourceDate: string | null;
    coverageSourceAgeDays: number | null;
    technicalRecoveryStatus: string | null;
    businessRecoveryStatus: string | null;
    controlBoardStatus: string | null;
    executionQueueStatus: string | null;
    authorityPrimarySurfaces: number | null;
    authorityEditorialQueueItems: number | null;
  };
  snapshotArtifacts: string[];
};

export type RecoveryProofWindowBaseline = {
  seededAt: string;
  label: string;
  milestone: string;
  metrics: RecoveryProofWindowMetrics;
};

type TrafficReportJson = {
  generatedAt?: string;
  status?: string | null;
  sourceMode?: string | null;
  currentPeriod?: { start: string; end: string } | null;
  queryRows?: number | null;
  pageRows?: number | null;
};

type CoverageDrilldownJson = {
  generatedAt?: string;
  totalAffectedPages?: number | null;
  sourceFreshnessStatus?: string | null;
  sourceFreshnessDate?: string | null;
  sourceFreshnessDays?: number | null;
};

type RecoveryScorecardJson = {
  generatedAt?: string;
  overallStatus?: string | null;
  technicalRecoveryStatus?: string | null;
  businessRecoveryStatus?: string | null;
};

type RecoveryControlBoardJson = {
  generatedAt?: string;
  overallStatus?: string | null;
};

type RecoveryExecutionQueueJson = {
  generatedAt?: string;
  overallStatus?: string | null;
  readyCount?: number | null;
  blockedCount?: number | null;
};

type AuthoritySurfaceProgramJson = {
  generatedAt?: string;
  summary?: {
    primarySurfaces?: number | null;
    editorialQueueItems?: number | null;
  } | null;
};

type RecoveryProofWindowFileOptions = {
  proofWindowDir?: string;
  baselineJsonPath?: string;
  trafficJsonPath?: string;
  coverageJsonPath?: string;
  scorecardJsonPath?: string;
  controlBoardJsonPath?: string;
  executionQueueJsonPath?: string;
  authorityJsonPath?: string;
};

type RecoveryProofWindowWriteOptions = {
  markdownOutputPath?: string;
  jsonOutputPath?: string;
  proofWindowDir?: string;
  baselineJsonPath?: string;
};

function toAbsolutePath(path: string): string {
  return resolve(process.cwd(), path);
}

function readJsonFile<T>(path: string): T | null {
  const absolutePath = toAbsolutePath(path);
  if (!existsSync(absolutePath)) return null;
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as T;
}

function normalizeStatus(value: string | null | undefined): RecoveryProofVerdict {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'clear' || normalized === 'ready' || normalized === 'active' || normalized === 'fresh') {
    return 'ready';
  }
  if (normalized === 'warning' || normalized === 'recoverable') return 'warning';
  return 'blocking';
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function snapshotDateFrom(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'unknown-date';
  }
  return date.toISOString().slice(0, 10);
}

function buildMetrics(input: {
  traffic: TrafficReportJson | null;
  coverage: CoverageDrilldownJson | null;
  executionQueue: RecoveryExecutionQueueJson | null;
  authority: AuthoritySurfaceProgramJson | null;
}): RecoveryProofWindowMetrics {
  return {
    trafficQueryRows: input.traffic?.queryRows ?? null,
    trafficPageRows: input.traffic?.pageRows ?? null,
    coverageAffectedPages: input.coverage?.totalAffectedPages ?? null,
    coverageSourceAgeDays: input.coverage?.sourceFreshnessDays ?? null,
    executionReadyCount: input.executionQueue?.readyCount ?? null,
    executionBlockedCount: input.executionQueue?.blockedCount ?? null,
    authorityPrimarySurfaces: input.authority?.summary?.primarySurfaces ?? null,
    authorityEditorialQueueItems: input.authority?.summary?.editorialQueueItems ?? null,
  };
}

function buildComparison(
  id: keyof RecoveryProofWindowMetrics,
  label: string,
  preferredDirection: 'higher' | 'lower',
  current: number | null,
  baseline: number | null,
): RecoveryProofWindowComparison {
  if (current === null || baseline === null) {
    return { id, label, current, baseline, delta: null, preferredDirection, trend: 'unknown' };
  }

  const delta = current - baseline;
  let trend: RecoveryProofTrend = 'flat';
  if (delta !== 0) {
    if (preferredDirection === 'higher') {
      trend = delta > 0 ? 'better' : 'worse';
    } else {
      trend = delta < 0 ? 'better' : 'worse';
    }
  }

  return { id, label, current, baseline, delta, preferredDirection, trend };
}

export function buildRecoveryProofWindowReport(options: {
  generatedAt?: string;
  trafficReport?: TrafficReportJson | null;
  coverageReport?: CoverageDrilldownJson | null;
  scorecardReport?: RecoveryScorecardJson | null;
  controlBoardReport?: RecoveryControlBoardJson | null;
  executionQueueReport?: RecoveryExecutionQueueJson | null;
  authorityProgramReport?: AuthoritySurfaceProgramJson | null;
  baseline?: RecoveryProofWindowBaseline | null;
}): RecoveryProofWindowReport {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const snapshotDate = snapshotDateFrom(generatedAt);
  const metrics = buildMetrics({
    traffic: options.trafficReport || null,
    coverage: options.coverageReport || null,
    executionQueue: options.executionQueueReport || null,
    authority: options.authorityProgramReport || null,
  });

  const baseline = options.baseline || {
    seededAt: generatedAt,
    label: 'Seeded from v1.5 closeout-aligned latest artifacts',
    milestone: 'v1.5',
    metrics,
  };

  const comparisons: RecoveryProofWindowComparison[] = [
    buildComparison('trafficQueryRows', 'Traffic query rows', 'higher', metrics.trafficQueryRows, baseline.metrics.trafficQueryRows),
    buildComparison('trafficPageRows', 'Traffic page rows', 'higher', metrics.trafficPageRows, baseline.metrics.trafficPageRows),
    buildComparison(
      'coverageAffectedPages',
      'Coverage affected pages',
      'lower',
      metrics.coverageAffectedPages,
      baseline.metrics.coverageAffectedPages,
    ),
    buildComparison(
      'coverageSourceAgeDays',
      'Coverage source age (days)',
      'lower',
      metrics.coverageSourceAgeDays,
      baseline.metrics.coverageSourceAgeDays,
    ),
    buildComparison(
      'executionReadyCount',
      'Execution queue ready items',
      'higher',
      metrics.executionReadyCount,
      baseline.metrics.executionReadyCount,
    ),
    buildComparison(
      'executionBlockedCount',
      'Execution queue blocked items',
      'lower',
      metrics.executionBlockedCount,
      baseline.metrics.executionBlockedCount,
    ),
    buildComparison(
      'authorityPrimarySurfaces',
      'Primary authority surfaces',
      'higher',
      metrics.authorityPrimarySurfaces,
      baseline.metrics.authorityPrimarySurfaces,
    ),
    buildComparison(
      'authorityEditorialQueueItems',
      'Authority editorial queue items',
      'lower',
      metrics.authorityEditorialQueueItems,
      baseline.metrics.authorityEditorialQueueItems,
    ),
  ];

  const blockers: string[] = [];
  const trafficVerdict = normalizeStatus(options.trafficReport?.status);
  const coverageVerdict = normalizeStatus(options.coverageReport?.sourceFreshnessStatus);
  const businessVerdict = normalizeStatus(options.scorecardReport?.businessRecoveryStatus);

  if (trafficVerdict === 'blocking') {
    blockers.push('Search Console evidence is not fresh enough to trust the current proof window.');
  }
  if (coverageVerdict === 'blocking') {
    blockers.push('Coverage Drilldown raw inputs are still too stale for confident cluster-level proof.');
  }
  if (businessVerdict !== 'ready') {
    blockers.push('Business recovery remains unproven, so this window should not justify expansion by itself.');
  }

  let trustVerdict: RecoveryProofVerdict = 'ready';
  if (blockers.length > 0) {
    trustVerdict = blockers.some((item) => item.includes('too stale') || item.includes('not fresh enough'))
      ? 'blocking'
      : 'warning';
  }

  const nextActions = dedupeStrings([
    options.baseline ? '' : 'Treat this run as the seeded baseline for post-governance recovery comparisons.',
    coverageVerdict === 'blocking'
      ? 'Import a fresher Coverage Drilldown raw export before trusting cluster-level delta attribution.'
      : '',
    trafficVerdict !== 'ready'
      ? 'Refresh Search Console evidence before using this proof window for demand decisions.'
      : '',
    businessVerdict !== 'ready'
      ? 'Collect another comparable proof window before approving authority-surface expansion.'
      : 'Proceed to cohort attribution only if the next window remains trustworthy.',
  ]);

  const betterCount = comparisons.filter((item) => item.trend === 'better').length;
  const worseCount = comparisons.filter((item) => item.trend === 'worse').length;
  const headline = options.baseline
    ? `Post-governance proof window ${snapshotDate} compared against baseline ${snapshotDateFrom(options.baseline.seededAt)}: better=${betterCount}, worse=${worseCount}, trust=${trustVerdict}.`
    : `Post-governance proof window ${snapshotDate} seeded the baseline from v1.5-aligned latest artifacts; treat this as the first comparable window.`;

  return {
    generatedAt,
    snapshotDate,
    snapshotDirectory: `${DEFAULT_RECOVERY_PROOF_WINDOW_DIR}/${snapshotDate}`,
    baselinePath: DEFAULT_RECOVERY_PROOF_WINDOW_BASELINE_JSON_PATH,
    baselineLabel: baseline.label,
    baselineDate: baseline.seededAt,
    baselineSeeded: !options.baseline,
    trustVerdict,
    headline,
    metrics,
    comparisons,
    blockers,
    nextActions,
    sourceSummary: {
      trafficStatus: options.trafficReport?.status ?? null,
      trafficSourceMode: options.trafficReport?.sourceMode ?? null,
      trafficPeriod: options.trafficReport?.currentPeriod ?? null,
      coverageFreshnessStatus: options.coverageReport?.sourceFreshnessStatus ?? null,
      coverageSourceDate: options.coverageReport?.sourceFreshnessDate ?? null,
      coverageSourceAgeDays: options.coverageReport?.sourceFreshnessDays ?? null,
      technicalRecoveryStatus: options.scorecardReport?.technicalRecoveryStatus ?? null,
      businessRecoveryStatus: options.scorecardReport?.businessRecoveryStatus ?? null,
      controlBoardStatus: options.controlBoardReport?.overallStatus ?? null,
      executionQueueStatus: options.executionQueueReport?.overallStatus ?? null,
      authorityPrimarySurfaces: options.authorityProgramReport?.summary?.primarySurfaces ?? null,
      authorityEditorialQueueItems: options.authorityProgramReport?.summary?.editorialQueueItems ?? null,
    },
    snapshotArtifacts: [],
  };
}

export function renderRecoveryProofWindowReport(report: RecoveryProofWindowReport): string {
  return [
    '# Recovery Proof Window',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Snapshot date: ${report.snapshotDate}`,
    `- Trust verdict: ${report.trustVerdict}`,
    `- Baseline: ${report.baselineLabel} (${report.baselineDate || 'n/a'})`,
    `- Baseline seeded now: ${report.baselineSeeded ? 'yes' : 'no'}`,
    '',
    '## Headline',
    '',
    report.headline,
    '',
    '## Current Truth',
    '',
    `- Traffic status: ${report.sourceSummary.trafficStatus || 'n/a'} (${report.sourceSummary.trafficSourceMode || 'n/a'})`,
    `- Traffic period: ${report.sourceSummary.trafficPeriod ? `${report.sourceSummary.trafficPeriod.start} -> ${report.sourceSummary.trafficPeriod.end}` : 'n/a'}`,
    `- Coverage freshness: ${report.sourceSummary.coverageFreshnessStatus || 'n/a'} (${report.sourceSummary.coverageSourceDate || 'n/a'}, age=${report.sourceSummary.coverageSourceAgeDays ?? 'n/a'})`,
    `- Recovery scorecard: technical=${report.sourceSummary.technicalRecoveryStatus || 'n/a'}, business=${report.sourceSummary.businessRecoveryStatus || 'n/a'}`,
    `- Control board status: ${report.sourceSummary.controlBoardStatus || 'n/a'}`,
    `- Execution queue status: ${report.sourceSummary.executionQueueStatus || 'n/a'}`,
    `- Authority surfaces: primary=${report.sourceSummary.authorityPrimarySurfaces ?? 'n/a'}, editorial queue=${report.sourceSummary.authorityEditorialQueueItems ?? 'n/a'}`,
    '',
    '## Comparison Table',
    '',
    '| Metric | Current | Baseline | Delta | Preferred | Trend |',
    '|---|---|---|---|---|---|',
    ...report.comparisons.map((item) =>
      `| ${item.label} | ${item.current ?? 'n/a'} | ${item.baseline ?? 'n/a'} | ${item.delta ?? 'n/a'} | ${item.preferredDirection} | ${item.trend} |`,
    ),
    '',
    '## Blockers',
    '',
    ...(report.blockers.length > 0 ? report.blockers.map((item) => `- ${item}`) : ['- none']),
    '',
    '## Next Actions',
    '',
    ...(report.nextActions.length > 0 ? report.nextActions.map((item) => `- ${item}`) : ['- none']),
    '',
    '## Snapshot Artifacts',
    '',
    ...(report.snapshotArtifacts.length > 0 ? report.snapshotArtifacts.map((item) => `- ${item}`) : ['- pending write']),
    '',
  ].join('\n');
}

function writeJson(path: string, value: unknown): void {
  const absolutePath = toAbsolutePath(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function writeRecoveryProofWindowArtifacts(
  report: RecoveryProofWindowReport,
  options: RecoveryProofWindowWriteOptions = {},
): RecoveryProofWindowReport {
  const markdownOutputPath = options.markdownOutputPath || DEFAULT_RECOVERY_PROOF_WINDOW_MD_PATH;
  const jsonOutputPath = options.jsonOutputPath || DEFAULT_RECOVERY_PROOF_WINDOW_JSON_PATH;
  const proofWindowDir = options.proofWindowDir || DEFAULT_RECOVERY_PROOF_WINDOW_DIR;
  const baselineJsonPath = options.baselineJsonPath || DEFAULT_RECOVERY_PROOF_WINDOW_BASELINE_JSON_PATH;
  const snapshotDir = join(proofWindowDir, report.snapshotDate);

  const sourceArtifacts = [
    DEFAULT_TRAFFIC_REPORT_JSON_PATH,
    DEFAULT_TRAFFIC_REPORT_MD_PATH,
    DEFAULT_COVERAGE_DRILLDOWN_JSON_PATH,
    DEFAULT_COVERAGE_DRILLDOWN_MD_PATH,
    DEFAULT_RECOVERY_SCORECARD_JSON_PATH,
    DEFAULT_RECOVERY_SCORECARD_MD_PATH,
    DEFAULT_RECOVERY_CONTROL_BOARD_JSON_PATH,
    DEFAULT_RECOVERY_CONTROL_BOARD_MD_PATH,
    DEFAULT_RECOVERY_EXECUTION_QUEUE_JSON_PATH,
    DEFAULT_RECOVERY_EXECUTION_QUEUE_MD_PATH,
    DEFAULT_AUTHORITY_SURFACE_PROGRAM_JSON_PATH,
    DEFAULT_AUTHORITY_SURFACE_PROGRAM_MD_PATH,
  ];

  const copiedArtifacts: string[] = [];
  const snapshotAbsoluteDir = toAbsolutePath(snapshotDir);
  mkdirSync(snapshotAbsoluteDir, { recursive: true });

  for (const artifact of sourceArtifacts) {
    const sourceAbsolutePath = toAbsolutePath(artifact);
    if (!existsSync(sourceAbsolutePath)) continue;
    const targetPath = join(snapshotDir, basename(artifact));
    copyFileSync(sourceAbsolutePath, toAbsolutePath(targetPath));
    copiedArtifacts.push(targetPath);
  }

  const baselineAbsolutePath = toAbsolutePath(baselineJsonPath);
  if (!existsSync(baselineAbsolutePath)) {
    writeJson(baselineJsonPath, {
      seededAt: report.generatedAt,
      label: report.baselineLabel,
      milestone: 'v1.5',
      metrics: report.metrics,
    } satisfies RecoveryProofWindowBaseline);
  }

  const finalizedReport: RecoveryProofWindowReport = {
    ...report,
    snapshotDirectory: snapshotDir,
    baselinePath: baselineJsonPath,
    snapshotArtifacts: copiedArtifacts,
  };

  writeJson(jsonOutputPath, finalizedReport);
  const markdownAbsolutePath = toAbsolutePath(markdownOutputPath);
  mkdirSync(dirname(markdownAbsolutePath), { recursive: true });
  writeFileSync(markdownAbsolutePath, `${renderRecoveryProofWindowReport(finalizedReport)}\n`, 'utf8');
  writeJson(join(snapshotDir, 'proof-window.json'), finalizedReport);
  const snapshotMarkdownPath = join(snapshotDir, 'proof-window.md');
  const snapshotMarkdownAbsolutePath = toAbsolutePath(snapshotMarkdownPath);
  mkdirSync(dirname(snapshotMarkdownAbsolutePath), { recursive: true });
  writeFileSync(snapshotMarkdownAbsolutePath, `${renderRecoveryProofWindowReport(finalizedReport)}\n`, 'utf8');

  return finalizedReport;
}

export function buildRecoveryProofWindowFromFiles(
  options: RecoveryProofWindowFileOptions = {},
): RecoveryProofWindowReport {
  const baseline = readJsonFile<RecoveryProofWindowBaseline>(
    options.baselineJsonPath || DEFAULT_RECOVERY_PROOF_WINDOW_BASELINE_JSON_PATH,
  );

  return buildRecoveryProofWindowReport({
    trafficReport: readJsonFile<TrafficReportJson>(options.trafficJsonPath || DEFAULT_TRAFFIC_REPORT_JSON_PATH),
    coverageReport: readJsonFile<CoverageDrilldownJson>(options.coverageJsonPath || DEFAULT_COVERAGE_DRILLDOWN_JSON_PATH),
    scorecardReport: readJsonFile<RecoveryScorecardJson>(options.scorecardJsonPath || DEFAULT_RECOVERY_SCORECARD_JSON_PATH),
    controlBoardReport: readJsonFile<RecoveryControlBoardJson>(
      options.controlBoardJsonPath || DEFAULT_RECOVERY_CONTROL_BOARD_JSON_PATH,
    ),
    executionQueueReport: readJsonFile<RecoveryExecutionQueueJson>(
      options.executionQueueJsonPath || DEFAULT_RECOVERY_EXECUTION_QUEUE_JSON_PATH,
    ),
    authorityProgramReport: readJsonFile<AuthoritySurfaceProgramJson>(
      options.authorityJsonPath || DEFAULT_AUTHORITY_SURFACE_PROGRAM_JSON_PATH,
    ),
    baseline,
  });
}
