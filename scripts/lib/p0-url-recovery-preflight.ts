import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const DEFAULT_P0_URL_RECOVERY_PREFLIGHT_MD_PATH = 'reports/seo/latest-p0-url-recovery-preflight.md';
export const DEFAULT_P0_URL_RECOVERY_PREFLIGHT_JSON_PATH = 'reports/seo/latest-p0-url-recovery-preflight.json';
export const DEFAULT_COVERAGE_DRILLDOWN_JSON_PATH = 'reports/seo/latest-coverage-drilldown.json';
export const DEFAULT_RECOVERY_EXECUTION_QUEUE_JSON_PATH = 'reports/seo/latest-recovery-execution-queue.json';
export const DEFAULT_COVERAGE_OTHER_AUDIT_JSON_PATH = 'reports/seo/latest-coverage-other-audit.json';
export const DEFAULT_SOURCE_FILE_AUDIT_JSON_PATH = 'reports/seo/latest-coverage-source-file-audit.json';
export const DEFAULT_MISSING_CLUSTER_AUDIT_JSON_PATH = 'reports/seo/latest-404-missing-cluster-audit.json';

export type P0UrlRecoveryPreflightStatus = 'ready' | 'blocked';

export type P0UrlRecoveryBatch = {
  id: string;
  title: string;
  priority: string;
  queueStatus: string;
  lane: string;
  intervention: string;
  action: string;
  successSignal: string;
  counts: Record<string, number>;
  evidence: string[];
};

export type P0UrlRecoveryPreflightReport = {
  generatedAt: string;
  status: P0UrlRecoveryPreflightStatus;
  headline: string;
  coverageGate: {
    status: string;
    sourceDate: string | null;
    ageDays: number | null;
    maxWindowDays: number | null;
    canExecute: boolean;
  };
  batches: P0UrlRecoveryBatch[];
  blockers: string[];
  nextActions: string[];
  verificationCommands: string[];
};

type CoverageDrilldownJson = {
  sourceFreshnessStatus?: string;
  sourceFreshnessDate?: string | null;
  sourceFreshnessDays?: number | null;
  sourceMaxWindowDays?: number | null;
};

type RecoveryExecutionQueueJson = {
  items?: Array<{
    id?: string;
    title?: string;
    priority?: string;
    queueStatus?: string;
    lane?: string;
    intervention?: string;
    action?: string;
    successSignal?: string;
    evidence?: string[];
  }>;
};

type CoverageAuditJson = {
  totalRows?: number;
  actionSummary?: Array<{ action?: string; count?: number }>;
  executionSummary?: Record<string, number | undefined>;
};

type MissingClusterAuditJson = {
  totalRows?: number;
  summary?: Record<string, number | undefined>;
};

type P0UrlRecoveryPreflightInput = {
  generatedAt?: string;
  coverage?: CoverageDrilldownJson | null;
  executionQueue?: RecoveryExecutionQueueJson | null;
  otherAudit?: CoverageAuditJson | null;
  sourceFileAudit?: CoverageAuditJson | null;
  missingClusterAudit?: MissingClusterAuditJson | null;
};

type P0UrlRecoveryPreflightFileOptions = {
  coverageJsonPath?: string;
  executionQueueJsonPath?: string;
  otherAuditJsonPath?: string;
  sourceFileAuditJsonPath?: string;
  missingClusterAuditJsonPath?: string;
};

type P0UrlRecoveryPreflightWriteOptions = {
  markdownOutputPath?: string;
  jsonOutputPath?: string;
};

function toAbsolutePath(path: string): string {
  return resolve(process.cwd(), path);
}

function readJsonFile<T>(path: string): T | null {
  const absolutePath = toAbsolutePath(path);
  if (!existsSync(absolutePath)) return null;
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as T;
}

function compactCounts(values: Record<string, number | undefined>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  );
}

