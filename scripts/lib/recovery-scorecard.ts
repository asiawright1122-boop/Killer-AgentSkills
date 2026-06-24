import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const DEFAULT_RECOVERY_SCORECARD_MD_PATH = 'reports/seo/latest-recovery-scorecard.md';
export const DEFAULT_RECOVERY_SCORECARD_JSON_PATH = 'reports/seo/latest-recovery-scorecard.json';
export const DEFAULT_CRAWL_HEALTH_JSON_PATH = 'reports/seo/latest-crawl-health.json';
export const DEFAULT_COVERAGE_DRILLDOWN_JSON_PATH = 'reports/seo/latest-coverage-drilldown.json';
export const DEFAULT_INDEX_DRIFT_JSON_PATH = 'reports/seo/index-drift.json';
export const DEFAULT_TRAFFIC_REPORT_MD_PATH = 'reports/gsc/latest-ctr-report.md';
export const DEFAULT_TRAFFIC_MONITORING_SKIPPED_MD_PATH = 'reports/gsc/monitoring-skipped.md';
export const DEFAULT_AI_PROVIDER_HEALTH_JSON_PATH = 'reports/seo/latest-ai-provider-health.json';
export const DEFAULT_INDEXABILITY_JSON_PATH = 'reports/seo/latest-skill-indexability.json';
export const DEFAULT_LOCALE_GOVERNANCE_JSON_PATH = 'reports/seo/latest-skill-locale-governance.json';

const DAY_MS = 24 * 60 * 60 * 1000;
const CRAWL_STALE_AFTER_DAYS = 7;
const COVERAGE_REPORT_STALE_AFTER_DAYS = 7;
const COVERAGE_SOURCE_WARNING_AFTER_DAYS = 3;
const COVERAGE_SOURCE_MAX_AFTER_DAYS = 7;
const INDEX_STALE_AFTER_DAYS = 7;
const TRAFFIC_STALE_AFTER_DAYS = 7;
const AI_STALE_AFTER_DAYS = 7;
const CRAWL_HARD_FAIL_FLAKY_5XX_MIN = 5;
const CRAWL_HARD_FAIL_FLAKY_5XX_RATE = 0.02;
const numberFormatter = new Intl.NumberFormat('en-US');

export type RecoverySignalStatus = 'clear' | 'warning' | 'blocking' | 'unknown';
export type RecoveryFreshness = 'fresh' | 'stale' | 'missing' | 'unknown';

export type RecoverySourceState = {
  path: string;
  exists: boolean;
  generatedAt: string | null;
  ageDays: number | null;
  freshness: RecoveryFreshness;
};

export type RecoveryGate = {
  id: string;
  label: string;
  status: RecoverySignalStatus;
  target: string;
  observed: string;
  notes: string[];
};

export type RecoverySignal<TMetrics = Record<string, unknown>> = {
  label: string;
  status: RecoverySignalStatus;
  summary: string;
  target: string;
  observed: string;
  notes: string[];
  source: RecoverySourceState;
  metrics: TMetrics;
};

type CrawlHealthJsonReport = {
  generatedAt?: string;
  totals?: {
    sitemapFilesDiscovered?: number;
    pageUrlsDiscovered?: number;
    pageUrlsChecked?: number;
  };
  statusSummary?: {
    status2xx?: number;
    status3xx?: number;
    status4xx?: number;
    status5xx?: number;
    statusOther?: number;
  };
  cloudflare1102?: unknown[];
  flakyRecovered?: unknown[];
  sitemapErrors?: unknown[];
};

type CoverageCluster = {
  cluster?: string;
  sampleCount?: number;
  estimatedAffected?: number;
  weightedImpact?: number;
  issueNames?: string[];
  topSamples?: string[];
};

type CoverageIssueSummary = {
  issueName?: string;
  sourceLabel?: string;
  affectedPages?: number;
  sampleCount?: number;
  detectedDate?: string | null;
  freshness?: string | null;
};

type CoverageSourceSnapshot = {
  directory?: string;
  folderName?: string;
  issueName?: string;
  sourceLabel?: string;
  affectedPages?: number;
  detectedDate?: string | null;
  ageDays?: number | null;
  newestFileModifiedAt?: string | null;
  freshness?: string | null;
};

type CoverageDrilldownJsonReport = {
  generatedAt?: string;
  directories?: string[];
  issueCount?: number;
  totalAffectedPages?: number;
  sourceFreshnessStatus?: string | null;
  sourceFreshnessDate?: string | null;
  sourceFreshnessDays?: number | null;
  sourcePreferredWindowDays?: number | null;
  sourceMaxWindowDays?: number | null;
  sourceFreshnessSummary?: string | null;
  sources?: CoverageSourceSnapshot[];
  issueSummaries?: CoverageIssueSummary[];
  clusterPriorities?: CoverageCluster[];
};

type IndexDriftJsonReport = {
  generatedAt?: string;
  counts?: {
    onlyInSitemap?: number;
    onlyInIndexableCache?: number;
  };
};

type AiProviderAlert = {
  severity?: string;
  code?: string;
  title?: string;
  detail?: string;
};

type AiProviderHealthJsonReport = {
  generatedAt?: string;
  aiConfigGuard?: {
    backupPostures?: Record<
      string,
      {
        posture?: string | null;
        reason?: string | null;
        source?: string | null;
      }
    >;
  };
  alertSummary?: {
    total?: number;
    highestSeverity?: string;
    status?: string;
  };
  alerts?: AiProviderAlert[];
  telemetry?: {
    mode?: {
      workersAi?: string;
      fallbackPolicy?: string;
    };
  };
  latestSnapshot?: {
    workersAi?: {
      maxCallsPerRun?: number;
      maxCallsPerDay?: number;
      dailyCalls?: number;
      dailyRemaining?: number;
      runRemaining?: number;
      status?: string;
      blockedReason?: string | null;
    };
  };
};

export type GscTrafficReportSummary = {
  generatedAt: string | null;
  status: RecoverySignalStatus | null;
  sourceMode: string | null;
  site: string | null;
  currentPeriod: { start: string; end: string } | null;
  previousPeriod: { start: string; end: string } | null;
  queryRows: number | null;
  pageRows: number | null;
  priorityQueryOpportunities: number | null;
  priorityPageOpportunities: number | null;
  queryPrecisionRisks: number | null;
  failureReason: string | null;
  nextStep: string | null;
};

type SkillIndexabilityJsonReport = {
  generatedAt?: string;
  summary?: {
    totalSkills?: number;
    indexable?: number;
    referenceOnly?: number;
    tier1Count?: number;
    tier2Count?: number;
    tier3Count?: number;
  };
};

type LocaleGovernanceJsonReport = {
  generatedAt?: string;
  summary?: {
    totalSkills?: number;
    totalVariants?: number;
    metadataEligibleVariants?: number;
    bodyEligibleVariants?: number;
    eligibleVariants?: number;
  };
};

