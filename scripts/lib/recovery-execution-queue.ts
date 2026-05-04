import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { RecoveryControlBoardReport, RecoveryControlItem } from './recovery-control-board';
import type { RecoveryScorecardReport } from './recovery-scorecard';

export const DEFAULT_RECOVERY_EXECUTION_QUEUE_MD_PATH = 'reports/seo/latest-recovery-execution-queue.md';
export const DEFAULT_RECOVERY_EXECUTION_QUEUE_JSON_PATH = 'reports/seo/latest-recovery-execution-queue.json';
export const DEFAULT_RECOVERY_CONTROL_BOARD_JSON_PATH = 'reports/seo/latest-recovery-control-board.json';
export const DEFAULT_RECOVERY_SCORECARD_JSON_PATH = 'reports/seo/latest-recovery-scorecard.json';
export const DEFAULT_COVERAGE_OTHER_AUDIT_JSON_PATH = 'reports/seo/latest-coverage-other-audit.json';
export const DEFAULT_SOURCE_FILE_AUDIT_JSON_PATH = 'reports/seo/latest-coverage-source-file-audit.json';
export const DEFAULT_MISSING_CLUSTER_AUDIT_JSON_PATH = 'reports/seo/latest-404-missing-cluster-audit.json';

export type RecoveryExecutionQueueStatus = 'ready' | 'blocked' | 'watch';
export type RecoveryExecutionLane =
  | 'measurement'
  | 'canonicalization'
  | 'metadata'
  | 'internal-linking'
  | 'content-refresh'
  | 'triage'
  | 'monitoring';
export type RecoveryInterventionType =
  | 'refresh-input'
  | 'canonical-fix'
  | 'metadata-tightening'
  | 'internal-link-fix'
  | 'content-refresh'
  | 'diagnostic-review'
  | 'removal-execution'
  | 'monitoring';
export type RecoveryExecutionPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type RecoveryExecutionQueueItem = {
  id: string;
  title: string;
  queueStatus: RecoveryExecutionQueueStatus;
  priority: RecoveryExecutionPriority;
  lane: RecoveryExecutionLane;
  intervention: RecoveryInterventionType;
  sourceLens: string;
  sourceStatus: string;
  sourceTitle: string;
  score: number;
  summary: string;
  rationale: string;
  action: string;
  successSignal: string;
  outcomeNoteTemplate: string;
  blockedBy: string[];
  evidence: string[];
};

export type RecoveryExecutionQueueReport = {
  generatedAt: string;
  overallStatus: 'active' | 'blocked' | 'watch';
  headline: string;
  readyCount: number;
  blockedCount: number;
  watchCount: number;
  items: RecoveryExecutionQueueItem[];
  nextActions: string[];
};

type RecoveryExecutionQueueFileOptions = {
  controlBoardJsonPath?: string;
  scorecardJsonPath?: string;
  coverageOtherAuditJsonPath?: string;
  sourceFileAuditJsonPath?: string;
  missingClusterAuditJsonPath?: string;
};

type CoverageOtherAuditReport = {
  totalRows?: number;
  sourceGeneratedAt?: string;
  actionSummary?: Array<{ action?: string; count?: number }>;
  executionSummary?: {
    exactRemoval410Count?: number;
    exactRemovalCoveredByRuntimeCount?: number;
    exactRemovalCoveredByRulesCount?: number;
    exactRemovalNeedsMaterializationCount?: number;
    redirectValidationCount?: number;
    redirectCoveredByRuntimeCount?: number;
    redirectCoveredByMiddlewareCount?: number;
    redirectCoveredByRulesCount?: number;
    redirectNeedsValidationCount?: number;
    observeCount?: number;
    manualReviewCount?: number;
  };
  reasonBreakdown?: Array<{ reason?: string; count?: number }>;
  nextActions?: string[];
};

type MissingClusterAuditReport = {
  generatedAt?: string;
  totalRows?: number;
  summary?: {
    restore?: number;
    redirect?: number;
    redirectCoveredByMiddleware?: number;
    keep410?: number;
    manualReview?: number;
  };
  manualReviewBreakdown?: Array<{
    workstream?: string;
    count?: number;
    summary?: string;
  }>;
};

type SourceFileAuditReport = {
  totalRows?: number;
  sourceGeneratedAt?: string;
  actionSummary?: Array<{ action?: string; count?: number }>;
  executionSummary?: {
    exactRemoval410Count?: number;
    exactRemovalCoveredByRuntimeCount?: number;
    exactRemovalCoveredByRulesCount?: number;
    exactRemovalNeedsMaterializationCount?: number;
    redirectValidationCount?: number;
    redirectCoveredByRuntimeCount?: number;
    redirectCoveredByMiddlewareCount?: number;
    redirectCoveredByRulesCount?: number;
    redirectNeedsValidationCount?: number;
    observeCount?: number;
    manualReviewCount?: number;
  };
  reasonBreakdown?: Array<{ reason?: string; count?: number }>;
  nextActions?: string[];
};

function toAbsolutePath(path: string): string {
  return resolve(process.cwd(), path);
}