function summarizeAuditCounts(audit: CoverageAuditJson | null | undefined): Record<string, number> {
  const actionCounts = Object.fromEntries(
    (audit?.actionSummary || []).map((item) => [item.action || 'unknown', item.count || 0]),
  );
  return compactCounts({
    totalRows: audit?.totalRows,
    ...actionCounts,
    exactRemoval410: audit?.executionSummary?.exactRemoval410Count,
    exactRemovalRuntimeCovered: audit?.executionSummary?.exactRemovalCoveredByRuntimeCount,
    redirectValidation: audit?.executionSummary?.redirectValidationCount,
    redirectRuntimeCovered: audit?.executionSummary?.redirectCoveredByRuntimeCount,
    redirectCoveredByMiddleware: audit?.executionSummary?.redirectCoveredByMiddlewareCount,
    observe: audit?.executionSummary?.observeCount,
    manualReview: audit?.executionSummary?.manualReviewCount,
  });
}

function summarizeMissingClusterCounts(audit: MissingClusterAuditJson | null | undefined): Record<string, number> {
  return compactCounts({
    totalRows: audit?.totalRows,
    restore: audit?.summary?.restore,
    redirect: audit?.summary?.redirect,
    keep410: audit?.summary?.keep410,
    manualReview: audit?.summary?.manualReview,
  });
}

function buildBatchCounts(
  id: string,
  input: Pick<P0UrlRecoveryPreflightInput, 'otherAudit' | 'sourceFileAudit' | 'missingClusterAudit'>,
): Record<string, number> {
  if (id === 'cluster-other') {
    return {
      ...summarizeAuditCounts(input.otherAudit),
      missingClusterKeep410: input.missingClusterAudit?.summary?.keep410 || 0,
    };
  }
  if (id === 'cluster-source_file_path') return summarizeAuditCounts(input.sourceFileAudit);
  return {};
}

function canExecuteFromCoverage(coverage: CoverageDrilldownJson | null | undefined): boolean {
  const status = String(coverage?.sourceFreshnessStatus || '').toLowerCase();
  return status === 'fresh' || status === 'warning';
}

export function buildP0UrlRecoveryPreflightReport(
  input: P0UrlRecoveryPreflightInput = {},
): P0UrlRecoveryPreflightReport {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const coverageGate = {
    status: input.coverage?.sourceFreshnessStatus || 'missing',
    sourceDate: input.coverage?.sourceFreshnessDate ?? null,
    ageDays: input.coverage?.sourceFreshnessDays ?? null,
    maxWindowDays: input.coverage?.sourceMaxWindowDays ?? null,
    canExecute: canExecuteFromCoverage(input.coverage),
  };

  const p0ReadyItems = (input.executionQueue?.items || []).filter(
    (item) => item.priority === 'P0' && item.queueStatus === 'ready',
  );
  const batches = p0ReadyItems.map<P0UrlRecoveryBatch>((item) => ({
    id: item.id || 'unknown',
    title: item.title || item.id || 'Unknown P0 batch',
    priority: item.priority || 'unknown',
    queueStatus: item.queueStatus || 'unknown',
    lane: item.lane || 'unknown',
    intervention: item.intervention || 'unknown',
    action: item.action || 'No action recorded.',
    successSignal: item.successSignal || 'No success signal recorded.',
    counts: buildBatchCounts(item.id || '', input),
    evidence: (item.evidence || []).slice(0, 12),
  }));

  const blockers: string[] = [];
  if (!coverageGate.canExecute) {
    blockers.push(
      `Coverage freshness is ${coverageGate.status}; latest source ${coverageGate.sourceDate || 'missing'} is ${coverageGate.ageDays ?? 'unknown'} day(s) old, outside the executable freshness gate.`,
    );
  }
  if (batches.length === 0) {
    blockers.push('No ready P0 recovery batches are present in the recovery execution queue.');
  }

  return {
    generatedAt,
    status: blockers.length > 0 ? 'blocked' : 'ready',
    headline:
      blockers.length > 0
        ? `P0 URL recovery preflight is blocked; ${batches.length} ready P0 batch(es) are identified but cannot execute until the gate clears.`
        : `P0 URL recovery preflight is ready with ${batches.length} ready P0 batch(es).`,
    coverageGate,
    batches,
    blockers,
    nextActions: [
      'Import a fresh Coverage Drilldown export and rerun `npm run report:seo:coverage-drilldown`.',
      'Rerun `npm run report:seo:p0-url-recovery-preflight` and confirm the Coverage gate is executable.',
      'Execute only the listed P0 batches first; keep discovery expansion and automation locked until the post-intervention proof window clears.',
    ],
    verificationCommands: [
      'npm run report:seo:coverage-drilldown',
      'npm run report:seo:p0-url-recovery-preflight',
      'npm run report:seo:search-compliance-matrix',
      'npm run report:seo:recovery-proof-window',
    ],
  };
}