export type RecoveryScorecardReport = {
  generatedAt: string;
  overallStatus: RecoverySignalStatus;
  technicalRecoveryStatus: RecoverySignalStatus;
  businessRecoveryStatus: RecoverySignalStatus;
  headline: string;
  crawl: RecoverySignal<{
    checkedUrls: number;
    discoveredUrls: number;
    sitemapFiles: number;
    sitemapErrors: number;
    status2xx: number;
    status3xx: number;
    status4xx: number;
    status5xx: number;
    statusOther: number;
    cloudflare1102: number;
    flakyRecovered: number;
    flakyRecoveredRate: number;
    fourXxRate: number;
  }>;
  coverage: RecoverySignal<{
    issueCount: number;
    totalAffectedPages: number;
    directories: string[];
    latestSourceDate: string | null;
    latestSourceAgeDays: number | null;
    sourceFreshnessStatus: string | null;
    sourcePreferredWindowDays: number;
    sourceMaxWindowDays: number;
    dominantCluster: string | null;
    dominantEstimatedAffected: number | null;
  }>;
  index: RecoverySignal<{
    onlyInSitemap: number;
    onlyInIndexableCache: number;
    totalDrift: number;
  }>;
  traffic: RecoverySignal<{
    status: RecoverySignalStatus | null;
    sourceMode: string | null;
    site: string | null;
    currentPeriod: { start: string; end: string } | null;
    previousPeriod: { start: string; end: string } | null;
    queryRows: number | null;
    pageRows: number | null;
    priorityQueryOpportunities: number | null;
    priorityPageOpportunities: number | null;
    queryPrecisionRisks: number | null;
    currentPeriodAgeDays: number | null;
    failureReason: string | null;
    nextStep: string | null;
  }>;
  aiPosture: RecoverySignal<{
    workersAiMode: string | null;
    fallbackPolicy: string | null;
    backupPostures: Record<string, { posture: string | null; reason: string | null }>;
    maxCallsPerRun: number | null;
    maxCallsPerDay: number | null;
    dailyCalls: number | null;
    dailyRemaining: number | null;
    runRemaining: number | null;
    alertCount: number;
    highestSeverity: string | null;
  }>;
  indexQuality: RecoverySignal<{
    tier1Count: number;
    totalCanonicalSkills: number;
    ratio: number;
  }>;
  languageAlignment: RecoverySignal<{
    bodyEligibleNonEnVariants: number;
    totalNonEnVariants: number;
    ratio: number;
  }>;
  weeklyGates: RecoveryGate[];
  nextActions: string[];
};

export type RecoveryScorecardBuildInput = {
  now?: Date | string;
  crawlHealthReport?: CrawlHealthJsonReport | null;
  coverageDrilldownReport?: CoverageDrilldownJsonReport | null;
  indexDriftReport?: IndexDriftJsonReport | null;
  trafficReport?: GscTrafficReportSummary | null;
  aiProviderHealthReport?: AiProviderHealthJsonReport | null;
  indexabilityReport?: SkillIndexabilityJsonReport | null;
  localeGovernanceReport?: LocaleGovernanceJsonReport | null;
  sourcePaths?: {
    crawl?: string;
    coverage?: string;
    index?: string;
    traffic?: string;
    ai?: string;
    indexability?: string;
    localeGovernance?: string;
  };
};

export type RecoveryScorecardFileOptions = {
  now?: Date | string;
  crawlJsonPath?: string;
  coverageJsonPath?: string;
  indexJsonPath?: string;
  trafficReportPath?: string;
  aiJsonPath?: string;
  indexabilityJsonPath?: string;
  localeGovernanceJsonPath?: string;
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

function normalizeNow(now?: Date | string): Date {
  if (!now) return new Date();
  if (now instanceof Date) return now;
  const parsed = new Date(now);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function ageDays(now: Date, value: string | null | undefined): number | null {
  const parsed = parseDate(value);
  if (!parsed) return null;
  return Math.max(0, Math.floor((now.getTime() - parsed.getTime()) / DAY_MS));
}

function buildSourceState(
  path: string,
  exists: boolean,
  generatedAt: string | null | undefined,
  now: Date,
  staleAfterDays: number,
): RecoverySourceState {
  const absolutePath = toAbsolutePath(path);
  const fallbackGeneratedAt = exists && existsSync(absolutePath) ? statSync(absolutePath).mtime.toISOString() : null;
  const resolvedGeneratedAt = generatedAt || fallbackGeneratedAt;
  const resolvedAgeDays = ageDays(now, resolvedGeneratedAt);

  let freshness: RecoveryFreshness = 'unknown';
  if (!exists) freshness = 'missing';
  else if (resolvedAgeDays === null) freshness = 'unknown';
  else freshness = resolvedAgeDays > staleAfterDays ? 'stale' : 'fresh';

  return {
    path,
    exists,
    generatedAt: resolvedGeneratedAt,
    ageDays: resolvedAgeDays,
    freshness,
  };
}

function statusRank(status: RecoverySignalStatus): number {
  switch (status) {
    case 'blocking':
      return 3;
    case 'warning':
      return 2;
    case 'clear':
      return 1;
    default:
      return 0;
  }
}

function combineStatuses(statuses: RecoverySignalStatus[]): RecoverySignalStatus {
  return statuses.reduce<RecoverySignalStatus>((current, next) => {
    return statusRank(next) > statusRank(current) ? next : current;
  }, 'unknown');
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatInteger(value: number | null | undefined): string {
  return numberFormatter.format(value || 0);
}

function statusLabel(status: RecoverySignalStatus): string {
  switch (status) {
    case 'clear':
      return 'CLEAR';
    case 'warning':
      return 'WARNING';
    case 'blocking':
      return 'BLOCKING';
    default:
      return 'UNKNOWN';
  }
}

function parseCoverageDirectoryDate(dirPath: string): string | null {
  const match = dirPath.match(/(\d{4}-\d{2}-\d{2})(?: \(\d+\))?$/);
  return match ? match[1] : null;
}

function parseCoverageFreshnessStatus(value: string | null | undefined): string | null {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (['fresh', 'warning', 'blocking', 'missing', 'unknown'].includes(normalized)) return normalized;
  return null;
}

function resolveCoverageSourceDate(report: CoverageDrilldownJsonReport | null | undefined): string | null {
  if (report?.sourceFreshnessDate) return report.sourceFreshnessDate;

  const fromSources =
    report?.sources
      ?.map((source) => normalizeSummaryValue(source.detectedDate))
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) || null;
  if (fromSources) return fromSources;

  return (
    report?.directories
      ?.map((dirPath) => parseCoverageDirectoryDate(dirPath))
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) || null
  );
}

function resolveCoverageSourceAgeDays(
  report: CoverageDrilldownJsonReport | null | undefined,
  now: Date,
  latestSourceDate: string | null,
): number | null {
  if (typeof report?.sourceFreshnessDays === 'number') return report.sourceFreshnessDays;

  const matchingSourceAge =
    report?.sources?.find((source) => normalizeSummaryValue(source.detectedDate) === latestSourceDate)?.ageDays ?? null;
  if (typeof matchingSourceAge === 'number') return matchingSourceAge;

  return toDateStringAgeDays(now, latestSourceDate);
}

function resolveCoverageSourceStatus(
  report: CoverageDrilldownJsonReport | null | undefined,
  latestSourceAgeDays: number | null,
): string {
  const explicit = parseCoverageFreshnessStatus(report?.sourceFreshnessStatus);
  if (explicit) return explicit;
  if (latestSourceAgeDays === null) return 'missing';
  if (latestSourceAgeDays > COVERAGE_SOURCE_MAX_AFTER_DAYS) return 'blocking';
  if (latestSourceAgeDays > COVERAGE_SOURCE_WARNING_AFTER_DAYS) return 'warning';
  return 'fresh';
}

function toDateStringAgeDays(now: Date, value: string | null): number | null {
  if (!value) return null;
  return ageDays(now, `${value}T00:00:00.000Z`);
}

function parseNumberFromSummary(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRecoverySignalStatusValue(value: string | null | undefined): RecoverySignalStatus | null {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'clear') return 'clear';
  if (normalized === 'warning') return 'warning';
  if (normalized === 'blocking') return 'blocking';
  if (normalized === 'unknown') return 'unknown';
  return null;
}

function normalizeSummaryValue(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (['n/a', 'na', 'missing', 'none'].includes(normalized.toLowerCase())) return null;
  return normalized;
}

function sanitizeCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

export function parseGscCtrReportMarkdown(markdown: string): GscTrafficReportSummary {
  const summary = new Map<string, string>();
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^- ([^:]+):\s*(.+)$/);
    if (!match) continue;
    summary.set(match[1].trim().toLowerCase(), match[2].trim());
  }

  const parsePeriod = (raw: string | undefined): { start: string; end: string } | null => {
    if (!raw) return null;
    const match = raw.match(/^(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})$/);
    return match ? { start: match[1], end: match[2] } : null;
  };

  return {
    generatedAt: normalizeSummaryValue(summary.get('generated')),
    status: parseRecoverySignalStatusValue(summary.get('status')),
    sourceMode: normalizeSummaryValue(summary.get('source mode')),
    site: normalizeSummaryValue(summary.get('site')),
    currentPeriod: parsePeriod(summary.get('current period')),
    previousPeriod: parsePeriod(summary.get('previous period')),
    queryRows: parseNumberFromSummary(summary.get('query rows') || null),
    pageRows: parseNumberFromSummary(summary.get('page rows') || null),
    priorityQueryOpportunities: parseNumberFromSummary(summary.get('priority query opportunities') || null),
    priorityPageOpportunities: parseNumberFromSummary(summary.get('priority page opportunities') || null),
    queryPrecisionRisks: parseNumberFromSummary(summary.get('query precision risks') || null),
    failureReason: normalizeSummaryValue(summary.get('failure reason')),
    nextStep: normalizeSummaryValue(summary.get('next step')),
  };
}