function readJsonFile<T>(path: string): T | null {
  const absolutePath = toAbsolutePath(path);
  if (!existsSync(absolutePath)) return null;
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as T;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function formatInteger(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-US').format(value || 0);
}

function joinSentenceParts(parts: string[]): string {
  if (parts.length <= 1) return parts[0] || '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

function describeManualWorkstream(workstream: string): string {
  switch (workstream) {
    case 'promote_noindex_target':
      return 'noindex-promotion cases';
    case 'resolve_multi_skill_repo_root':
      return 'multi-skill repo-root cases';
    case 'resolve_route_mismatch':
      return 'route-mismatch cases';
    case 'confirm_repo_structure':
      return 'repo-structure confirmation cases';
    default:
      return `${workstream} cases`;
  }
}

function statusOrder(status: RecoveryExecutionQueueStatus): number {
  switch (status) {
    case 'ready':
      return 3;
    case 'blocked':
      return 2;
    case 'watch':
      return 1;
  }
}

function priorityRank(priority: RecoveryExecutionPriority): number {
  switch (priority) {
    case 'P0':
      return 4;
    case 'P1':
      return 3;
    case 'P2':
      return 2;
    case 'P3':
      return 1;
  }
}

function classifyPriority(score: number, queueStatus: RecoveryExecutionQueueStatus): RecoveryExecutionPriority {
  if (queueStatus === 'watch') return 'P3';
  if (score >= 5000) return 'P0';
  if (score >= 500) return 'P1';
  if (score >= 50) return 'P2';
  return 'P3';
}

function classifyClusterExecution(
  item: RecoveryControlItem,
  coverageOtherAudit?: CoverageOtherAuditReport | null,
  sourceFileAudit?: SourceFileAuditReport | null,
  missingClusterAudit?: MissingClusterAuditReport | null,
): {
  queueStatus: RecoveryExecutionQueueStatus;
  lane: RecoveryExecutionLane;
  intervention: RecoveryInterventionType;
  blockedBy: string[];
} {
  const normalizedId = item.id.toLowerCase();

  if (normalizedId.includes('trailing_slash')) {
    return {
      queueStatus: 'ready',
      lane: 'canonicalization',
      intervention: 'canonical-fix',
      blockedBy: [],
    };
  }

  if (normalizedId.includes('query_parameter')) {
    return {
      queueStatus: 'ready',
      lane: 'canonicalization',
      intervention: 'canonical-fix',
      blockedBy: [],
    };
  }

  if (normalizedId.includes('repeated_segment') || normalizedId.includes('deep_skill_path')) {
    return {
      queueStatus: 'ready',
      lane: 'canonicalization',
      intervention: 'canonical-fix',
      blockedBy: [],
    };
  }

  if (normalizedId.includes('source_file_path')) {
    const hasStructuredSourceFilePlan =
      Number(sourceFileAudit?.executionSummary?.exactRemoval410Count || 0) > 0 ||
      Number(sourceFileAudit?.executionSummary?.redirectValidationCount || 0) > 0 ||
      Number(sourceFileAudit?.executionSummary?.observeCount || 0) > 0 ||
      Number(sourceFileAudit?.executionSummary?.manualReviewCount || 0) > 0;
    return {
      queueStatus: 'ready',
      lane: 'triage',
      intervention: hasStructuredSourceFilePlan ? 'removal-execution' : 'diagnostic-review',
      blockedBy: [],
    };
  }

  if (
    normalizedId.includes('other') &&
    ((Number(coverageOtherAudit?.totalRows || 0) > 0 &&
      String(coverageOtherAudit?.sourceGeneratedAt || '').trim().length > 0) ||
      (Number(missingClusterAudit?.totalRows || 0) > 0 &&
        String(missingClusterAudit?.generatedAt || '').trim().length > 0))
  ) {
    return {
      queueStatus: 'ready',
      lane: 'triage',
      intervention: 'removal-execution',
      blockedBy: [],
    };
  }

  return {
    queueStatus: 'blocked',
    lane: 'triage',
    intervention: 'diagnostic-review',
    blockedBy: ['Cluster remains ambiguous until a fresher Coverage Drilldown export is ingested.'],
  };
}

function classifyExecution(
  item: RecoveryControlItem,
  coverageOtherAudit?: CoverageOtherAuditReport | null,
  sourceFileAudit?: SourceFileAuditReport | null,
  missingClusterAudit?: MissingClusterAuditReport | null,
): {
  queueStatus: RecoveryExecutionQueueStatus;
  lane: RecoveryExecutionLane;
  intervention: RecoveryInterventionType;
  blockedBy: string[];
} {
  if (item.status === 'recovered') {
    return {
      queueStatus: 'watch',
      lane: 'monitoring',
      intervention: 'monitoring',
      blockedBy: [],
    };
  }

  if (item.lens === 'cluster') {
    return classifyClusterExecution(item, coverageOtherAudit, sourceFileAudit, missingClusterAudit);
  }

  if (item.lens === 'query' || item.lens === 'page') {
    return {
      queueStatus: item.status === 'blocked' ? 'blocked' : 'ready',
      lane: 'metadata',
      intervention: 'metadata-tightening',
      blockedBy:
        item.status === 'blocked' ? ['Traffic evidence is not strong enough to rank this surface confidently.'] : [],
    };
  }

  if (item.lens === 'locale') {
    return {
      queueStatus: item.status === 'blocked' ? 'blocked' : 'ready',
      lane: 'internal-linking',
      intervention: 'internal-link-fix',
      blockedBy: item.status === 'blocked' ? ['Locale-level evidence is still incomplete.'] : [],
    };
  }

  return {
    queueStatus: item.status === 'blocked' ? 'blocked' : 'watch',
    lane: 'triage',
    intervention: 'diagnostic-review',
    blockedBy: item.status === 'blocked' ? ['Source surface still needs clearer evidence.'] : [],
  };
}

function successSignalForItem(
  queueStatus: RecoveryExecutionQueueStatus,
  lane: RecoveryExecutionLane,
  item: RecoveryControlItem,
): string {
  if (queueStatus === 'watch') {
    return 'Next reporting cycle shows the surface remains stable without introducing new crawl, canonical, or traffic regressions.';
  }

  if (lane === 'canonicalization') {
    return 'Next Coverage Drilldown export shows the target cluster shrinking and no new canonical drift appears for the same trap.';
  }

  if (lane === 'metadata') {
    return 'The next GSC period shows stronger CTR or more qualified impressions for the targeted page/query surface.';
  }

  if (lane === 'internal-linking') {
    return 'The next GSC period shows the locale stabilizing while governed internal links reinforce the intended landing pages.';
  }

  if (lane === 'measurement') {
    return 'A regenerated repo-local artifact exists and the missing freshness or evidence prerequisite is no longer blocking the queue.';
  }

  if (lane === 'monitoring') {
    return 'The monitored signal stays within target thresholds through the next scheduled reporting cycle.';
  }

  return `A later reporting cycle confirms the intervention clarified the state of "${item.title}".`;
}

function outcomeTemplateForItem(item: RecoveryControlItem, lane: RecoveryExecutionLane): string {
  return [`Surface: ${item.title}`, `Lane: ${lane}`, 'Change shipped:', 'Observed result:', 'Follow-up decision:'].join(
    '\n',
  );
}

function itemRationale(item: RecoveryControlItem, queueStatus: RecoveryExecutionQueueStatus): string {
  if (queueStatus === 'ready') {
    return 'The control board already provides a concrete, high-confidence next move, so this item is ready for execution rather than another diagnosis pass.';
  }

  if (queueStatus === 'blocked') {
    return 'The control board shows real risk here, but a prerequisite is still missing or the cluster remains too ambiguous for a confident intervention.';
  }

  return 'This surface is not the current execution bottleneck and should stay under observation rather than enter the active queue.';
}

function countCoverageOtherReason(
  coverageOtherAudit: CoverageOtherAuditReport | null | undefined,
  reason: string,
): number {
  return coverageOtherAudit?.reasonBreakdown?.find((item) => String(item?.reason || '').trim() === reason)?.count || 0;
}

function countCoverageOtherAction(
  coverageOtherAudit: CoverageOtherAuditReport | null | undefined,
  action: 'gone_410' | 'redirect_301' | 'observe' | 'manual_review',
): number {
  return coverageOtherAudit?.actionSummary?.find((item) => String(item?.action || '').trim() === action)?.count || 0;
}

function countSourceFileReason(sourceFileAudit: SourceFileAuditReport | null | undefined, reason: string): number {
  return sourceFileAudit?.reasonBreakdown?.find((item) => String(item?.reason || '').trim() === reason)?.count || 0;
}

function countSourceFileAction(
  sourceFileAudit: SourceFileAuditReport | null | undefined,
  action: 'gone_410' | 'redirect_301' | 'observe' | 'manual_review',
): number {
  return sourceFileAudit?.actionSummary?.find((item) => String(item?.action || '').trim() === action)?.count || 0;
}

function controlItemToQueueItem(
  item: RecoveryControlItem,
  coverageOtherAudit?: CoverageOtherAuditReport | null,
  sourceFileAudit?: SourceFileAuditReport | null,
  missingClusterAudit?: MissingClusterAuditReport | null,
): RecoveryExecutionQueueItem {
  const classification = classifyExecution(item, coverageOtherAudit, sourceFileAudit, missingClusterAudit);
  const isOtherCluster = item.id.toLowerCase().includes('cluster-other');
  const isSourceFileCluster = item.id.toLowerCase().includes('cluster-source_file_path');
  const missingRows = Number(missingClusterAudit?.totalRows || 0);
  const restoreCount = Number(missingClusterAudit?.summary?.restore || 0);
  const redirectCount = Number(missingClusterAudit?.summary?.redirect || 0);
  const redirectCoveredByMiddlewareCount = Number(missingClusterAudit?.summary?.redirectCoveredByMiddleware || 0);
  const redirectNeedsValidationCount = Math.max(0, redirectCount - redirectCoveredByMiddlewareCount);
  const keep410Count = Number(missingClusterAudit?.summary?.keep410 || 0);
  const manualReviewCount = Number(missingClusterAudit?.summary?.manualReview || 0);
  const manualWorkstreamBreakdown = (missingClusterAudit?.manualReviewBreakdown || [])
    .filter((item) => Number(item?.count || 0) > 0 && String(item?.workstream || '').trim().length > 0)
    .map((item) => `${formatInteger(item.count)} ${describeManualWorkstream(String(item.workstream || '').trim())}`);
  const hasMissingClusterSplit = isOtherCluster && missingRows > 0;
  const otherRows = Number(coverageOtherAudit?.totalRows || 0);
  const otherExactRemovalCount =
    Number(coverageOtherAudit?.executionSummary?.exactRemoval410Count || 0) ||
    countCoverageOtherAction(coverageOtherAudit, 'gone_410');
  const otherExactRemovalCoveredByRuntimeCount = Number(
    coverageOtherAudit?.executionSummary?.exactRemovalCoveredByRuntimeCount || 0,
  );
  const otherExactRemovalNeedsMaterializationCount =
    Number(coverageOtherAudit?.executionSummary?.exactRemovalNeedsMaterializationCount || 0) ||
    Math.max(0, otherExactRemovalCount - otherExactRemovalCoveredByRuntimeCount);
  const otherRedirectCount =
    Number(coverageOtherAudit?.executionSummary?.redirectValidationCount || 0) ||
    countCoverageOtherAction(coverageOtherAudit, 'redirect_301');
  const otherRedirectCoveredByRuntimeCount =
    Number(coverageOtherAudit?.executionSummary?.redirectCoveredByRuntimeCount || 0) ||
    Number(coverageOtherAudit?.executionSummary?.redirectCoveredByMiddlewareCount || 0);
  const otherRedirectCoveredByMiddlewareCount = Number(
    coverageOtherAudit?.executionSummary?.redirectCoveredByMiddlewareCount || 0,
  );
  const otherRedirectCoveredByRulesCount = Number(
    coverageOtherAudit?.executionSummary?.redirectCoveredByRulesCount || 0,
  );
  const otherRedirectNeedsValidationCount =
    Number(coverageOtherAudit?.executionSummary?.redirectNeedsValidationCount || 0) ||
    Math.max(0, otherRedirectCount - otherRedirectCoveredByRuntimeCount);
  const otherObserveCount =
    Number(coverageOtherAudit?.executionSummary?.observeCount || 0) ||
    countCoverageOtherAction(coverageOtherAudit, 'observe');
  const otherManualReviewCount =
    Number(coverageOtherAudit?.executionSummary?.manualReviewCount || 0) ||
    countCoverageOtherAction(coverageOtherAudit, 'manual_review');
  const blockedBySitemapCount = countCoverageOtherReason(coverageOtherAudit, 'blocked_by_sitemap');
  const missingFromSitemapAndCacheCount = countCoverageOtherReason(
    coverageOtherAudit,
    'missing_from_sitemap_and_cache',
  );
  const hasStructuredOtherClusterPlan =
    otherExactRemovalCount > 0 || otherRedirectCount > 0 || otherObserveCount > 0 || otherManualReviewCount > 0;
  const hasOtherClusterPlan = isOtherCluster && otherRows > 0 && hasStructuredOtherClusterPlan;
  const sourceFileRows = Number(sourceFileAudit?.totalRows || 0);
  const sourceFileExactRemovalCount =
    Number(sourceFileAudit?.executionSummary?.exactRemoval410Count || 0) ||
    countSourceFileAction(sourceFileAudit, 'gone_410');
  const sourceFileExactRemovalCoveredByRuntimeCount = Number(
    sourceFileAudit?.executionSummary?.exactRemovalCoveredByRuntimeCount || 0,
  );
  const sourceFileExactRemovalNeedsMaterializationCount =
    Number(sourceFileAudit?.executionSummary?.exactRemovalNeedsMaterializationCount || 0) ||
    Math.max(0, sourceFileExactRemovalCount - sourceFileExactRemovalCoveredByRuntimeCount);
  const sourceFileRedirectCount =
    Number(sourceFileAudit?.executionSummary?.redirectValidationCount || 0) ||
    countSourceFileAction(sourceFileAudit, 'redirect_301');
  const sourceFileRedirectCoveredByRuntimeCount =
    Number(sourceFileAudit?.executionSummary?.redirectCoveredByRuntimeCount || 0) ||
    Number(sourceFileAudit?.executionSummary?.redirectCoveredByMiddlewareCount || 0);
  const sourceFileRedirectCoveredByMiddlewareCount = Number(
    sourceFileAudit?.executionSummary?.redirectCoveredByMiddlewareCount || 0,
  );
  const sourceFileRedirectCoveredByRulesCount = Number(
    sourceFileAudit?.executionSummary?.redirectCoveredByRulesCount || 0,
  );
  const sourceFileRedirectNeedsValidationCount =
    Number(sourceFileAudit?.executionSummary?.redirectNeedsValidationCount || 0) ||
    Math.max(0, sourceFileRedirectCount - sourceFileRedirectCoveredByRuntimeCount);
  const sourceFileObserveCount =
    Number(sourceFileAudit?.executionSummary?.observeCount || 0) || countSourceFileAction(sourceFileAudit, 'observe');
  const sourceFileManualReviewCount =
    Number(sourceFileAudit?.executionSummary?.manualReviewCount || 0) ||
    countSourceFileAction(sourceFileAudit, 'manual_review');
  const sourceFileCrawlTrapCount = countSourceFileReason(sourceFileAudit, 'crawl_trap_or_invalid_public_route');
  const sourceFileRepoSingleRedirectCount = countSourceFileReason(sourceFileAudit, 'repo_single_skill_redirect');
  const sourceFileNestedParentRedirectCount = countSourceFileReason(sourceFileAudit, 'nested_skill_parent_redirect');
  const hasStructuredSourceFilePlan =
    sourceFileExactRemovalCount > 0 ||
    sourceFileRedirectCount > 0 ||
    sourceFileObserveCount > 0 ||
    sourceFileManualReviewCount > 0;
  const hasSourceFileClusterPlan = isSourceFileCluster && sourceFileRows > 0 && hasStructuredSourceFilePlan;
  const splitActionParts = [
    `keep ${formatInteger(keep410Count)} missing samples at 410`,
    ...(redirectNeedsValidationCount > 0
      ? [`validate ${formatInteger(redirectNeedsValidationCount)} explicit 301 candidates`]
      : []),
    ...(redirectCoveredByMiddlewareCount > 0
      ? [
          `verify ${formatInteger(redirectCoveredByMiddlewareCount)} middleware-covered repo-root redirects after deploy`,
        ]
      : []),
    ...(restoreCount > 0 ? [`restore ${formatInteger(restoreCount)} publishable URLs`] : []),
    ...(manualReviewCount > 0 ? [`manually review ${formatInteger(manualReviewCount)} remaining samples`] : []),
  ];
  const splitSummaryParts = [
    `${formatInteger(keep410Count)} should stay 410`,
    ...(redirectCount > 0
      ? [
          redirectCoveredByMiddlewareCount > 0
            ? `${formatInteger(redirectCount)} are redirect candidates (${formatInteger(redirectCoveredByMiddlewareCount)} already covered by middleware)`
            : `${formatInteger(redirectCount)} are redirect candidates`,
        ]
      : []),
    ...(restoreCount > 0 ? [`${formatInteger(restoreCount)} should be restored`] : []),
    ...(manualReviewCount > 0 ? [`${formatInteger(manualReviewCount)} still need manual review`] : []),
  ];
  const priority = classifyPriority(item.score, classification.queueStatus);
  const summary = hasOtherClusterPlan
    ? `${formatInteger(otherRows)} sampled other-cluster URLs are now classified: ${formatInteger(otherExactRemovalCount)} exact-removal / 410, ${formatInteger(otherRedirectCount)} redirect validations, ${formatInteger(otherObserveCount)} recrawl-watch${otherManualReviewCount > 0 ? `, ${formatInteger(otherManualReviewCount)} manual-review` : ''}. Dominant reasons are blocked_by_sitemap (${formatInteger(blockedBySitemapCount)}) and missing_from_sitemap_and_cache (${formatInteger(missingFromSitemapAndCacheCount)}).`
    : hasSourceFileClusterPlan
      ? `${formatInteger(sourceFileRows)} sampled source_file_path URLs are now classified: ${formatInteger(sourceFileExactRemovalCount)} exact-removal / 410, ${formatInteger(sourceFileRedirectCount)} redirect validations${sourceFileObserveCount > 0 ? `, ${formatInteger(sourceFileObserveCount)} recrawl-watch` : ''}${sourceFileManualReviewCount > 0 ? `, ${formatInteger(sourceFileManualReviewCount)} manual-review` : ''}. Dominant reasons are crawl_trap_or_invalid_public_route (${formatInteger(sourceFileCrawlTrapCount)}), repo_single_skill_redirect (${formatInteger(sourceFileRepoSingleRedirectCount)}), and nested_skill_parent_redirect (${formatInteger(sourceFileNestedParentRedirectCount)}).`
      : hasMissingClusterSplit
        ? `Missing-from-sitemap-and-cache is now split: among ${formatInteger(missingRows)} sampled URLs, ${joinSentenceParts(splitSummaryParts)}.`
        : item.summary;
  const successSignal = hasOtherClusterPlan
    ? 'The next Coverage Drilldown export shows blocked_by_sitemap and missing_from_sitemap_and_cache shrinking materially, while validated redirect buckets stay live and recrawl-watch URLs stop resurfacing as 404 noise.'
    : hasSourceFileClusterPlan
      ? 'The next Coverage Drilldown export shows source_file_path shrinking materially, while parent-skill redirects keep resolving to canonical skill URLs and no new source-file traps are emitted into the public graph.'
      : hasMissingClusterSplit
        ? 'The next Coverage Drilldown export shows missing_from_sitemap_and_cache shrinking materially without new business routes being pushed into 410.'
        : successSignalForItem(classification.queueStatus, classification.lane, item);
  const outcomeNoteTemplate = hasOtherClusterPlan
    ? [
        'Other-cluster rows reviewed:',
        'Exact-removal / 410 batch processed:',
        'Redirects revalidated:',
        'Recrawl-watch rows left untouched:',
        'Manual review remainder:',
      ].join('\n')
    : hasSourceFileClusterPlan
      ? [
          'Source-file rows reviewed:',
          'Exact-removal / 410 batch processed:',
          'Redirects revalidated:',
          'Recrawl-watch rows left untouched:',
          'Manual review remainder:',
        ].join('\n')
      : hasMissingClusterSplit
        ? [
            'Missing-cluster rows reviewed:',
            '410 kept:',
            '301 candidates validated:',
            'Restore candidates shipped:',
            'Manual review remainder:',
          ].join('\n')
        : outcomeTemplateForItem(item, classification.lane);
  const action = hasOtherClusterPlan
    ? [
        `Execute the other-cluster batch: keep ${formatInteger(otherExactRemovalCount)} URLs on the exact-removal / 410 track${otherExactRemovalNeedsMaterializationCount > 0 ? ` and materialize or verify ${formatInteger(otherExactRemovalNeedsMaterializationCount)} uncovered removals` : ''}, ${otherRedirectNeedsValidationCount > 0 ? `validate ${formatInteger(otherRedirectNeedsValidationCount)} uncovered redirect candidates` : `keep ${formatInteger(otherRedirectCount)} runtime-covered redirects live`}, and leave ${formatInteger(otherObserveCount)} sitemap-backed URLs in recrawl watch.`,
        otherRedirectCoveredByRuntimeCount > 0
          ? `Current redirect runtime coverage: ${formatInteger(otherRedirectCoveredByRuntimeCount)} (middleware=${formatInteger(otherRedirectCoveredByMiddlewareCount)}, materialized_rule=${formatInteger(otherRedirectCoveredByRulesCount)}).`
          : '',
        `Use ${DEFAULT_COVERAGE_OTHER_AUDIT_JSON_PATH.replace('.json', '.csv')} as the operator list.`,
        hasMissingClusterSplit
          ? `Use ${DEFAULT_MISSING_CLUSTER_AUDIT_JSON_PATH} to confirm the ${formatInteger(missingRows)} missing_from_sitemap_and_cache rows stay on the keep-410 path${manualWorkstreamBreakdown.length > 0 ? ` and to work ${joinSentenceParts(manualWorkstreamBreakdown)}` : ''}.`
          : (coverageOtherAudit?.nextActions || []).slice(0, 1)[0] || '',
      ]
        .filter(Boolean)
        .join(' ')
    : hasSourceFileClusterPlan
      ? [
          `Execute the source-file batch: keep ${formatInteger(sourceFileExactRemovalCount)} URLs on the exact-removal / 410 track${sourceFileExactRemovalNeedsMaterializationCount > 0 ? ` and materialize or verify ${formatInteger(sourceFileExactRemovalNeedsMaterializationCount)} uncovered removals` : ''}.`,
          sourceFileRedirectNeedsValidationCount > 0 && sourceFileRedirectCoveredByRuntimeCount > 0
            ? `Validate ${formatInteger(sourceFileRedirectNeedsValidationCount)} explicit 301 candidates and verify ${formatInteger(sourceFileRedirectCoveredByRuntimeCount)} runtime-covered redirects after deploy (middleware=${formatInteger(sourceFileRedirectCoveredByMiddlewareCount)}, materialized_rule=${formatInteger(sourceFileRedirectCoveredByRulesCount)}).`
            : sourceFileRedirectNeedsValidationCount > 0
              ? `Validate ${formatInteger(sourceFileRedirectNeedsValidationCount)} redirect candidates before relying on recrawl alone.`
              : sourceFileRedirectCoveredByRuntimeCount > 0
                ? `Keep ${formatInteger(sourceFileRedirectCoveredByRuntimeCount)} runtime-covered redirects live (middleware=${formatInteger(sourceFileRedirectCoveredByMiddlewareCount)}, materialized_rule=${formatInteger(sourceFileRedirectCoveredByRulesCount)}).`
                : '',
          sourceFileObserveCount > 0
            ? `Leave ${formatInteger(sourceFileObserveCount)} source-file URLs in recrawl watch.`
            : '',
          sourceFileManualReviewCount > 0
            ? `Work ${formatInteger(sourceFileManualReviewCount)} manual-review source-file rows before expanding the redirect ruleset.`
            : '',
          `Use ${DEFAULT_SOURCE_FILE_AUDIT_JSON_PATH.replace('.json', '.csv')} as the operator list.`,
        ]
          .filter(Boolean)
          .join(' ')
      : hasMissingClusterSplit
        ? [
            `Execute the missing-cluster split: ${joinSentenceParts(splitActionParts)}.`,
            manualWorkstreamBreakdown.length > 0
              ? `Review ${DEFAULT_MISSING_CLUSTER_AUDIT_JSON_PATH} to work ${joinSentenceParts(manualWorkstreamBreakdown)}.`
              : manualReviewCount > 0
                ? `Review ${DEFAULT_MISSING_CLUSTER_AUDIT_JSON_PATH} to resolve the remaining manual-review cases.`
                : `Review ${DEFAULT_MISSING_CLUSTER_AUDIT_JSON_PATH} to confirm the keep-410 rationale and any deferred promotion candidates.`,
          ].join(' ')
        : item.actions[0] || 'Review this surface and define the next intervention.';
  const evidence = hasOtherClusterPlan
    ? dedupeStrings([
        ...item.evidence,
        `otherRows=${formatInteger(otherRows)}`,
        `exactRemoval410=${formatInteger(otherExactRemovalCount)}`,
        ...(otherExactRemovalCoveredByRuntimeCount > 0
          ? [`exactRemovalRuntimeCovered=${formatInteger(otherExactRemovalCoveredByRuntimeCount)}`]
          : []),
        ...(otherExactRemovalNeedsMaterializationCount > 0
          ? [`exactRemovalNeedsMaterialization=${formatInteger(otherExactRemovalNeedsMaterializationCount)}`]
          : []),
        `redirect=${formatInteger(otherRedirectCount)}`,
        ...(otherRedirectCoveredByRuntimeCount > 0
          ? [`redirectRuntimeCovered=${formatInteger(otherRedirectCoveredByRuntimeCount)}`]
          : []),
        ...(otherRedirectCoveredByMiddlewareCount > 0
          ? [`redirectCoveredByMiddleware=${formatInteger(otherRedirectCoveredByMiddlewareCount)}`]
          : []),
        ...(otherRedirectCoveredByRulesCount > 0
          ? [`redirectCoveredByRules=${formatInteger(otherRedirectCoveredByRulesCount)}`]
          : []),
        ...(otherRedirectNeedsValidationCount > 0
          ? [`redirectNeedsValidation=${formatInteger(otherRedirectNeedsValidationCount)}`]
          : []),
        `observe=${formatInteger(otherObserveCount)}`,
        ...(otherManualReviewCount > 0 ? [`manualReview=${formatInteger(otherManualReviewCount)}`] : []),
        `blockedBySitemap=${formatInteger(blockedBySitemapCount)}`,
        `missingFromSitemapAndCache=${formatInteger(missingFromSitemapAndCacheCount)}`,
        ...(hasMissingClusterSplit ? [`missingClusterSplit=${formatInteger(missingRows)}`] : []),
      ])
    : hasSourceFileClusterPlan
      ? dedupeStrings([
          ...item.evidence,
          `sourceFileRows=${formatInteger(sourceFileRows)}`,
          `exactRemoval410=${formatInteger(sourceFileExactRemovalCount)}`,
          ...(sourceFileExactRemovalCoveredByRuntimeCount > 0
            ? [`exactRemovalRuntimeCovered=${formatInteger(sourceFileExactRemovalCoveredByRuntimeCount)}`]
            : []),
          ...(sourceFileExactRemovalNeedsMaterializationCount > 0
            ? [`exactRemovalNeedsMaterialization=${formatInteger(sourceFileExactRemovalNeedsMaterializationCount)}`]
            : []),
          `redirect=${formatInteger(sourceFileRedirectCount)}`,
          ...(sourceFileRedirectCoveredByRuntimeCount > 0
            ? [`redirectRuntimeCovered=${formatInteger(sourceFileRedirectCoveredByRuntimeCount)}`]
            : []),
          ...(sourceFileRedirectCoveredByMiddlewareCount > 0
            ? [`redirectCoveredByMiddleware=${formatInteger(sourceFileRedirectCoveredByMiddlewareCount)}`]
            : []),
          ...(sourceFileRedirectCoveredByRulesCount > 0
            ? [`redirectCoveredByRules=${formatInteger(sourceFileRedirectCoveredByRulesCount)}`]
            : []),
          ...(sourceFileRedirectNeedsValidationCount > 0
            ? [`redirectNeedsValidation=${formatInteger(sourceFileRedirectNeedsValidationCount)}`]
            : []),
          ...(sourceFileObserveCount > 0 ? [`observe=${formatInteger(sourceFileObserveCount)}`] : []),
          ...(sourceFileManualReviewCount > 0 ? [`manualReview=${formatInteger(sourceFileManualReviewCount)}`] : []),
          `crawlTrap=${formatInteger(sourceFileCrawlTrapCount)}`,
          `repoSingleSkillRedirect=${formatInteger(sourceFileRepoSingleRedirectCount)}`,
          `nestedSkillParentRedirect=${formatInteger(sourceFileNestedParentRedirectCount)}`,
        ])
      : hasMissingClusterSplit
        ? dedupeStrings([
            ...item.evidence,
            `missingClusterSplit=${formatInteger(missingRows)}`,
            `keep410=${formatInteger(keep410Count)}`,
            `redirect=${formatInteger(redirectCount)}`,
            ...(redirectCoveredByMiddlewareCount > 0
              ? [`redirectCoveredByMiddleware=${formatInteger(redirectCoveredByMiddlewareCount)}`]
              : []),
            `restore=${formatInteger(restoreCount)}`,
            `manualReview=${formatInteger(manualReviewCount)}`,
            ...(manualWorkstreamBreakdown.length > 0
              ? [`manualReviewWorkstreams=${manualWorkstreamBreakdown.join('; ')}`]
              : []),
          ])
        : item.evidence;

  return {
    id: item.id,
    title: item.title,
    queueStatus: classification.queueStatus,
    priority,
    lane: classification.lane,
    intervention: classification.intervention,
    sourceLens: item.lens,
    sourceStatus: item.status,
    sourceTitle: item.title,
    score: item.score,
    summary,
    rationale: itemRationale(item, classification.queueStatus),
    action,
    successSignal,
    outcomeNoteTemplate,
    blockedBy: classification.blockedBy,
    evidence,
  };
}

function buildMeasurementCoverageItem(scorecard: RecoveryScorecardReport): RecoveryExecutionQueueItem | null {
  const freshnessStatus = String(scorecard.coverage.metrics.sourceFreshnessStatus || '')
    .trim()
    .toLowerCase();
  if (!['blocking', 'warning', 'missing'].includes(freshnessStatus)) return null;

  const action =
    scorecard.nextActions.find((item) => item.toLowerCase().includes('coverage drilldown')) ||
    'Ingest the newest Coverage Drilldown export(s) and rerun the coverage report.';

  return {
    id: 'measurement-refresh-coverage-drilldown',
    title: 'Refresh Coverage Drilldown raw exports',
    queueStatus: 'blocked',
    priority: 'P0',
    lane: 'measurement',
    intervention: 'refresh-input',
    sourceLens: 'coverage',
    sourceStatus: scorecard.coverage.status,
    sourceTitle: scorecard.coverage.label,
    score: 9999,
    summary: scorecard.coverage.observed,
    rationale:
      'The queue cannot fully trust cluster prioritization until fresh raw Coverage Drilldown exports are present locally.',
    action,
    successSignal:
      'latest-coverage-drilldown.json reports a freshest raw export inside the 7-day SLA and the control board can re-rank cluster items against fresh evidence.',
    outcomeNoteTemplate: [
      'Raw export date:',
      'Issue buckets:',
      'Dominant cluster:',
      'Queue impact after refresh:',
    ].join('\n'),
    blockedBy: [
      'Fresh local Coverage Drilldown exports are not available in the repo-local archive or the Downloads ingest lane.',
    ],
    evidence: dedupeStrings([scorecard.coverage.summary, ...scorecard.coverage.notes]).slice(0, 4),
  };
}

function buildCrawlWatchItem(scorecard: RecoveryScorecardReport): RecoveryExecutionQueueItem | null {
  if (scorecard.crawl.status !== 'clear') return null;

  const action =
    scorecard.nextActions.find((item) => item.toLowerCase().includes('crawl loop')) ||
    'Keep the main-domain crawl loop running daily until the current streak remains stable.';

  return {
    id: 'watch-main-domain-crawl-health',
    title: 'Keep crawl health under watch',
    queueStatus: 'watch',
    priority: 'P3',
    lane: 'monitoring',
    intervention: 'monitoring',
    sourceLens: 'crawl',
    sourceStatus: scorecard.crawl.status,
    sourceTitle: scorecard.crawl.label,
    score: 0,
    summary: scorecard.crawl.observed,
    rationale:
      'Crawl health is currently stable, so the correct move is disciplined monitoring rather than a new intervention.',
    action,
    successSignal: 'The next scheduled crawl-health report keeps 4xx <= 0.2%, 5xx = 0, and Cloudflare 1102 = 0.',
    outcomeNoteTemplate: ['Report date:', 'Observed 4xx/5xx/1102:', 'Regression detected:', 'Follow-up decision:'].join(
      '\n',
    ),
    blockedBy: [],
    evidence: dedupeStrings([scorecard.crawl.summary, ...scorecard.crawl.notes]).slice(0, 4),
  };
}

function buildQueueItems(
  controlBoard: RecoveryControlBoardReport,
  scorecard: RecoveryScorecardReport,
  coverageOtherAudit?: CoverageOtherAuditReport | null,
  sourceFileAudit?: SourceFileAuditReport | null,
  missingClusterAudit?: MissingClusterAuditReport | null,
): RecoveryExecutionQueueItem[] {
  const derivedItems = controlBoard.items.map((item) =>
    controlItemToQueueItem(item, coverageOtherAudit, sourceFileAudit, missingClusterAudit),
  );
  const supplementalItems = [buildMeasurementCoverageItem(scorecard), buildCrawlWatchItem(scorecard)].filter(
    (item): item is RecoveryExecutionQueueItem => Boolean(item),
  );

  return [...supplementalItems, ...derivedItems].sort((a, b) => {
    const statusDelta = statusOrder(b.queueStatus) - statusOrder(a.queueStatus);
    if (statusDelta !== 0) return statusDelta;

    const priorityDelta = priorityRank(b.priority) - priorityRank(a.priority);
    if (priorityDelta !== 0) return priorityDelta;

    return b.score - a.score;
  });
}

export function buildRecoveryExecutionQueueReport(input: {
  controlBoard: RecoveryControlBoardReport;
  scorecard: RecoveryScorecardReport;
  coverageOtherAudit?: CoverageOtherAuditReport | null;
  sourceFileAudit?: SourceFileAuditReport | null;
  missingClusterAudit?: MissingClusterAuditReport | null;
}): RecoveryExecutionQueueReport {
  const items = buildQueueItems(
    input.controlBoard,
    input.scorecard,
    input.coverageOtherAudit,
    input.sourceFileAudit,
    input.missingClusterAudit,
  );
  const readyCount = items.filter((item) => item.queueStatus === 'ready').length;
  const blockedCount = items.filter((item) => item.queueStatus === 'blocked').length;
  const watchCount = items.filter((item) => item.queueStatus === 'watch').length;
  const overallStatus = readyCount > 0 ? 'active' : blockedCount > 0 ? 'blocked' : 'watch';
  const nextActions = dedupeStrings([
    ...items
      .filter((item) => item.queueStatus !== 'watch')
      .slice(0, 8)
      .map((item) => item.action),
    ...input.scorecard.nextActions,
  ]).slice(0, 8);

  return {
    generatedAt: new Date().toISOString(),
    overallStatus,
    headline:
      'Recovery execution queue converts the ranked control board into concrete ready, blocked, and watch interventions with explicit success signals.',
    readyCount,
    blockedCount,
    watchCount,
    items,
    nextActions,
  };
}

export function renderRecoveryExecutionQueueReport(report: RecoveryExecutionQueueReport): string {
  const readyItems = report.items.filter((item) => item.queueStatus === 'ready');
  const blockedItems = report.items.filter((item) => item.queueStatus === 'blocked');
  const watchItems = report.items.filter((item) => item.queueStatus === 'watch');

  const renderSection = (title: string, items: RecoveryExecutionQueueItem[]): string[] => {
    if (items.length === 0) {
      return [`## ${title}`, '', 'No items in this lane.', ''];
    }

    const lines = [`## ${title}`, ''];

    for (const item of items) {
      lines.push(`1. ${item.title}`);
      lines.push(`   - Queue status: ${item.queueStatus}`);
      lines.push(`   - Priority: ${item.priority}`);
      lines.push(`   - Lane: ${item.lane}`);
      lines.push(`   - Intervention: ${item.intervention}`);
      lines.push(`   - Source: ${item.sourceLens} | ${item.sourceTitle}`);
      lines.push(`   - Summary: ${item.summary}`);
      lines.push(`   - Rationale: ${item.rationale}`);
      lines.push(`   - Action: ${item.action}`);
      lines.push(`   - Success signal: ${item.successSignal}`);
      if (item.blockedBy.length > 0) {
        lines.push(`   - Blocked by: ${item.blockedBy.join(' | ')}`);
      }
      if (item.evidence.length > 0) {
        lines.push(`   - Evidence: ${item.evidence.join(' | ')}`);
      }
      lines.push('   - Outcome note template:');
      for (const line of item.outcomeNoteTemplate.split('\n')) {
        lines.push(`     ${line}`);
      }
      lines.push('');
    }

    return lines;
  };

  return [
    '# Recovery Execution Queue',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Overall status: ${report.overallStatus}`,
    `- Ready items: ${report.readyCount}`,
    `- Blocked items: ${report.blockedCount}`,
    `- Watch items: ${report.watchCount}`,
    '',
    '## Headline',
    '',
    report.headline,
    '',
    ...renderSection('Ready Interventions', readyItems),
    ...renderSection('Blocked Interventions', blockedItems),
    ...renderSection('Watch Interventions', watchItems),
    '## Next Actions',
    '',
    ...(report.nextActions.length > 0
      ? report.nextActions.map((action, index) => `${index + 1}. ${action}`)
      : ['1. No follow-up actions.']),
    '',
  ].join('\n');
}

export function writeRecoveryExecutionQueueArtifacts(
  report: RecoveryExecutionQueueReport,
  options: {
    markdownOutputPath?: string;
    jsonOutputPath?: string;
  } = {},
): void {
  const markdownOutputPath = options.markdownOutputPath || DEFAULT_RECOVERY_EXECUTION_QUEUE_MD_PATH;
  const jsonOutputPath = options.jsonOutputPath || DEFAULT_RECOVERY_EXECUTION_QUEUE_JSON_PATH;
  const markdownAbsolutePath = toAbsolutePath(markdownOutputPath);
  const jsonAbsolutePath = toAbsolutePath(jsonOutputPath);

  mkdirSync(dirname(markdownAbsolutePath), { recursive: true });
  mkdirSync(dirname(jsonAbsolutePath), { recursive: true });

  writeFileSync(markdownAbsolutePath, `${renderRecoveryExecutionQueueReport(report)}\n`, 'utf8');
  writeFileSync(jsonAbsolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

export function buildRecoveryExecutionQueueFromFiles(
  options: RecoveryExecutionQueueFileOptions = {},
): RecoveryExecutionQueueReport {
  const controlBoardJsonPath = options.controlBoardJsonPath || DEFAULT_RECOVERY_CONTROL_BOARD_JSON_PATH;
  const scorecardJsonPath = options.scorecardJsonPath || DEFAULT_RECOVERY_SCORECARD_JSON_PATH;
  const coverageOtherAuditJsonPath = options.coverageOtherAuditJsonPath || DEFAULT_COVERAGE_OTHER_AUDIT_JSON_PATH;
  const sourceFileAuditJsonPath = options.sourceFileAuditJsonPath || DEFAULT_SOURCE_FILE_AUDIT_JSON_PATH;
  const missingClusterAuditJsonPath = options.missingClusterAuditJsonPath || DEFAULT_MISSING_CLUSTER_AUDIT_JSON_PATH;

  const controlBoard = readJsonFile<RecoveryControlBoardReport>(controlBoardJsonPath);
  const scorecard = readJsonFile<RecoveryScorecardReport>(scorecardJsonPath);
  const coverageOtherAudit = readJsonFile<CoverageOtherAuditReport>(coverageOtherAuditJsonPath);
  const sourceFileAudit = readJsonFile<SourceFileAuditReport>(sourceFileAuditJsonPath);
  const missingClusterAudit = readJsonFile<MissingClusterAuditReport>(missingClusterAuditJsonPath);

  if (!controlBoard) {
    throw new Error(`Missing recovery control board artifact: ${controlBoardJsonPath}`);
  }

  if (!scorecard) {
    throw new Error(`Missing recovery scorecard artifact: ${scorecardJsonPath}`);
  }

  return buildRecoveryExecutionQueueReport({
    controlBoard,
    scorecard,
    coverageOtherAudit,
    sourceFileAudit,
    missingClusterAudit,
  });
}