export function buildP0UrlRecoveryPreflightReportFromFiles(
  options: P0UrlRecoveryPreflightFileOptions = {},
): P0UrlRecoveryPreflightReport {
  return buildP0UrlRecoveryPreflightReport({
    coverage: readJsonFile<CoverageDrilldownJson>(options.coverageJsonPath || DEFAULT_COVERAGE_DRILLDOWN_JSON_PATH),
    executionQueue: readJsonFile<RecoveryExecutionQueueJson>(
      options.executionQueueJsonPath || DEFAULT_RECOVERY_EXECUTION_QUEUE_JSON_PATH,
    ),
    otherAudit: readJsonFile<CoverageAuditJson>(options.otherAuditJsonPath || DEFAULT_COVERAGE_OTHER_AUDIT_JSON_PATH),
    sourceFileAudit: readJsonFile<CoverageAuditJson>(
      options.sourceFileAuditJsonPath || DEFAULT_SOURCE_FILE_AUDIT_JSON_PATH,
    ),
    missingClusterAudit: readJsonFile<MissingClusterAuditJson>(
      options.missingClusterAuditJsonPath || DEFAULT_MISSING_CLUSTER_AUDIT_JSON_PATH,
    ),
  });
}

export function renderP0UrlRecoveryPreflightReport(report: P0UrlRecoveryPreflightReport): string {
  const lines: string[] = [];
  lines.push('# P0 URL Recovery Preflight');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Status: ${report.status}`);
  lines.push(`- Headline: ${report.headline}`);
  lines.push(`- Coverage gate: ${report.coverageGate.status}`);
  lines.push(`- Coverage source date: ${report.coverageGate.sourceDate || 'missing'}`);
  lines.push(`- Coverage source age: ${report.coverageGate.ageDays ?? 'unknown'} day(s)`);
  lines.push(`- Coverage hard SLA: ${report.coverageGate.maxWindowDays ?? 'unknown'} day(s)`);
  lines.push(`- Executable: ${report.coverageGate.canExecute ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## P0 Batches');
  lines.push('');
  if (report.batches.length === 0) {
    lines.push('- none');
  } else {
    for (const batch of report.batches) {
      lines.push(`- ${batch.id}: ${batch.title}`);
      lines.push(`  - Lane: ${batch.lane}; intervention=${batch.intervention}; status=${batch.queueStatus}`);
      lines.push(`  - Counts: ${JSON.stringify(batch.counts)}`);
      lines.push(`  - Action: ${batch.action}`);
      lines.push(`  - Success signal: ${batch.successSignal}`);
    }
  }
  lines.push('');
  lines.push('## Blockers');
  lines.push('');
  if (report.blockers.length === 0) {
    lines.push('- none');
  } else {
    for (const blocker of report.blockers) lines.push(`- ${blocker}`);
  }
  lines.push('');
  lines.push('## Next Actions');
  lines.push('');
  for (const action of report.nextActions) lines.push(`- ${action}`);
  lines.push('');
  lines.push('## Verification Commands');
  lines.push('');
  for (const command of report.verificationCommands) lines.push(`- \`${command}\``);

  return `${lines.join('\n')}\n`;
}

export function writeP0UrlRecoveryPreflightArtifacts(
  report: P0UrlRecoveryPreflightReport,
  options: P0UrlRecoveryPreflightWriteOptions = {},
): P0UrlRecoveryPreflightReport {
  const markdownPath = options.markdownOutputPath || DEFAULT_P0_URL_RECOVERY_PREFLIGHT_MD_PATH;
  const jsonPath = options.jsonOutputPath || DEFAULT_P0_URL_RECOVERY_PREFLIGHT_JSON_PATH;

  mkdirSync(dirname(toAbsolutePath(markdownPath)), { recursive: true });
  writeFileSync(toAbsolutePath(markdownPath), renderP0UrlRecoveryPreflightReport(report), 'utf8');
  writeFileSync(toAbsolutePath(jsonPath), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return report;
}