export function parseGscMonitoringSkippedMarkdown(markdown: string): GscTrafficReportSummary {
  const summary = new Map<string, string>();
  const fallbackLines: string[] = [];

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const summaryMatch = line.match(/^- ([^:]+):\s*(.+)$/);
    if (summaryMatch) {
      summary.set(summaryMatch[1].trim().toLowerCase(), summaryMatch[2].trim());
      continue;
    }

    fallbackLines.push(line);
  }

  const missingSecretLines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^- `GSC_[A-Z_]+`$/.test(line))
    .map((line) => line.replace(/^- `|`$/g, ''));

  const failureReason =
    normalizeSummaryValue(summary.get('failure reason')) ||
    (missingSecretLines.length > 0
      ? `Missing one or more required Search Console settings: ${missingSecretLines.join(', ')}.`
      : normalizeSummaryValue(fallbackLines.find((line) => /missing/i.test(line)) || null) ||
        'Search Console monitoring was skipped.');

  const nextStep =
    normalizeSummaryValue(summary.get('next step')) ||
    normalizeSummaryValue(fallbackLines.find((line) => /rerun|configure|service account/i.test(line)) || null) ||
    'Configure Search Console access and rerun the monitoring workflow.';

  return {
    generatedAt: normalizeSummaryValue(summary.get('generated')),
    status: 'blocking',
    sourceMode: normalizeSummaryValue(summary.get('source mode')) || 'missing-config',
    site: normalizeSummaryValue(summary.get('site')),
    currentPeriod: null,
    previousPeriod: null,
    queryRows: null,
    pageRows: null,
    priorityQueryOpportunities: null,
    priorityPageOpportunities: null,
    queryPrecisionRisks: null,
    failureReason,
    nextStep,
  };
}

function buildCrawlSignal(
  report: CrawlHealthJsonReport | null | undefined,
  path: string,
  now: Date,
): RecoveryScorecardReport['crawl'] {
  const source = buildSourceState(path, Boolean(report), report?.generatedAt || null, now, CRAWL_STALE_AFTER_DAYS);
  const checkedUrls = report?.totals?.pageUrlsChecked || 0;
  const discoveredUrls = report?.totals?.pageUrlsDiscovered || 0;
  const sitemapFiles = report?.totals?.sitemapFilesDiscovered || 0;
  const status2xx = report?.statusSummary?.status2xx || 0;
  const status3xx = report?.statusSummary?.status3xx || 0;
  const status4xx = report?.statusSummary?.status4xx || 0;
  const status5xx = report?.statusSummary?.status5xx || 0;
  const statusOther = report?.statusSummary?.statusOther || 0;
  const cloudflare1102 = Array.isArray(report?.cloudflare1102) ? report!.cloudflare1102!.length : 0;
  const flakyRecovered = Array.isArray(report?.flakyRecovered) ? report!.flakyRecovered!.length : 0;
  const sitemapErrors = Array.isArray(report?.sitemapErrors) ? report!.sitemapErrors!.length : 0;
  const fourXxRate = checkedUrls > 0 ? status4xx / checkedUrls : 0;
  const flakyRecoveredRate = checkedUrls > 0 ? flakyRecovered / checkedUrls : 0;

  const notes: string[] = [];
  let status: RecoverySignalStatus = 'unknown';

  if (!report) {
    status = 'blocking';
    notes.push(`Missing crawl-health input at \`${path}\`.`);
  } else if (checkedUrls === 0) {
    status = 'blocking';
    notes.push('The crawl-health report exists but no sampled URLs were checked.');
  } else {
    status = 'clear';
    if (source.freshness === 'stale') {
      status = 'warning';
      notes.push(`Crawl-health evidence is ${source.ageDays} day(s) old.`);
    }
    if (
      status5xx > 0 ||
      cloudflare1102 > 0 ||
      fourXxRate > 0.002 ||
      flakyRecovered >= CRAWL_HARD_FAIL_FLAKY_5XX_MIN ||
      flakyRecoveredRate > CRAWL_HARD_FAIL_FLAKY_5XX_RATE ||
      sitemapErrors > 0
    ) {
      status = 'blocking';
    }
  }

  if (status4xx > 0) {
    notes.push(`Sampled 4xx rate is ${formatPercent(fourXxRate)} across ${formatInteger(checkedUrls)} checked URLs.`);
  }
  if (status5xx > 0) {
    notes.push(`Observed ${formatInteger(status5xx)} sampled 5xx responses.`);
  }
  if (cloudflare1102 > 0) {
    notes.push(`Observed ${formatInteger(cloudflare1102)} Cloudflare 1102 responses.`);
  }
  if (flakyRecovered > 0) {
    notes.push(
      `Observed ${formatInteger(flakyRecovered)} URL(s) that returned 5xx before recovering on retry (${formatPercent(
        flakyRecoveredRate,
      )}).`,
    );
  }
  if (sitemapErrors > 0) {
    notes.push(
      `Observed ${formatInteger(sitemapErrors)} sitemap fetch failures; crawl entrypoints are not fully healthy.`,
    );
  }

  let summary = 'Crawl health is unavailable.';
  if (status === 'clear') {
    summary = 'Main-domain crawl health meets the weekly recovery target.';
  } else if (status === 'warning') {
    summary = 'Crawl health currently passes, but the evidence is stale.';
  } else if (status === 'blocking') {
    summary = 'Crawl health does not satisfy the weekly recovery target.';
  }

  return {
    label: 'Crawl Health',
    status,
    summary,
    target:
      'Fresh crawl-health report with 4xx <= 0.2%, final 5xx = 0, recovered flaky 5xx below the hard-fail threshold, Cloudflare 1102 = 0, and sitemap fetch errors = 0.',
    observed: `${formatInteger(checkedUrls)} checked; 2xx ${formatInteger(status2xx)}; 4xx ${formatInteger(status4xx)} (${formatPercent(fourXxRate)}); final5xx ${formatInteger(status5xx)}; flaky5xx ${formatInteger(flakyRecovered)} (${formatPercent(flakyRecoveredRate)}); 1102 ${formatInteger(cloudflare1102)}; sitemapErrors=${formatInteger(sitemapErrors)}.`,
    notes,
    source,
    metrics: {
      checkedUrls,
      discoveredUrls,
      sitemapFiles,
      sitemapErrors,
      status2xx,
      status3xx,
      status4xx,
      status5xx,
      statusOther,
      cloudflare1102,
      flakyRecovered,
      flakyRecoveredRate,
      fourXxRate,
    },
  };
}

