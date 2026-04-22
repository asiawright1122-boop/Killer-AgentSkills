import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  compareGscSnapshots,
  findCtrOpportunities,
  findQueryPrecisionRisks,
  formatPercent,
  parseGscCsv,
  type GscRow,
} from '../../src/lib/gsc-report';

export const DEFAULT_RECOVERY_CONTROL_BOARD_MD_PATH = 'reports/seo/latest-recovery-control-board.md';
export const DEFAULT_RECOVERY_CONTROL_BOARD_JSON_PATH = 'reports/seo/latest-recovery-control-board.json';
export const DEFAULT_RECOVERY_SCORECARD_JSON_PATH = 'reports/seo/latest-recovery-scorecard.json';
export const DEFAULT_COVERAGE_DRILLDOWN_JSON_PATH = 'reports/seo/latest-coverage-drilldown.json';
export const DEFAULT_TRAFFIC_REPORT_JSON_PATH = 'reports/gsc/latest-ctr-report.json';

export type ControlBoardStatus = 'blocked' | 'recoverable' | 'recovered' | 'unknown';
export type ControlLens = 'query' | 'page' | 'locale' | 'cluster';

export type RecoveryControlLensSummary = {
  lens: ControlLens;
  status: ControlBoardStatus;
  summary: string;
  evidence: string[];
};

export type RecoveryControlItem = {
  id: string;
  lens: ControlLens;
  status: ControlBoardStatus;
  score: number;
  title: string;
  summary: string;
  evidence: string[];
  actions: string[];
};

export type RecoveryControlBoardReport = {
  generatedAt: string;
  overallStatus: ControlBoardStatus;
  technicalRecoveryStatus: string | null;
  businessRecoveryStatus: string | null;
  trafficSourceMode: string | null;
  headline: string;
  lenses: RecoveryControlLensSummary[];
  items: RecoveryControlItem[];
  nextActions: string[];
};

type RecoveryScorecardJson = {
  generatedAt?: string;
  technicalRecoveryStatus?: string;
  businessRecoveryStatus?: string;
  headline?: string;
  nextActions?: string[];
  coverage?: {
    status?: string;
  };
  traffic?: {
    status?: string;
    summary?: string;
    metrics?: {
      sourceMode?: string | null;
      failureReason?: string | null;
      nextStep?: string | null;
    };
  };
};

type CoverageCluster = {
  cluster?: string;
  sampleCount?: number;
  estimatedAffected?: number;
  weightedImpact?: number;
  issueNames?: string[];
  topSamples?: string[];
};

type CoverageDrilldownJson = {
  generatedAt?: string;
  sourceFreshnessStatus?: string | null;
  sourceFreshnessDate?: string | null;
  sourceFreshnessSummary?: string | null;
  clusterPriorities?: CoverageCluster[];
};

type TrafficReportJson = {
  generatedAt?: string;
  status?: string | null;
  sourceMode?: string | null;
  site?: string | null;
  currentPeriod?: { start: string; end: string } | null;
  previousPeriod?: { start: string; end: string } | null;
  failureReason?: string | null;
  nextStep?: string | null;
};

type RecoveryControlBoardFileOptions = {
  scorecardJsonPath?: string;
  coverageJsonPath?: string;
  trafficJsonPath?: string;
};

type TrafficSnapshots = {
  currentQueries: GscRow[];
  previousQueries: GscRow[];
  currentPages: GscRow[];
  previousPages: GscRow[];
};

function toAbsolutePath(path: string): string {
  return resolve(process.cwd(), path);
}

function readJsonFile<T>(path: string): T | null {
  const absolutePath = toAbsolutePath(path);
  if (!existsSync(absolutePath)) return null;
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as T;
}

function readTextFile(path: string): string | null {
  const absolutePath = toAbsolutePath(path);
  if (!existsSync(absolutePath)) return null;
  return readFileSync(absolutePath, 'utf8');
}