function buildCoverageSignal(
  report: CoverageDrilldownJsonReport | null | undefined,
  path: string,
  now: Date,
): RecoveryScorecardReport['coverage'] {
  const source = buildSourceState(
    path,
    Boolean(report),
    report?.generatedAt || null,
    now,
    COVERAGE_REPORT_STALE_AFTER_DAYS,
  );
  const directories = report?.directories || [];
  const latestSourceDate = resolveCoverageSourceDate(report);
  const latestSourceAgeDays = resolveCoverageSourceAgeDays(report, now, latestSourceDate);
  const sourceFreshnessStatus = resolveCoverageSourceStatus(report, latestSourceAgeDays);
  const sourcePreferredWindowDays = report?.sourcePreferredWindowDays || COVERAGE_SOURCE_WARNING_AFTER_DAYS;
  const sourceMaxWindowDays = report?.sourceMaxWindowDays || COVERAGE_SOURCE_MAX_AFTER_DAYS;
  const dominantCluster = report?.clusterPriorities?.[0];

  const issueCount = report?.issueCount || 0;
  const totalAffectedPages = report?.totalAffectedPages || 0;

  const notes: string[] = [];
  let status: RecoverySignalStatus = 'unknown';

  if (!report) {
    status = 'blocking';
    notes.push(`Missing coverage drilldown input at \`${path}\`.`);
  } else if (!latestSourceDate) {
    status = 'blocking';
    notes.push('Coverage drilldown exists, but no raw export date could be detected from the source directories.');
  } else {
    status = 'clear';

    if (source.freshness === 'stale') {
      status = 'warning';
      notes.push(`Coverage report is ${source.ageDays} day(s) old.`);
    }

    if (sourceFreshnessStatus === 'blocking') {
      status = 'blocking';
      notes.push(
        `Newest local raw Coverage Drilldown export is ${latestSourceDate}, which is outside the hard ${sourceMaxWindowDays}-day freshness SLA.`,
      );
    } else if (sourceFreshnessStatus === 'warning') {
      status = 'warning';
      notes.push(
        `Newest local raw Coverage Drilldown export is ${latestSourceDate}, which is older than the preferred ${sourcePreferredWindowDays}-day window but still inside the hard ${sourceMaxWindowDays}-day SLA.`,
      );
    } else if (issueCount > 0 || totalAffectedPages > 0) {
      const hasP0Cluster = (report.issueSummaries || []).some(
        (item) => item.freshness === 'fresh' && /5xx|1102|server/i.test(item.issueName || '')
      );
      // known_skill_404 is an explained cluster (expected 404s from deleted/renamed repos)
      const dominantIsExplained = dominantCluster?.cluster === 'known_skill_404';
      if (hasP0Cluster) {
        status = 'blocking';
      } else if (!dominantIsExplained) {
        status = 'warning';
      }
      // If the dominant cluster is known_skill_404 and there's no P0 cluster, status stays 'clear'.
    }
  }

  if (report?.sourceFreshnessSummary) {
    notes.push(report.sourceFreshnessSummary);
  }

  if (dominantCluster?.cluster) {
    notes.push(
      `Dominant cluster: ${dominantCluster.cluster} (~${formatInteger(Math.round(dominantCluster.estimatedAffected || 0))} affected).`,
    );
  }

  let summary = 'Coverage drilldown is unavailable.';
  if (status === 'clear') {
    summary = 'Coverage drilldown inputs are fresh enough for weekly attribution review.';
  } else if (status === 'warning') {
    summary = 'Coverage drilldown exists, but freshness or completeness limits recovery attribution.';
  } else if (status === 'blocking') {
    summary = 'Coverage drilldown is missing or still indicates blocking index-coverage issues.';
  }

  return {
    label: 'Coverage Drilldown',
    status,
    summary,
    target:
      'Coverage drilldown should be regenerated from fresh raw exports at least weekly, with dominant clusters explained explicitly.',
    observed: `${formatInteger(issueCount)} issue bucket(s); ${formatInteger(totalAffectedPages)} affected pages; freshest raw export ${latestSourceDate || 'missing'} (${sourceFreshnessStatus}).`,
    notes,
    source,
    metrics: {
      issueCount,
      totalAffectedPages,
      directories,
      latestSourceDate,
      latestSourceAgeDays,
      sourceFreshnessStatus,
      sourcePreferredWindowDays,
      sourceMaxWindowDays,
      dominantCluster: dominantCluster?.cluster || null,
      dominantEstimatedAffected: dominantCluster?.estimatedAffected || null,
    },
  };
}