function normalizeStatus(value: string | null | undefined): ControlBoardStatus {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'blocked' || normalized === 'blocking') return 'blocked';
  if (normalized === 'recoverable' || normalized === 'warning') return 'recoverable';
  if (normalized === 'recovered' || normalized === 'clear') return 'recovered';
  return 'unknown';
}

function statusPriority(status: ControlBoardStatus): number {
  switch (status) {
    case 'blocked':
      return 4;
    case 'recoverable':
      return 3;
    case 'recovered':
      return 2;
    default:
      return 1;
  }
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function combineStatuses(items: ControlBoardStatus[]): ControlBoardStatus {
  return items.reduce<ControlBoardStatus>((current, next) => {
    return statusPriority(next) > statusPriority(current) ? next : current;
  }, 'unknown');
}

function formatInteger(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-US').format(value || 0);
}

function parseLocaleFromEntity(entity: string): string | null {
  try {
    const parsed =
      entity.startsWith('http://') || entity.startsWith('https://')
        ? new URL(entity)
        : new URL(entity, 'https://killer-skills.com');
    const firstSegment = parsed.pathname.split('/').filter(Boolean)[0] || '';
    return /^[a-z]{2}$/i.test(firstSegment) ? firstSegment.toLowerCase() : null;
  } catch {
    return null;
  }
}

function aggregatePageRowsByLocale(rows: GscRow[]): GscRow[] {
  const localeMap = new Map<
    string,
    {
      clicks: number;
      impressions: number;
      weightedPosition: number;
      positionWeight: number;
    }
  >();

  for (const row of rows) {
    const locale = parseLocaleFromEntity(row.entity);
    if (!locale) continue;

    const current = localeMap.get(locale) || {
      clicks: 0,
      impressions: 0,
      weightedPosition: 0,
      positionWeight: 0,
    };

    const weight = Math.max(row.impressions, 1);
    current.clicks += row.clicks;
    current.impressions += row.impressions;
    current.weightedPosition += row.position * weight;
    current.positionWeight += weight;
    localeMap.set(locale, current);
  }

  return Array.from(localeMap.entries()).map(([locale, stats]) => ({
    entity: locale,
    clicks: stats.clicks,
    impressions: stats.impressions,
    ctr: stats.impressions > 0 ? stats.clicks / stats.impressions : 0,
    position: stats.positionWeight > 0 ? stats.weightedPosition / stats.positionWeight : 0,
  }));
}

function formatActions(actions: string[]): string[] {
  return dedupeStrings(actions).slice(0, 4);
}

function buildMeasurementGapItems(
  lens: Exclude<ControlLens, 'cluster'>,
  reason: string,
  nextStep: string | null,
): RecoveryControlItem[] {
  const titlePrefix =
    lens === 'query'
      ? 'Query diagnosis blocked'
      : lens === 'page'
        ? 'Page diagnosis blocked'
        : 'Locale diagnosis blocked';
  const action = nextStep || 'Restore Search Console evidence before ranking this lens.';

  return [
    {
      id: `${lens}-measurement-gap`,
      lens,
      status: 'blocked',
      score: 10000,
      title: titlePrefix,
      summary: reason,
      evidence: [reason],
      actions: [action],
    },
  ];
}

function comparisonDeclines<
  T extends { entity: string; score: number; status: string; deltaClicks: number; deltaCtr: number },
>(rows: T[]): T[] {
  return rows.filter((row) => row.status === 'declined' || row.deltaClicks < 0 || row.deltaCtr < 0).slice(0, 5);
}

function buildQueryItems(snapshots: TrafficSnapshots): RecoveryControlItem[] {
  const opportunities = findCtrOpportunities(snapshots.currentQueries, 'query', 5);
  const declines = comparisonDeclines(compareGscSnapshots(snapshots.currentQueries, snapshots.previousQueries, 6));
  const precisionRisks = findQueryPrecisionRisks(snapshots.currentQueries, 4);

  const opportunityItems = opportunities.map<RecoveryControlItem>((item) => ({
    id: `query-opportunity-${item.entity}`,
    lens: 'query',
    status: 'recoverable',
    score: item.score,
    title: `Query opportunity: ${item.entity}`,
    summary: `${formatInteger(item.impressions)} impressions at ${formatPercent(item.ctr)} CTR with position ${item.position.toFixed(1)} still leaves a ${formatPercent(item.gap)} CTR gap.`,
    evidence: [`Clicks ${item.clicks}`, `Expected CTR ${formatPercent(item.expectedCtr)}`],
    actions: formatActions(item.actions),
  }));

  const declineItems = declines.map<RecoveryControlItem>((item) => ({
    id: `query-decline-${item.entity}`,
    lens: 'query',
    status: 'recoverable',
    score: item.score,
    title: `Query slipped: ${item.entity}`,
    summary: `Clicks ${item.deltaClicks >= 0 ? '+' : ''}${item.deltaClicks}, impressions ${item.deltaImpressions >= 0 ? '+' : ''}${item.deltaImpressions}, CTR ${item.deltaCtr >= 0 ? '+' : ''}${formatPercent(item.deltaCtr)}.`,
    evidence: [
      `Current ${formatPercent(item.current.ctr)} CTR`,
      `Previous ${item.previous ? formatPercent(item.previous.ctr) : 'n/a'} CTR`,
    ],
    actions: [
      'Check whether title/snippet intent drifted away from the query.',
      'Support the best-matching surface with stronger internal links.',
    ],
  }));

  const riskItems = precisionRisks.map<RecoveryControlItem>((item) => ({
    id: `query-risk-${item.entity}`,
    lens: 'query',
    status: 'recoverable',
    score: item.score,
    title: `Query precision risk: ${item.entity}`,
    summary: item.reason,
    evidence: [
      `${formatInteger(item.impressions)} impressions`,
      `${formatPercent(item.ctr)} CTR`,
      `Issue=${item.issue}`,
    ],
    actions: formatActions(item.actions),
  }));

  return [...opportunityItems, ...declineItems, ...riskItems];
}

function buildPageItems(snapshots: TrafficSnapshots): RecoveryControlItem[] {
  const opportunities = findCtrOpportunities(snapshots.currentPages, 'page', 5);
  const declines = comparisonDeclines(compareGscSnapshots(snapshots.currentPages, snapshots.previousPages, 6));

  return [
    ...opportunities.map<RecoveryControlItem>((item) => ({
      id: `page-opportunity-${item.entity}`,
      lens: 'page',
      status: 'recoverable',
      score: item.score,
      title: `Page opportunity: ${item.entity}`,
      summary: `${formatInteger(item.impressions)} impressions at ${formatPercent(item.ctr)} CTR suggest recoverable page-level demand.`,
      evidence: [`Position ${item.position.toFixed(1)}`, `CTR gap ${formatPercent(item.gap)}`],
      actions: formatActions(item.actions),
    })),
    ...declines.map<RecoveryControlItem>((item) => ({
      id: `page-decline-${item.entity}`,
      lens: 'page',
      status: 'recoverable',
      score: item.score,
      title: `Page slipped: ${item.entity}`,
      summary: `Clicks ${item.deltaClicks >= 0 ? '+' : ''}${item.deltaClicks}, CTR ${item.deltaCtr >= 0 ? '+' : ''}${formatPercent(item.deltaCtr)}, position delta ${item.deltaPosition >= 0 ? '+' : ''}${item.deltaPosition.toFixed(1)}.`,
      evidence: [
        `Current impressions ${formatInteger(item.current.impressions)}`,
        `Current CTR ${formatPercent(item.current.ctr)}`,
      ],
      actions: [
        'Tighten title/meta alignment with the leading query cluster.',
        'Check whether internal links and H1 still reinforce the same intent.',
      ],
    })),
  ];
}

function buildLocaleItems(snapshots: TrafficSnapshots): RecoveryControlItem[] {
  const currentLocales = aggregatePageRowsByLocale(snapshots.currentPages);
  const previousLocales = aggregatePageRowsByLocale(snapshots.previousPages);
  const comparisons = compareGscSnapshots(currentLocales, previousLocales, 10);
  const declines = comparisonDeclines(comparisons);

  return declines.map<RecoveryControlItem>((item) => ({
    id: `locale-decline-${item.entity}`,
    lens: 'locale',
    status: 'recoverable',
    score: item.score,
    title: `Locale suppression: ${item.entity}`,
    summary: `Locale ${item.entity} shows clicks ${item.deltaClicks >= 0 ? '+' : ''}${item.deltaClicks} and CTR ${item.deltaCtr >= 0 ? '+' : ''}${formatPercent(item.deltaCtr)} versus the previous period.`,
    evidence: [
      `Current clicks ${formatInteger(item.current.clicks)}`,
      `Current impressions ${formatInteger(item.current.impressions)}`,
    ],
    actions: [
      'Inspect whether the locale still has enough eligible pages and clean internal links.',
      'Check whether locale-specific titles and summaries still match dominant demand.',
    ],
  }));
}

function coverageClusterStatus(
  cluster: CoverageCluster,
  coverageFreshnessStatus: string | null | undefined,
  technicalRecoveryStatus: string | null | undefined,
): ControlBoardStatus {
  const clusterId = String(cluster.cluster || '')
    .trim()
    .toLowerCase();
  const issueText = (cluster.issueNames || []).join(' ').toLowerCase();
  if (coverageFreshnessStatus === 'blocking') return 'blocked';
  if (clusterId === 'other' && String(technicalRecoveryStatus || '').trim().toLowerCase() === 'clear') {
    return 'recoverable';
  }
  if (clusterId === 'trailing_slash' || clusterId === 'query_parameter' || clusterId === 'repeated_segment') {
    return 'recoverable';
  }
  if (/5xx|1102|server/.test(issueText)) return 'blocked';
  return 'recoverable';
}

function coverageClusterAction(clusterId: string): string {
  if (clusterId === 'other') {
    return 'Execute the missing-cluster split: keep known trap URLs at 410, validate middleware-covered repo-root redirects, and avoid restoring pages without a public content target.';
  }
  if (clusterId === 'trailing_slash') {
    return 'Keep trailing-slash canonicalization at the edge and clean any internal links still ending with `/`.';
  }
  if (clusterId === 'query_parameter') {
    return 'Keep search URLs canonicalized to `q` and enforce `noindex` on parameterized listing pages.';
  }
  if (clusterId === 'repeated_segment') {
    return 'Keep repeated owner/repo traps in the 410 ruleset and verify the set after each coverage export.';
  }
  return `Review the ${clusterId || 'unknown'} cluster against the freshest available raw Coverage Drilldown export.`;
}

function buildClusterItems(
  coverage: CoverageDrilldownJson,
  technicalRecoveryStatus: string | null | undefined,
): RecoveryControlItem[] {
  return (coverage.clusterPriorities || []).slice(0, 6).map<RecoveryControlItem>((cluster) => ({
    id: `cluster-${cluster.cluster || 'unknown'}`,
    lens: 'cluster',
    status: coverageClusterStatus(cluster, coverage.sourceFreshnessStatus, technicalRecoveryStatus),
    score: Number(cluster.weightedImpact || 0),
    title: `Issue cluster: ${cluster.cluster || 'unknown'}`,
    summary: `Estimated affected pages ${formatInteger(Math.round(cluster.estimatedAffected || 0))} with weighted impact ${formatInteger(Math.round(cluster.weightedImpact || 0))}.`,
    evidence: [...(cluster.issueNames || []).slice(0, 2), ...(cluster.topSamples || []).slice(0, 2)],
    actions: [coverageClusterAction(String(cluster.cluster || '').trim().toLowerCase())],
  }));
}

function buildLensSummaries(
  scorecard: RecoveryScorecardJson | null,
  traffic: TrafficReportJson | null,
  coverage: CoverageDrilldownJson | null,
  snapshots: TrafficSnapshots | null,
): RecoveryControlLensSummary[] {
  const trafficBlockedReason =
    traffic?.failureReason ||
    scorecard?.traffic?.metrics?.failureReason ||
    'Search Console evidence is not yet available.';

  return [
    {
      lens: 'query',
      status: snapshots ? 'recoverable' : 'blocked',
      summary: snapshots
        ? 'Query lens is using the latest available GSC snapshots for opportunity and decline ranking.'
        : `Query lens is blocked by missing traffic evidence: ${trafficBlockedReason}`,
      evidence: snapshots ? ['GSC query snapshots loaded.'] : [trafficBlockedReason],
    },
    {
      lens: 'page',
      status: snapshots ? 'recoverable' : 'blocked',
      summary: snapshots
        ? 'Page lens is using the latest available GSC page snapshots for recovery ranking.'
        : `Page lens is blocked by missing traffic evidence: ${trafficBlockedReason}`,
      evidence: snapshots ? ['GSC page snapshots loaded.'] : [trafficBlockedReason],
    },
    {
      lens: 'locale',
      status: snapshots ? 'recoverable' : 'blocked',
      summary: snapshots
        ? 'Locale lens is aggregated from page snapshots so locale-level suppression can be ranked.'
        : `Locale lens is blocked by missing traffic evidence: ${trafficBlockedReason}`,
      evidence: snapshots ? ['Locale aggregation derived from GSC page snapshots.'] : [trafficBlockedReason],
    },
    {
      lens: 'cluster',
      status: normalizeStatus(coverage?.sourceFreshnessStatus || scorecard?.coverage?.status),
      summary:
        coverage?.sourceFreshnessSummary ||
        'Issue-cluster lens is sourced from the latest Coverage Drilldown artifact.',
      evidence: [
        coverage?.sourceFreshnessDate
          ? `Freshest raw export ${coverage.sourceFreshnessDate}`
          : 'No source date detected.',
      ],
    },
  ];
}

function resolveSnapshotPaths(
  trafficJsonPath: string,
  traffic: TrafficReportJson | null,
): {
  currentQueriesPath: string | null;
  previousQueriesPath: string | null;
  currentPagesPath: string | null;
  previousPagesPath: string | null;
} {
  if (!traffic?.currentPeriod || !traffic?.previousPeriod) {
    return {
      currentQueriesPath: null,
      previousQueriesPath: null,
      currentPagesPath: null,
      previousPagesPath: null,
    };
  }

  const outputDir = resolve(toAbsolutePath(trafficJsonPath), '..');
  const snapshotDir = resolve(outputDir, 'snapshots');
  const currentRangeLabel = `${traffic.currentPeriod.start}-to-${traffic.currentPeriod.end}`;
  const previousRangeLabel = `${traffic.previousPeriod.start}-to-${traffic.previousPeriod.end}`;

  return {
    currentQueriesPath: resolve(snapshotDir, `${currentRangeLabel}-queries.csv`),
    previousQueriesPath: resolve(snapshotDir, `${previousRangeLabel}-queries.csv`),
    currentPagesPath: resolve(snapshotDir, `${currentRangeLabel}-pages.csv`),
    previousPagesPath: resolve(snapshotDir, `${previousRangeLabel}-pages.csv`),
  };
}

function loadTrafficSnapshots(trafficJsonPath: string, traffic: TrafficReportJson | null): TrafficSnapshots | null {
  if (!traffic || normalizeStatus(traffic.status) === 'blocked') return null;

  const paths = resolveSnapshotPaths(trafficJsonPath, traffic);
  if (!paths.currentQueriesPath || !paths.previousQueriesPath || !paths.currentPagesPath || !paths.previousPagesPath) {
    return null;
  }

  const currentQueriesCsv = readTextFile(paths.currentQueriesPath);
  const previousQueriesCsv = readTextFile(paths.previousQueriesPath);
  const currentPagesCsv = readTextFile(paths.currentPagesPath);
  const previousPagesCsv = readTextFile(paths.previousPagesPath);

  if (!currentQueriesCsv || !previousQueriesCsv || !currentPagesCsv || !previousPagesCsv) {
    return null;
  }

  return {
    currentQueries: parseGscCsv(currentQueriesCsv),
    previousQueries: parseGscCsv(previousQueriesCsv),
    currentPages: parseGscCsv(currentPagesCsv),
    previousPages: parseGscCsv(previousPagesCsv),
  };
}

export function buildRecoveryControlBoardReport(input: {
  scorecard?: RecoveryScorecardJson | null;
  coverage?: CoverageDrilldownJson | null;
  traffic?: TrafficReportJson | null;
  snapshots?: TrafficSnapshots | null;
}): RecoveryControlBoardReport {
  const scorecard = input.scorecard || null;
  const coverage = input.coverage || null;
  const traffic = input.traffic || null;
  const snapshots = input.snapshots || null;

  const trafficReason =
    traffic?.failureReason || scorecard?.traffic?.metrics?.failureReason || 'Search Console evidence is still missing.';
  const trafficNextStep =
    traffic?.nextStep ||
    scorecard?.traffic?.metrics?.nextStep ||
    'Restore Search Console evidence before ranking traffic surfaces.';
  const technicalRecoveryStatus = scorecard?.technicalRecoveryStatus || null;

  const items: RecoveryControlItem[] = [
    ...buildClusterItems(coverage || {}, technicalRecoveryStatus),
    ...(snapshots ? buildQueryItems(snapshots) : buildMeasurementGapItems('query', trafficReason, trafficNextStep)),
    ...(snapshots ? buildPageItems(snapshots) : buildMeasurementGapItems('page', trafficReason, trafficNextStep)),
    ...(snapshots ? buildLocaleItems(snapshots) : buildMeasurementGapItems('locale', trafficReason, trafficNextStep)),
  ].sort((a, b) => {
    const statusDelta = statusPriority(b.status) - statusPriority(a.status);
    if (statusDelta !== 0) return statusDelta;
    return b.score - a.score;
  });

  const lenses = buildLensSummaries(scorecard, traffic, coverage, snapshots);
  const overallStatus = combineStatuses([
    ...lenses.map((lens) => lens.status),
    ...items.slice(0, 5).map((item) => item.status),
  ]);
  const nextActions = dedupeStrings([
    ...items.slice(0, 8).flatMap((item) => item.actions),
    ...(scorecard?.nextActions || []),
  ]).slice(0, 8);

  return {
    generatedAt: new Date().toISOString(),
    overallStatus,
    technicalRecoveryStatus,
    businessRecoveryStatus: scorecard?.businessRecoveryStatus || null,
    trafficSourceMode: traffic?.sourceMode || scorecard?.traffic?.metrics?.sourceMode || null,
    headline:
      scorecard?.headline ||
      'Recovery control board summarizes blocked measurement gaps, recoverable surfaces, and already-stable evidence.',
    lenses,
    items,
    nextActions,
  };
}

export function renderRecoveryControlBoardReport(report: RecoveryControlBoardReport): string {
  const grouped = {
    blocked: report.items.filter((item) => item.status === 'blocked'),
    recoverable: report.items.filter((item) => item.status === 'recoverable'),
    recovered: report.items.filter((item) => item.status === 'recovered'),
    unknown: report.items.filter((item) => item.status === 'unknown'),
  };

  const renderItems = (title: string, items: RecoveryControlItem[]): string[] => {
    if (items.length === 0) return [`## ${title}`, '', 'No items in this bucket.', ''];

    const lines = [`## ${title}`, ''];
    for (const item of items) {
      lines.push(`1. [${item.lens}] ${item.title}`);
      lines.push(`   - Status: ${item.status}`);
      lines.push(`   - Score: ${item.score.toFixed(1)}`);
      lines.push(`   - Summary: ${item.summary}`);
      if (item.evidence.length > 0) {
        lines.push(`   - Evidence: ${item.evidence.join(' | ')}`);
      }
      for (const action of item.actions) {
        lines.push(`   - Action: ${action}`);
      }
      lines.push('');
    }
    return lines;
  };

  return [
    '# Recovery Control Board',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Overall status: ${report.overallStatus}`,
    `- Technical recovery: ${report.technicalRecoveryStatus || 'n/a'}`,
    `- Business recovery: ${report.businessRecoveryStatus || 'n/a'}`,
    `- Traffic source mode: ${report.trafficSourceMode || 'n/a'}`,
    '',
    '## Headline',
    '',
    report.headline,
    '',
    '## Lens Readiness',
    '',
    ...report.lenses.map(
      (lens) => `- ${lens.lens}: ${lens.status} | ${lens.summary} | Evidence: ${lens.evidence.join(' | ')}`,
    ),
    '',
    ...renderItems('Blocked Surfaces', grouped.blocked),
    ...renderItems('Recoverable Surfaces', grouped.recoverable),
    ...renderItems('Recovered / Stable Surfaces', grouped.recovered),
    ...renderItems('Unknown Surfaces', grouped.unknown),
    '## Next Actions',
    '',
    ...(report.nextActions.length > 0
      ? report.nextActions.map((action, index) => `${index + 1}. ${action}`)
      : ['1. No follow-up actions.']),
    '',
  ].join('\n');
}

export function writeRecoveryControlBoardArtifacts(
  report: RecoveryControlBoardReport,
  options: {
    markdownOutputPath?: string;
    jsonOutputPath?: string;
  } = {},
): void {
  const markdownOutputPath = options.markdownOutputPath || DEFAULT_RECOVERY_CONTROL_BOARD_MD_PATH;
  const jsonOutputPath = options.jsonOutputPath || DEFAULT_RECOVERY_CONTROL_BOARD_JSON_PATH;

  const markdownAbsolutePath = toAbsolutePath(markdownOutputPath);
  const jsonAbsolutePath = toAbsolutePath(jsonOutputPath);

  mkdirSync(dirname(markdownAbsolutePath), { recursive: true });
  mkdirSync(dirname(jsonAbsolutePath), { recursive: true });

  writeFileSync(markdownAbsolutePath, renderRecoveryControlBoardReport(report), 'utf8');
  writeFileSync(jsonAbsolutePath, JSON.stringify(report, null, 2), 'utf8');
}

export function buildRecoveryControlBoardFromFiles(
  options: RecoveryControlBoardFileOptions = {},
): RecoveryControlBoardReport {
  const scorecardJsonPath = options.scorecardJsonPath || DEFAULT_RECOVERY_SCORECARD_JSON_PATH;
  const coverageJsonPath = options.coverageJsonPath || DEFAULT_COVERAGE_DRILLDOWN_JSON_PATH;
  const trafficJsonPath = options.trafficJsonPath || DEFAULT_TRAFFIC_REPORT_JSON_PATH;

  const scorecard = readJsonFile<RecoveryScorecardJson>(scorecardJsonPath);
  const coverage = readJsonFile<CoverageDrilldownJson>(coverageJsonPath);
  const traffic = readJsonFile<TrafficReportJson>(trafficJsonPath);
  const snapshots = loadTrafficSnapshots(trafficJsonPath, traffic);

  return buildRecoveryControlBoardReport({
    scorecard,
    coverage,
    traffic,
    snapshots,
  });
}