function buildIndexSignal(
  report: IndexDriftJsonReport | null | undefined,
  path: string,
  now: Date,
): RecoveryScorecardReport['index'] {
  const source = buildSourceState(path, Boolean(report), report?.generatedAt || null, now, INDEX_STALE_AFTER_DAYS);
  const onlyInSitemap = report?.counts?.onlyInSitemap || 0;
  const onlyInIndexableCache = report?.counts?.onlyInIndexableCache || 0;
  const totalDrift = onlyInSitemap + onlyInIndexableCache;

  const notes: string[] = [];
  let status: RecoverySignalStatus = 'unknown';

  if (!report) {
    status = 'blocking';
    notes.push(`Missing index-drift input at \`${path}\`.`);
  } else {
    status = totalDrift === 0 ? 'clear' : totalDrift > 25 ? 'blocking' : 'warning';
    if (source.freshness === 'stale' && status !== 'blocking') {
      status = 'warning';
      notes.push(`Index-drift evidence is ${source.ageDays} day(s) old.`);
    }
    if (onlyInSitemap > 0) {
      notes.push(`${formatInteger(onlyInSitemap)} item(s) appear only in sitemap output.`);
    }
    if (onlyInIndexableCache > 0) {
      notes.push(`${formatInteger(onlyInIndexableCache)} item(s) appear only in the indexable cache.`);
    }
  }

  let summary = 'Index-drift evidence is unavailable.';
  if (status === 'clear') {
    summary = 'Sitemap output and indexable cache are aligned.';
  } else if (status === 'warning') {
    summary = 'Index-drift evidence is present, but the board should review remaining drift or stale data.';
  } else if (status === 'blocking') {
    summary = 'Index-drift evidence shows unresolved source divergence or is missing entirely.';
  }

  return {
    label: 'Index Integrity',
    status,
    summary,
    target: 'Index-drift report should stay fresh and show zero sitemap/cache divergence.',
    observed: `onlyInSitemap=${formatInteger(onlyInSitemap)}; onlyInIndexableCache=${formatInteger(onlyInIndexableCache)}.`,
    notes,
    source,
    metrics: {
      onlyInSitemap,
      onlyInIndexableCache,
      totalDrift,
    },
  };
}

function buildTrafficSignal(
  report: GscTrafficReportSummary | null | undefined,
  path: string,
  now: Date,
): RecoveryScorecardReport['traffic'] {
  const source = buildSourceState(path, Boolean(report), report?.generatedAt || null, now, TRAFFIC_STALE_AFTER_DAYS);
  const currentPeriodAgeDays = report?.currentPeriod ? toDateStringAgeDays(now, report.currentPeriod.end) : null;

  const notes: string[] = [];
  let status: RecoverySignalStatus = 'unknown';

  if (!report) {
    status = 'blocking';
    notes.push(`Missing Search Console summary at \`${path}\`.`);
  } else if (report.sourceMode) {
    notes.push(`Search Console source mode: ${report.sourceMode}.`);
  }

  if (report?.failureReason) {
    notes.push(report.failureReason);
  }

  if (report?.nextStep) {
    notes.push(report.nextStep);
  }

  if (!report) {
    status = 'blocking';
  } else if (report.status === 'blocking') {
    status = 'blocking';
  } else if (!report.currentPeriod) {
    status = 'blocking';
    notes.push('Traffic report exists but the current period could not be parsed.');
  } else {
    status = report.status === 'warning' ? 'warning' : 'clear';
    if (source.freshness === 'stale') {
      status = 'warning';
      notes.push(`Traffic report is ${source.ageDays} day(s) old.`);
    }
    if ((currentPeriodAgeDays ?? TRAFFIC_STALE_AFTER_DAYS + 1) > TRAFFIC_STALE_AFTER_DAYS) {
      status = 'warning';
      notes.push(`Current Search Console period ends on ${report.currentPeriod.end}, so the weekly view is stale.`);
    }
    if (report.queryRows === null || report.pageRows === null) {
      status = 'warning';
      notes.push('Traffic report is missing row-count summary fields.');
    }
  }

  let summary = 'Traffic recovery cannot be evaluated because Search Console evidence is missing.';
  if (status === 'clear') {
    summary = 'Fresh Search Console traffic evidence is available for weekly recovery review.';
  } else if (status === 'warning') {
    summary = 'Traffic evidence exists, but freshness or parsing gaps limit confidence.';
  } else if (status === 'blocking') {
    summary = 'Traffic recovery cannot be evaluated because Search Console evidence is blocked or missing.';
  }

  return {
    label: 'Traffic Visibility',
    status,
    summary,
    target:
      'A fresh Search Console summary should be present weekly so traffic recovery can be judged from real click/impression data.',
    observed: report?.currentPeriod
      ? `source=${report.sourceMode || 'unknown'}; current ${report.currentPeriod.start} -> ${report.currentPeriod.end}; queryRows=${formatInteger(report.queryRows)}; pageRows=${formatInteger(report.pageRows)}.`
      : `source=${report?.sourceMode || 'unknown'}; no parsed Search Console period available.`,
    notes,
    source,
    metrics: {
      status: report?.status ?? null,
      sourceMode: report?.sourceMode ?? null,
      site: report?.site ?? null,
      currentPeriod: report?.currentPeriod || null,
      previousPeriod: report?.previousPeriod || null,
      queryRows: report?.queryRows ?? null,
      pageRows: report?.pageRows ?? null,
      priorityQueryOpportunities: report?.priorityQueryOpportunities ?? null,
      priorityPageOpportunities: report?.priorityPageOpportunities ?? null,
      queryPrecisionRisks: report?.queryPrecisionRisks ?? null,
      currentPeriodAgeDays,
      failureReason: report?.failureReason ?? null,
      nextStep: report?.nextStep ?? null,
    },
  };
}

function buildAiPostureSignal(
  report: AiProviderHealthJsonReport | null | undefined,
  path: string,
  now: Date,
): RecoveryScorecardReport['aiPosture'] {
  const source = buildSourceState(path, Boolean(report), report?.generatedAt || null, now, AI_STALE_AFTER_DAYS);
  const workersAiMode = report?.telemetry?.mode?.workersAi || null;
  const fallbackPolicy = report?.telemetry?.mode?.fallbackPolicy || null;
  const maxCallsPerRun = report?.latestSnapshot?.workersAi?.maxCallsPerRun ?? null;
  const maxCallsPerDay = report?.latestSnapshot?.workersAi?.maxCallsPerDay ?? null;
  const dailyCalls = report?.latestSnapshot?.workersAi?.dailyCalls ?? null;
  const dailyRemaining = report?.latestSnapshot?.workersAi?.dailyRemaining ?? null;
  const runRemaining = report?.latestSnapshot?.workersAi?.runRemaining ?? null;
  const alertCount = report?.alertSummary?.total || 0;
  const highestSeverity = report?.alertSummary?.highestSeverity || null;
  const backupPostures = {
    siliconflow: {
      posture: report?.aiConfigGuard?.backupPostures?.siliconflow?.posture || null,
      reason: report?.aiConfigGuard?.backupPostures?.siliconflow?.reason || null,
    },
    openrouter: {
      posture: report?.aiConfigGuard?.backupPostures?.openrouter?.posture || null,
      reason: report?.aiConfigGuard?.backupPostures?.openrouter?.reason || null,
    },
    cloudflare: {
      posture: report?.aiConfigGuard?.backupPostures?.cloudflare?.posture || null,
      reason: report?.aiConfigGuard?.backupPostures?.cloudflare?.reason || null,
    },
  };

  const notes: string[] = [];
  let status: RecoverySignalStatus = 'unknown';

  if (!report) {
    status = 'unknown';
    notes.push(`Missing AI provider health input at \`${path}\`.`);
  } else {
    status = 'clear';
    if (source.freshness === 'stale') {
      status = 'warning';
      notes.push(`AI provider health evidence is ${source.ageDays} day(s) old.`);
    }
    if (workersAiMode !== 'free-only') {
      status = 'blocking';
      notes.push(`Workers AI mode drifted to \`${workersAiMode || 'unknown'}\`.`);
    }
    if ((maxCallsPerRun ?? 0) > 60 || (maxCallsPerDay ?? 0) > 60) {
      status = 'blocking';
      notes.push('Workers AI free caps exceed the approved 60/60 ceiling.');
    }
    notes.push(
      `Backup posture: siliconflow=${backupPostures.siliconflow.posture || 'n/a'}${
        backupPostures.siliconflow.reason ? ` (${backupPostures.siliconflow.reason})` : ''
      }, openrouter=${backupPostures.openrouter.posture || 'n/a'}${
        backupPostures.openrouter.reason ? ` (${backupPostures.openrouter.reason})` : ''
      }, cloudflare=${backupPostures.cloudflare.posture || 'n/a'}${
        backupPostures.cloudflare.reason ? ` (${backupPostures.cloudflare.reason})` : ''
      }.`,
    );
    if (highestSeverity === 'critical' && status !== 'blocking') {
      status = 'blocking';
    } else if (alertCount > 0 && status !== 'blocking') {
      status = 'warning';
    }
    for (const alert of report.alerts || []) {
      notes.push(`${alert.title || alert.code || 'alert'}${alert.detail ? ` (${alert.detail})` : ''}.`);
    }
  }

  let summary = 'AI runtime posture is not included in this scorecard.';
  if (status === 'clear') {
    summary = 'AI runtime guardrails remain inside policy for recovery work.';
  } else if (status === 'warning') {
    summary = 'AI runtime guardrails are still within policy, but backup or provider warnings remain.';
  } else if (status === 'blocking') {
    summary = 'AI runtime posture drifted outside the approved recovery guardrails.';
  }

  return {
    label: 'AI Runtime Posture',
    status,
    summary,
    target: 'Workers AI stays free-only at 60/60, NVIDIA remains primary, and backup issues remain explicit.',
    observed: `workersAi=${workersAiMode || 'missing'}; cap=${maxCallsPerRun ?? 'n/a'}/${maxCallsPerDay ?? 'n/a'}; alerts=${formatInteger(alertCount)}; fallback=${fallbackPolicy || 'unknown'}.`,
    notes,
    source,
    metrics: {
      workersAiMode,
      fallbackPolicy,
      backupPostures,
      maxCallsPerRun,
      maxCallsPerDay,
      dailyCalls,
      dailyRemaining,
      runRemaining,
      alertCount,
      highestSeverity,
    },
  };
}

function buildHeadline(
  technicalRecoveryStatus: RecoverySignalStatus,
  businessRecoveryStatus: RecoverySignalStatus,
  coverage: RecoveryScorecardReport['coverage'],
  aiPosture: RecoveryScorecardReport['aiPosture'],
): string {
  const parts: string[] = [];

  if (technicalRecoveryStatus === 'clear') {
    parts.push('Technical recovery on the main domain is stable.');
  } else if (technicalRecoveryStatus === 'warning') {
    parts.push('Technical recovery looks mostly stable, but some core evidence is stale.');
  } else {
    parts.push('Technical recovery is not yet stable enough to close.');
  }

  if (businessRecoveryStatus === 'blocking') {
    parts.push('Business recovery still cannot be validated from fresh traffic evidence.');
  } else if (businessRecoveryStatus === 'warning') {
    parts.push('Business recovery evidence exists, but it is not yet fresh enough for confident closure.');
  } else {
    parts.push('Business recovery now has fresh traffic visibility.');
  }

  if (
    ['blocking', 'warning', 'missing'].includes(
      String(coverage.metrics.sourceFreshnessStatus || '')
        .trim()
        .toLowerCase(),
    ) &&
    coverage.metrics.latestSourceDate
  ) {
    parts.push(
      `Coverage attribution is limited because the newest local raw export is ${coverage.metrics.latestSourceDate}.`,
    );
  } else if (coverage.status !== 'clear' && coverage.metrics.dominantCluster) {
    if (coverage.metrics.dominantCluster === 'known_skill_404') {
      parts.push(
        'Coverage dominant cluster is known_skill_404 (expected 404s from deleted/renamed repos) — explained and not blocking.',
      );
    } else {
      parts.push(
        `Coverage attribution now has fresh inputs, but the dominant cluster is still ${coverage.metrics.dominantCluster}.`,
      );
    }
  }

  if (aiPosture.status === 'warning') {
    parts.push(
      'AI backup posture still needs operator attention, even though Workers AI remains inside free-only guardrails.',
    );
  } else if (aiPosture.status === 'blocking') {
    parts.push('AI guardrails drifted outside policy and need immediate remediation.');
  }

  return parts.join(' ');
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildNextActions(report: RecoveryScorecardReport): string[] {
  const actions: string[] = [];

  if (
    ['blocking', 'warning', 'missing'].includes(
      String(report.coverage.metrics.sourceFreshnessStatus || '')
        .trim()
        .toLowerCase(),
    )
  ) {
    actions.push(
      `Ingest the newest Coverage Drilldown export(s) and rerun \`npx tsx scripts/seo-coverage-drilldown.ts\`; freshest local raw source is ${report.coverage.metrics.latestSourceDate || 'missing'}.`,
    );
  } else if (report.coverage.status !== 'clear') {
    // Only suggest working the dominant cluster if it's not already explained
    if (report.coverage.metrics.dominantCluster && report.coverage.metrics.dominantCluster !== 'known_skill_404') {
      actions.push(
        `Work the dominant Coverage Drilldown clusters from \`reports/seo/latest-coverage-drilldown.md\`; current leader is ${report.coverage.metrics.dominantCluster || 'unknown'}.`,
      );
    }
  }

  if (report.traffic.status !== 'clear') {
    if (report.traffic.metrics.sourceMode === 'missing-config') {
      actions.push(
        'Configure `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY`, and `GSC_SITE_URL`, then rerun `npx tsx scripts/gsc-fetch-report.ts` so traffic recovery can be evaluated from real clicks and impressions.',
      );
    } else if (report.traffic.metrics.sourceMode === 'request-failed') {
      actions.push(
        'Repair Search Console service-account access or property permissions, then rerun `npx tsx scripts/gsc-fetch-report.ts` to regenerate a fresh traffic summary.',
      );
    } else {
      actions.push(
        'Generate a fresh Search Console summary with `npx tsx scripts/gsc-fetch-report.ts` so traffic recovery can be evaluated from real clicks and impressions.',
      );
    }
  }

  if (report.crawl.status === 'blocking' && report.crawl.metrics.flakyRecovered > 0) {
    actions.push(
      `Investigate recovered flaky 5xx from \`reports/seo/latest-crawl-health.md\`; current sample has ${formatInteger(
        report.crawl.metrics.flakyRecovered,
      )} recovered URL(s), concentrated by route bucket in the crawl report.`,
    );
  } else if (report.crawl.status === 'clear') {
    actions.push(
      'Keep the main-domain crawl loop running daily until a full 7-day streak holds at `4xx <= 0.2%`, `final 5xx = 0`, `flaky 5xx below threshold`, and `Cloudflare 1102 = 0`.',
    );
  }

  if (report.aiPosture.status !== 'clear') {
    actions.push(
      'Restore SiliconFlow credit or mark it intentionally disabled, while keeping Workers AI locked to the approved `free-only` 60/60 caps.',
    );
  }

  return dedupeStrings(actions);
}

function renderSignalSection(signal: RecoverySignal): string {
  return [
    `## ${signal.label}`,
    '',
    `- Status: ${statusLabel(signal.status)}`,
    `- Source: \`${signal.source.path}\``,
    `- Generated: ${signal.source.generatedAt || 'missing'}`,
    `- Summary: ${signal.summary}`,
    `- Target: ${signal.target}`,
    `- Observed: ${signal.observed}`,
    ...(signal.notes.length > 0 ? ['', '### Notes', '', ...signal.notes.map((note) => `- ${note}`)] : []),
  ].join('\n');
}

function buildIndexQualitySignal(
  report: SkillIndexabilityJsonReport | null | undefined,
  sourcePath: string,
  now: Date,
): RecoverySignal<{ tier1Count: number; totalCanonicalSkills: number; ratio: number }> {
  const source = buildSourceState(sourcePath, Boolean(report), report?.generatedAt || null, now, INDEX_STALE_AFTER_DAYS);
  const tier1Count = report?.summary?.tier1Count ?? 0;
  const totalCanonicalSkills = report?.summary?.totalSkills ?? 0;
  const ratio = totalCanonicalSkills > 0 ? tier1Count / totalCanonicalSkills : 0;

  let status: RecoverySignalStatus;
  let target: string;
  let observed: string;
  const notes: string[] = [];

  if (tier1Count === 0) {
    status = 'blocking';
    notes.push('Zero Tier 1 skills — no pages promoted in search listings');
  } else if (ratio >= 0.05) {
    status = 'clear';
  } else if (ratio >= 0.03) {
    status = 'warning';
    notes.push('Tier 1 ratio below 5% target — consider promoting more skills');
  } else {
    status = 'blocking';
    notes.push('Tier 1 ratio below 3% — index is too thin for Google trust signals');
  }

  target = '>= 5% Tier 1 ratio';
  observed = `${tier1Count} Tier 1 / ${totalCanonicalSkills} total (${(ratio * 100).toFixed(1)}%)`;

  return { label: 'Index Quality Ratio', status, summary: `Tier 1 ratio at ${(ratio * 100).toFixed(1)}%`, target, observed, notes, source, metrics: { tier1Count, totalCanonicalSkills, ratio: Number((ratio * 100).toFixed(1)) } };
}

function buildLanguageAlignmentSignal(
  report: LocaleGovernanceJsonReport | null | undefined,
  sourcePath: string,
  now: Date,
): RecoverySignal<{ bodyEligibleNonEnVariants: number; totalNonEnVariants: number; ratio: number }> {
  const source = buildSourceState(sourcePath, Boolean(report), report?.generatedAt || null, now, INDEX_STALE_AFTER_DAYS);
  // Non-EN variants = total variants - EN variants (1 per skill)
  const totalVariants = report?.summary?.totalVariants ?? 0;
  const totalSkills = report?.summary?.totalSkills ?? 0;
  const bodyEligibleVariants = report?.summary?.bodyEligibleVariants ?? 0;
  // EN contributes 1 body-eligible variant per skill; non-EN = total - EN
  const enVariants = totalSkills; // Each skill has at least an EN variant
  const totalNonEnVariants = Math.max(0, totalVariants - enVariants);
  const bodyEligibleNonEn = Math.max(0, bodyEligibleVariants - enVariants);
  const ratio = totalNonEnVariants > 0 ? bodyEligibleNonEn / totalNonEnVariants : 1;
  // If no locale governance data, assume passthrough
  const adjustedRatio = totalVariants === 0 ? 1 : ratio;

  let status: RecoverySignalStatus;
  let target: string;
  let observed: string;
  const notes: string[] = [];

  if (adjustedRatio >= 0.8) {
    status = 'clear';
  } else if (adjustedRatio >= 0.5) {
    status = 'warning';
    notes.push('Many non-EN pages have mismatched body language — suppress with noindex');
  } else {
    status = 'blocking';
    notes.push('Severe body-language mismatch — non-EN URLs showing EN content triggers Google quality penalty');
  }

  target = '>= 80% body-eligible non-EN variants';
  observed = `${bodyEligibleNonEn} body-eligible / ${totalNonEnVariants} total non-EN (${(adjustedRatio * 100).toFixed(1)}%)`;

  return { label: 'Language Alignment', status, summary: `Body-locale alignment at ${(adjustedRatio * 100).toFixed(1)}%`, target, observed, notes, source, metrics: { bodyEligibleNonEnVariants: bodyEligibleNonEn, totalNonEnVariants, ratio: Number((adjustedRatio * 100).toFixed(1)) } };
}

export function buildRecoveryScorecardReport(input: RecoveryScorecardBuildInput = {}): RecoveryScorecardReport {
  const now = normalizeNow(input.now);
  const sourcePaths = {
    crawl: input.sourcePaths?.crawl || DEFAULT_CRAWL_HEALTH_JSON_PATH,
    coverage: input.sourcePaths?.coverage || DEFAULT_COVERAGE_DRILLDOWN_JSON_PATH,
    index: input.sourcePaths?.index || DEFAULT_INDEX_DRIFT_JSON_PATH,
    traffic: input.sourcePaths?.traffic || DEFAULT_TRAFFIC_REPORT_MD_PATH,
    ai: input.sourcePaths?.ai || DEFAULT_AI_PROVIDER_HEALTH_JSON_PATH,
    indexability: input.sourcePaths?.indexability || DEFAULT_INDEXABILITY_JSON_PATH,
    localeGovernance: input.sourcePaths?.localeGovernance || DEFAULT_LOCALE_GOVERNANCE_JSON_PATH,
  };

  const crawl = buildCrawlSignal(input.crawlHealthReport, sourcePaths.crawl, now);
  const coverage = buildCoverageSignal(input.coverageDrilldownReport, sourcePaths.coverage, now);
  const index = buildIndexSignal(input.indexDriftReport, sourcePaths.index, now);
  const traffic = buildTrafficSignal(input.trafficReport, sourcePaths.traffic, now);
  const aiPosture = buildAiPostureSignal(input.aiProviderHealthReport, sourcePaths.ai, now);
  const indexQuality = buildIndexQualitySignal(input.indexabilityReport, sourcePaths.indexability, now);
  const languageAlignment = buildLanguageAlignmentSignal(
    input.localeGovernanceReport,
    sourcePaths.localeGovernance,
    now,
  );

  const technicalRecoveryStatus =
    crawl.status === 'blocking' || index.status === 'blocking'
      ? 'blocking'
      : crawl.status === 'warning' || index.status === 'warning'
        ? 'warning'
        : 'clear';
  const businessRecoveryStatus =
    traffic.status === 'clear'
      ? coverage.status === 'blocking'
        ? 'warning'
        : coverage.status === 'warning'
          ? 'warning'
          : 'clear'
      : traffic.status;
  const overallStatus = combineStatuses([
    technicalRecoveryStatus,
    businessRecoveryStatus,
    coverage.status,
    aiPosture.status,
    indexQuality.status,
    languageAlignment.status,
  ]);

  const weeklyGates: RecoveryGate[] = [
    {
      id: 'crawl-health',
      label: 'Crawl Health',
      status: crawl.status,
      target: crawl.target,
      observed: crawl.observed,
      notes: crawl.notes,
    },
    {
      id: 'coverage-drilldown',
      label: 'Coverage Freshness',
      status: coverage.status,
      target: coverage.target,
      observed: coverage.observed,
      notes: coverage.notes,
    },
    {
      id: 'index-integrity',
      label: 'Index Integrity',
      status: index.status,
      target: index.target,
      observed: index.observed,
      notes: index.notes,
    },
    {
      id: 'traffic-visibility',
      label: 'Traffic Visibility',
      status: traffic.status,
      target: traffic.target,
      observed: traffic.observed,
      notes: traffic.notes,
    },
    {
      id: 'ai-runtime-posture',
      label: 'AI Runtime Posture',
      status: aiPosture.status,
      target: aiPosture.target,
      observed: aiPosture.observed,
      notes: aiPosture.notes,
    },
    {
      id: 'index-quality-ratio',
      label: 'Index Quality Ratio',
      status: indexQuality.status,
      target: indexQuality.target,
      observed: indexQuality.observed,
      notes: indexQuality.notes,
    },
    {
      id: 'language-alignment',
      label: 'Language Alignment',
      status: languageAlignment.status,
      target: languageAlignment.target,
      observed: languageAlignment.observed,
      notes: languageAlignment.notes,
    },
  ];

  const report: RecoveryScorecardReport = {
    generatedAt: now.toISOString(),
    overallStatus,
    technicalRecoveryStatus,
    businessRecoveryStatus,
    headline: '',
    crawl,
    coverage,
    index,
    traffic,
    aiPosture,
    indexQuality,
    languageAlignment,
    weeklyGates,
    nextActions: [],
  };

  report.headline = buildHeadline(report.technicalRecoveryStatus, report.businessRecoveryStatus, coverage, aiPosture);
  report.nextActions = buildNextActions(report);
  return report;
}

export function renderRecoveryScorecardReport(report: RecoveryScorecardReport): string {
  const tableRows = report.weeklyGates.map((gate) => {
    return `| ${sanitizeCell(gate.label)} | ${statusLabel(gate.status)} | ${sanitizeCell(gate.target)} | ${sanitizeCell(gate.observed)} |`;
  });

  const gateNotes = report.weeklyGates.flatMap((gate) => {
    if (gate.notes.length === 0) return [];
    return [`### ${gate.label} Notes`, '', ...gate.notes.map((note) => `- ${note}`), ''];
  });

  return [
    '# Recovery Scorecard',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Overall status: ${statusLabel(report.overallStatus)}`,
    `- Technical recovery: ${statusLabel(report.technicalRecoveryStatus)}`,
    `- Business recovery: ${statusLabel(report.businessRecoveryStatus)}`,
    '',
    '## Headline',
    '',
    report.headline,
    '',
    '## Weekly Gates',
    '',
    '| Gate | Status | Target | Observed |',
    '| --- | --- | --- | --- |',
    ...tableRows,
    '',
    ...gateNotes,
    renderSignalSection(report.crawl),
    '',
    renderSignalSection(report.coverage),
    '',
    renderSignalSection(report.index),
    '',
    renderSignalSection(report.traffic),
    '',
    renderSignalSection(report.aiPosture),
    '',
    renderSignalSection(report.indexQuality),
    '',
    renderSignalSection(report.languageAlignment),
    '',
    '## Next Actions',
    '',
    ...(report.nextActions.length > 0
      ? report.nextActions.map((action, index) => `${index + 1}. ${action}`)
      : ['1. No follow-up actions.']),
    '',
  ].join('\n');
}

export function writeRecoveryScorecardArtifacts(
  report: RecoveryScorecardReport,
  options: {
    markdownOutputPath?: string;
    jsonOutputPath?: string;
  } = {},
): void {
  const markdownOutputPath = options.markdownOutputPath || DEFAULT_RECOVERY_SCORECARD_MD_PATH;
  const jsonOutputPath = options.jsonOutputPath || DEFAULT_RECOVERY_SCORECARD_JSON_PATH;

  const markdownAbsolutePath = toAbsolutePath(markdownOutputPath);
  const jsonAbsolutePath = toAbsolutePath(jsonOutputPath);

  mkdirSync(dirname(markdownAbsolutePath), { recursive: true });
  mkdirSync(dirname(jsonAbsolutePath), { recursive: true });

  writeFileSync(markdownAbsolutePath, renderRecoveryScorecardReport(report), 'utf8');
  writeFileSync(jsonAbsolutePath, JSON.stringify(report, null, 2), 'utf8');
}

export function buildRecoveryScorecardFromFiles(options: RecoveryScorecardFileOptions = {}): RecoveryScorecardReport {
  const crawlJsonPath = options.crawlJsonPath || DEFAULT_CRAWL_HEALTH_JSON_PATH;
  const coverageJsonPath = options.coverageJsonPath || DEFAULT_COVERAGE_DRILLDOWN_JSON_PATH;
  const indexJsonPath = options.indexJsonPath || DEFAULT_INDEX_DRIFT_JSON_PATH;
  const trafficReportPath = options.trafficReportPath || DEFAULT_TRAFFIC_REPORT_MD_PATH;
  const aiJsonPath = options.aiJsonPath || DEFAULT_AI_PROVIDER_HEALTH_JSON_PATH;
  const indexabilityJsonPath = options.indexabilityJsonPath || DEFAULT_INDEXABILITY_JSON_PATH;
  const localeGovernanceJsonPath = options.localeGovernanceJsonPath || DEFAULT_LOCALE_GOVERNANCE_JSON_PATH;

  const trafficMarkdown = readTextFile(trafficReportPath);
  const trafficSkippedPath =
    trafficReportPath === DEFAULT_TRAFFIC_REPORT_MD_PATH
      ? DEFAULT_TRAFFIC_MONITORING_SKIPPED_MD_PATH
      : resolve(dirname(trafficReportPath), 'monitoring-skipped.md');
  const trafficSkippedMarkdown = trafficMarkdown ? null : readTextFile(trafficSkippedPath);
  const trafficSourcePath = trafficMarkdown
    ? trafficReportPath
    : trafficSkippedMarkdown
      ? trafficSkippedPath
      : trafficReportPath;

  return buildRecoveryScorecardReport({
    now: options.now,
    crawlHealthReport: readJsonFile<CrawlHealthJsonReport>(crawlJsonPath),
    coverageDrilldownReport: readJsonFile<CoverageDrilldownJsonReport>(coverageJsonPath),
    indexDriftReport: readJsonFile<IndexDriftJsonReport>(indexJsonPath),
    trafficReport: trafficMarkdown
      ? parseGscCtrReportMarkdown(trafficMarkdown)
      : trafficSkippedMarkdown
        ? parseGscMonitoringSkippedMarkdown(trafficSkippedMarkdown)
        : null,
    aiProviderHealthReport: readJsonFile<AiProviderHealthJsonReport>(aiJsonPath),
    indexabilityReport: readJsonFile<SkillIndexabilityJsonReport>(indexabilityJsonPath),
    localeGovernanceReport: readJsonFile<LocaleGovernanceJsonReport>(localeGovernanceJsonPath),
    sourcePaths: {
      crawl: crawlJsonPath,
      coverage: coverageJsonPath,
      index: indexJsonPath,
      traffic: trafficSourcePath,
      ai: aiJsonPath,
      indexability: indexabilityJsonPath,
      localeGovernance: localeGovernanceJsonPath,
    },
  });
}
