import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  DEFAULT_AI_CONFIG_GUARD_JSON_PATH,
  DEFAULT_AI_CONFIG_GUARD_MD_PATH,
  type AiConfigGuardIssue,
  type AiConfigGuardReport,
} from './ai-config-guard';
import { DEFAULT_AI_PROVIDER_HEALTH_MD_PATH, type AiProviderHealthReport } from './ai-provider-health';
import {
  DEFAULT_AI_PROVIDER_PROBE_JSON_PATH,
  DEFAULT_AI_PROVIDER_PROBE_MD_PATH,
  DEFAULT_AI_PROVIDER_PROBE_TREND_JSON_PATH,
  DEFAULT_AI_PROVIDER_PROBE_TREND_MD_PATH,
} from './ai-provider-probe';
import {
  DEFAULT_CONTENT_GOVERNANCE_MD_PATH,
  type ContentGovernanceCheck,
  type ContentGovernanceReport,
  type ContentGovernanceSeverity,
} from './content-governance';

export const DEFAULT_OPS_SUMMARY_MD_PATH = 'reports/seo/latest-ops-summary.md';
export const DEFAULT_OPS_SUMMARY_JSON_PATH = 'reports/seo/latest-ops-summary.json';
export const DEFAULT_OPS_REMEDIATION_MD_PATH = 'reports/seo/latest-ops-remediation.md';
export const DEFAULT_OPS_REMEDIATION_JSON_PATH = 'reports/seo/latest-ops-remediation.json';
export const DEFAULT_OPS_HANDOFF_MD_PATH = 'reports/seo/latest-ops-handoff.md';
export const DEFAULT_OPS_HANDOFF_JSON_PATH = 'reports/seo/latest-ops-handoff.json';
export const DEFAULT_AI_HEALTH_JSON_PATH = 'reports/seo/latest-ai-provider-health.json';
export const DEFAULT_CONTENT_GOVERNANCE_JSON_PATH = 'reports/seo/latest-content-governance.json';

export type OperatorRemediationSeverity = 'warning' | 'blocking';
export type OperatorRemediationThreshold = OperatorRemediationSeverity | 'none';
export type OperatorSignalStatus = 'clear' | 'warning' | 'blocking' | 'unknown';
export type OperatorRemediationHandoffMode = 'none' | 'issue' | 'pull_request';
export type OperatorRemediationHandoffStatus = 'disabled' | 'ready';
export type OperatorRemediationHandoffState = 'new' | 'repeat' | 'updated';

export type OperatorRemediationItem = {
  id: string;
  source: 'ai_config' | 'ai_health' | 'content_governance';
  code: string;
  severity: OperatorRemediationSeverity;
  title: string;
  summary: string;
  evidencePaths: string[];
  recommendedActions: string[];
  generatedAt: string;
};

export type OperatorRemediationReport = {
  generatedAt: string;
  thresholds: {
    ai: OperatorRemediationThreshold;
    governance: OperatorRemediationThreshold;
  };
  summary: {
    totalItems: number;
    warningItems: number;
    blockingItems: number;
    actionable: boolean;
  };
  items: OperatorRemediationItem[];
};

export type OperatorRemediationHandoffScaffold = {
  id: string;
  mode: Exclude<OperatorRemediationHandoffMode, 'none'>;
  state: OperatorRemediationHandoffState;
  dedupeKey: string;
  fingerprint: string;
  title: string;
  body: string;
  summary: string;
  labels: string[];
  branchName: string | null;
  repository: {
    owner: string;
    repo: string;
    baseBranch: string;
  };
  itemIds: string[];
  evidencePaths: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  repeatCount: number;
};

export type OperatorRemediationHandoffReport = {
  generatedAt: string;
  status: OperatorRemediationHandoffStatus;
  mode: OperatorRemediationHandoffMode;
  disabledReason: string | null;
  repository: {
    owner: string | null;
    repo: string | null;
    baseBranch: string | null;
  };
  labels: string[];
  summary: {
    configured: boolean;
    actionable: boolean;
    totalScaffolds: number;
    newScaffolds: number;
    repeatedScaffolds: number;
    updatedScaffolds: number;
  };
  scaffolds: OperatorRemediationHandoffScaffold[];
};

export type OperatorOpsSummaryReport = {
  generatedAt: string;
  overallStatus: OperatorSignalStatus;
  quiet: boolean;
  aiConfig: {
    status: OperatorSignalStatus;
    issueCount: number;
    reportPaths: string[];
    keyFindings: string[];
  };
  aiHealth: {
    status: OperatorSignalStatus;
    sourceStatus: string | null;
    highestSeverity: string | null;
    blockingAtConfiguredThreshold: boolean;
    configuredThreshold: string | null;
    alertCount: number;
    reportPaths: string[];
    keyFindings: string[];
  };
  contentGovernance: {
    status: OperatorSignalStatus;
    blockingAtConfiguredThreshold: boolean;
    configuredThreshold: string | null;
    checkCount: number;
    reportPaths: string[];
  };
  remediation: OperatorRemediationReport;
  handoff: OperatorRemediationHandoffReport;
};

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function severityRank(
  value: OperatorSignalStatus | OperatorRemediationSeverity | OperatorRemediationThreshold,
): number {
  switch (value) {
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

function mapAiStatus(status: string | null | undefined): OperatorSignalStatus {
  if (status === 'blocking') return 'blocking';
  if (status === 'soft warning' || status === 'warning') return 'warning';
  if (status === 'clear') return 'clear';
  return 'unknown';
}

function mapGovernanceStatus(status: ContentGovernanceSeverity | null | undefined): OperatorSignalStatus {
  if (status === 'blocking') return 'blocking';
  if (status === 'warning') return 'warning';
  if (status === 'clear') return 'clear';
  return 'unknown';
}

function mapAiAlertSeverity(severity: string): OperatorRemediationSeverity {
  return severity === 'critical' ? 'blocking' : 'warning';
}

function mapAiConfigStatus(report: AiConfigGuardReport | null): OperatorSignalStatus {
  if (!report) return 'unknown';
  return report.issues.length > 0 ? 'blocking' : 'clear';
}

function meetsThreshold(severity: OperatorRemediationSeverity, threshold: OperatorRemediationThreshold): boolean {
  if (threshold === 'none') return false;
  return severityRank(severity) >= severityRank(threshold);
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

function hashStable(value: unknown): string {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex');
}

function slugifyFragment(value: string, fallback: string): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function buildHandoffTitle(
  item: OperatorRemediationItem,
  mode: Exclude<OperatorRemediationHandoffMode, 'none'>,
): string {
  if (mode === 'pull_request') {
    return `ops: remediate ${item.title}`;
  }
  return `[OPS][${item.severity.toUpperCase()}] ${item.title}`;
}

function buildHandoffBranchName(item: OperatorRemediationItem): string {
  const source = slugifyFragment(item.source.replace(/_/g, '-'), 'signal');
  const code = slugifyFragment(item.code, 'item');
  return `ops/remediation/${source}-${code}`.slice(0, 120);
}

function buildHandoffBody(
  item: OperatorRemediationItem,
  scaffold: {
    mode: Exclude<OperatorRemediationHandoffMode, 'none'>;
    dedupeKey: string;
    fingerprint: string;
    state: OperatorRemediationHandoffState;
    repository: { owner: string; repo: string; baseBranch: string };
    labels: string[];
    branchName: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
    repeatCount: number;
  },
): string {
  const lines = [
    `<!-- ops-handoff dedupe-key: ${scaffold.dedupeKey} -->`,
    `<!-- ops-handoff fingerprint: ${scaffold.fingerprint} -->`,
    '',
    `## ${scaffold.mode === 'issue' ? 'Issue' : 'PR'} Summary`,
    '',
    item.summary,
    '',
    '## Dedupe Metadata',
    '',
    `- key: ${scaffold.dedupeKey}`,
    `- fingerprint: ${scaffold.fingerprint}`,
    `- state: ${scaffold.state}`,
    `- first seen: ${scaffold.firstSeenAt}`,
    `- last seen: ${scaffold.lastSeenAt}`,
    `- repeat count: ${scaffold.repeatCount}`,
    '',
    '## Repository Target',
    '',
    `- repo: ${scaffold.repository.owner}/${scaffold.repository.repo}`,
    `- base branch: ${scaffold.repository.baseBranch}`,
  ];

  if (scaffold.branchName) {
    lines.push(`- suggested branch: ${scaffold.branchName}`);
  }

  lines.push('', '## Labels', '', `- ${scaffold.labels.join(', ') || 'none'}`, '', '## Evidence', '');

  for (const path of item.evidencePaths) {
    lines.push(`- ${path}`);
  }

  lines.push('', '## Recommended Actions', '');
  for (const action of item.recommendedActions) {
    lines.push(`- ${action}`);
  }

  lines.push(
    '',
    '## Seed Metadata',
    '',
    `- item id: ${item.id}`,
    `- source: ${item.source}`,
    `- severity: ${item.severity}`,
  );
  return lines.join('\n');
}

function readPreviousHandoffReport(path: string): OperatorRemediationHandoffReport | null {
  const absolutePath = resolve(process.cwd(), path);
  if (!existsSync(absolutePath)) return null;

  try {
    const parsed = readJsonFile<OperatorRemediationHandoffReport>(absolutePath);
    return Array.isArray(parsed.scaffolds) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseOperatorRemediationThreshold(raw: string | undefined | null): OperatorRemediationThreshold {
  const normalized = String(raw || '')
    .trim()
    .toLowerCase();
  if (!normalized || normalized === 'none' || normalized === 'off') return 'none';
  if (normalized === 'warning' || normalized === 'blocking') return normalized;
  throw new Error(`Invalid remediation threshold "${raw}". Use warning, blocking, or none.`);
}

export function parseOperatorRemediationHandoffMode(raw: string | undefined | null): OperatorRemediationHandoffMode {
  const normalized = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (!normalized || normalized === 'none' || normalized === 'off' || normalized === 'disabled') {
    return 'none';
  }
  if (normalized === 'issue') return 'issue';
  if (normalized === 'pull_request' || normalized === 'pr') return 'pull_request';
  throw new Error(`Invalid remediation handoff mode "${raw}". Use none, issue, or pull_request.`);
}

function parseOperatorHandoffLabels(raw: string | undefined | null): string[] {
  return dedupeStrings(
    String(raw || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function getAiRecommendedActions(code: string): string[] {
  switch (code) {
    case 'nvidia_instability_window':
      return [
        'Review longer-window NVIDIA label guidance before increasing concurrency.',
        'Inspect whether repeated 429 windows correlate with one specific NVIDIA label.',
        'Keep backup posture explicit; do not widen fallback policy without operator intent.',
      ];
    case 'providers_unavailable':
      return [
        'Inspect the latest runtime summary for cooldown, quarantine, or hard-disable evidence.',
        'Verify fallback policy and backup credentials before restarting unattended runs.',
      ];
    case 'probe_nvidia_unreachable':
      return [
        'Treat NVIDIA primary capacity as unavailable until the direct probe recovers.',
        'Inspect per-key provider probe output to separate 429 pressure from auth or network issues.',
      ];
    case 'probe_backups_unreachable':
      return [
        'Repair SiliconFlow or OpenRouter before assuming guarded fallback is safe.',
        'Use the direct provider probe output to distinguish rate limits from billing or credential issues.',
      ];
    case 'probe_rate_limited_labels':
      return [
        'Reduce traffic toward the rate-limited labels and prefer the healthy NVIDIA labels first.',
        'Keep backup posture conservative until the rate-limited providers recover.',
      ];
    case 'probe_access_issues':
      return [
        'Fix provider credentials or billing before expecting those backups to recover.',
        'Re-run the direct provider probe after secret or balance changes land.',
      ];
    case 'workers_budget_low':
    case 'workers_budget_exhausted':
      return [
        'Reduce Workers AI usage pressure or tighten when Cloudflare is eligible in rotation.',
        'Review whether the current free-only local caps still reflect intended guardrail posture.',
      ];
    default:
      return [
        'Inspect the current AI provider health Markdown and JSON artifacts.',
        'Capture whether this is transient historical noise or a fresh runtime regression.',
      ];
  }
}

function getAiConfigRecommendedActions(code: AiConfigGuardIssue['code']): string[] {
  switch (code) {
    case 'openrouter_free_model_outside_skill_try':
      return [
        'Unset OPENROUTER_MODEL or point it at a non-free model for shared runtime, script, and probe scopes.',
        'Keep free-tier OpenRouter usage isolated to the explicit skill_try allowlist.',
      ];
    case 'invalid_workers_ai_mode':
      return [
        'Set WORKERS_AI_MODE to free-only or disabled before the next unattended run.',
        'Do not rely on undocumented Workers AI modes to widen usage.',
      ];
    case 'invalid_workers_ai_free_model':
      return [
        'Reset WORKERS_AI_FREE_MODEL to an allowlisted free model.',
        'Keep Workers AI on the free-only model list before re-running pipelines.',
      ];
    case 'workers_ai_free_run_cap_too_high':
    case 'workers_ai_free_daily_cap_too_high':
      return [
        'Lower the Workers AI caps back to the enforced free-only ceilings.',
        'Treat cap increases as policy drift unless explicitly re-designed.',
      ];
    case 'invalid_ai_fallback_policy':
      return [
        'Set AI_FALLBACK_POLICY to cold, guarded, or always.',
        'Prefer guarded unless there is a deliberate operator decision to widen fallback behavior.',
      ];
    default:
      return ['Inspect the AI config guard artifact and normalize provider model or Workers AI settings.'];
  }
}

function buildAiConfigEvidencePaths(aiConfigJsonPath: string, aiConfigReport: AiConfigGuardReport | null): string[] {
  if (!aiConfigReport) return [];
  return dedupeStrings([aiConfigJsonPath, DEFAULT_AI_CONFIG_GUARD_MD_PATH]);
}

function buildAiEvidencePaths(aiHealthJsonPath: string, aiHealthReport: AiProviderHealthReport): string[] {
  return dedupeStrings([
    aiHealthJsonPath,
    DEFAULT_AI_PROVIDER_HEALTH_MD_PATH,
    aiHealthReport.directProbe?.available ? DEFAULT_AI_PROVIDER_PROBE_JSON_PATH : '',
    aiHealthReport.directProbe?.available ? DEFAULT_AI_PROVIDER_PROBE_MD_PATH : '',
    (aiHealthReport.directProbeTrend?.sampleCount || 0) > 0 ? DEFAULT_AI_PROVIDER_PROBE_TREND_JSON_PATH : '',
    (aiHealthReport.directProbeTrend?.sampleCount || 0) > 0 ? DEFAULT_AI_PROVIDER_PROBE_TREND_MD_PATH : '',
  ]);
}

function formatProbeTrendLabelFinding(
  entry: {
    label: string;
    provider: string;
    okCount: number;
    appearances: number;
    rateLimitedCount: number;
    billingCount: number;
    authCount: number;
    failureCount: number;
  },
  includeOk: boolean = false,
): string {
  const metrics = [
    includeOk ? `ok=${entry.okCount}/${entry.appearances}` : '',
    entry.rateLimitedCount > 0 ? `429=${entry.rateLimitedCount}` : '',
    entry.billingCount > 0 ? `billing=${entry.billingCount}` : '',
    entry.authCount > 0 ? `auth=${entry.authCount}` : '',
    entry.failureCount > 0 && !includeOk ? `fail=${entry.failureCount}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return `${entry.label}:${entry.provider}${metrics ? ` (${metrics})` : ''}`;
}

function buildAiHealthKeyFindings(aiHealthReport: AiProviderHealthReport): string[] {
  const findings: string[] = [];
  const directProbe = aiHealthReport.directProbe;
  const directProbeTrend = aiHealthReport.directProbeTrend;

  if (directProbe?.available && directProbe.summary && directProbe.targets) {
    const backupTargets = (directProbe.targets.siliconflow || 0) + (directProbe.targets.openrouter || 0);
    findings.push(
      `Latest direct probe: NVIDIA healthy ${directProbe.summary.nvidiaHealthy}/${directProbe.targets.nvidia}, backups healthy ${directProbe.summary.backupHealthy}/${backupTargets}.`,
    );
  }

  if ((directProbeTrend?.frequentRateLimitedLabels || []).length > 0) {
    const hasRepeatedRateLimits = directProbeTrend.frequentRateLimitedLabels.some((entry) => entry.count > 1);
    findings.push(
      `${hasRepeatedRateLimits ? 'Repeated direct-probe 429s' : 'Direct-probe 429 labels in the current window'}: ${directProbeTrend.frequentRateLimitedLabels
        .slice(0, 3)
        .map((entry) => `${entry.label}:${entry.provider} x${entry.count}`)
        .join(', ')}.`,
    );
  }

  const weakBackupTrend = (directProbeTrend?.weakBackups || []).filter(
    (entry) => entry.billingCount > 0 || entry.authCount > 0 || entry.failureCount > 0,
  );
  if (weakBackupTrend.length > 0) {
    findings.push(
      `Weak backup trend: ${weakBackupTrend
        .slice(0, 3)
        .map((entry) => formatProbeTrendLabelFinding(entry))
        .join(', ')}.`,
    );
  }

  const stableNvidia = (directProbeTrend?.stableNvidia || []).filter(
    (entry) => entry.appearances > 0 && entry.okCount === entry.appearances,
  );
  if (stableNvidia.length > 0) {
    findings.push(
      `Most stable NVIDIA labels: ${stableNvidia
        .slice(0, 3)
        .map((entry) => formatProbeTrendLabelFinding(entry, true))
        .join(', ')}.`,
    );
  }

  if (findings.length === 0 && aiHealthReport.operatorControls?.directProbeNote) {
    findings.push(aiHealthReport.operatorControls.directProbeNote);
  }

  return findings.slice(0, 4);
}

function buildAiConfigKeyFindings(aiConfigReport: AiConfigGuardReport | null): string[] {
  if (!aiConfigReport) {
    return ['AI config guard artifact is missing, so model-resolution drift cannot be confirmed from ops summary.'];
  }

  const findings: string[] = [
    `Workers AI guardrail: mode=${aiConfigReport.workersAiMode}, model=${aiConfigReport.workersAiModel}, caps=${aiConfigReport.workersAiMaxCallsPerRun}/run and ${aiConfigReport.workersAiMaxCallsPerDay}/day.`,
    `OpenRouter posture: runtime=${aiConfigReport.providerModels.runtime.openrouter.model}, skill_try=${aiConfigReport.providerModels.skill_try.openrouter.model}, script=${aiConfigReport.providerModels.script.openrouter.model}, probe=${aiConfigReport.providerModels.probe.openrouter.model}.`,
  ];

  if (aiConfigReport.issues.length > 0) {
    findings.push(...aiConfigReport.issues.slice(0, 3).map((issue) => `Config issue: ${issue.message}`));
  }

  return findings.slice(0, 4);
}

function buildAiAlertSummary(aiHealthReport: AiProviderHealthReport, alert: { code: string; detail: string }): string {
  const summaryParts = [alert.detail];
  const directProbeTrend = aiHealthReport.directProbeTrend;

  if (alert.code === 'probe_rate_limited_labels' && (directProbeTrend?.frequentRateLimitedLabels || []).length > 0) {
    summaryParts.push(
      `Trend: ${directProbeTrend.frequentRateLimitedLabels
        .slice(0, 3)
        .map((entry) => `${entry.label}:${entry.provider} x${entry.count}`)
        .join(', ')}.`,
    );
  }

  if (
    (alert.code === 'probe_access_issues' || alert.code === 'probe_backups_unreachable') &&
    (directProbeTrend?.weakBackups || []).length > 0
  ) {
    const weakBackups = directProbeTrend.weakBackups.filter(
      (entry) => entry.billingCount > 0 || entry.authCount > 0 || entry.failureCount > 0,
    );
    if (weakBackups.length > 0) {
      summaryParts.push(
        `Trend: ${weakBackups
          .slice(0, 3)
          .map((entry) => formatProbeTrendLabelFinding(entry))
          .join(', ')}.`,
      );
    }
  }

  if (alert.code === 'nvidia_instability_window') {
    const unstableNvidia = (directProbeTrend?.frequentRateLimitedLabels || []).filter(
      (entry) => entry.provider === 'nvidia',
    );
    if (unstableNvidia.length > 0) {
      summaryParts.push(
        `Direct probe repeats: ${unstableNvidia
          .slice(0, 3)
          .map((entry) => `${entry.label} x${entry.count}`)
          .join(', ')}.`,
      );
    }
  }

  return summaryParts.join(' ');
}

function getGovernanceRecommendedActions(check: ContentGovernanceCheck): string[] {
  switch (check.code) {
    case 'collection_locale_gaps':
      return [
        'Inspect the locale gap items and restore missing supported-locale coverage.',
        'Re-run content governance after localized collection coverage is repaired.',
      ];
    case 'collection_drift':
      return [
        'Inspect collection drift details and repair metadata or canonical inconsistencies.',
        'Re-run content governance after canonical or metadata fixes land.',
      ];
    case 'public_route_contracts':
      return [
        'Open the route contract details and fix the failing localized route or metadata assertions.',
        'Re-run the representative route contract suite before re-enabling unattended promotion.',
      ];
    default:
      return ['Inspect the content governance artifact and repair the failing check.'];
  }
}

export function buildOperatorRemediationReport(options?: {
  aiConfigReport?: AiConfigGuardReport | null;
  aiHealthReport?: AiProviderHealthReport;
  contentGovernanceReport?: ContentGovernanceReport;
  aiThreshold?: OperatorRemediationThreshold;
  governanceThreshold?: OperatorRemediationThreshold;
  generatedAt?: string;
  aiConfigJsonPath?: string;
  aiHealthJsonPath?: string;
  contentGovernanceJsonPath?: string;
}): OperatorRemediationReport {
  const generatedAt = options?.generatedAt || new Date().toISOString();
  const aiThreshold = options?.aiThreshold || 'warning';
  const governanceThreshold = options?.governanceThreshold || 'warning';
  const aiConfigJsonPath = options?.aiConfigJsonPath || DEFAULT_AI_CONFIG_GUARD_JSON_PATH;
  const aiHealthJsonPath = options?.aiHealthJsonPath || DEFAULT_AI_HEALTH_JSON_PATH;
  const contentGovernanceJsonPath = options?.contentGovernanceJsonPath || DEFAULT_CONTENT_GOVERNANCE_JSON_PATH;
  const resolvedAiConfigPath = resolve(process.cwd(), aiConfigJsonPath);
  const aiConfigReport =
    options?.aiConfigReport !== undefined
      ? options.aiConfigReport
      : existsSync(resolvedAiConfigPath)
        ? readJsonFile<AiConfigGuardReport>(resolvedAiConfigPath)
        : null;
  const aiHealthReport =
    options?.aiHealthReport || readJsonFile<AiProviderHealthReport>(resolve(process.cwd(), aiHealthJsonPath));
  const contentGovernanceReport =
    options?.contentGovernanceReport ||
    readJsonFile<ContentGovernanceReport>(resolve(process.cwd(), contentGovernanceJsonPath));
  const aiConfigEvidencePaths = buildAiConfigEvidencePaths(aiConfigJsonPath, aiConfigReport);
  const aiEvidencePaths = buildAiEvidencePaths(aiHealthJsonPath, aiHealthReport);

  const items: OperatorRemediationItem[] = [];

  for (const issue of aiConfigReport?.issues || []) {
    items.push({
      id: `ai-config:${issue.code}`,
      source: 'ai_config',
      code: issue.code,
      severity: 'blocking',
      title: `AI config guard: ${issue.code}`,
      summary: issue.message,
      evidencePaths: aiConfigEvidencePaths,
      recommendedActions: getAiConfigRecommendedActions(issue.code),
      generatedAt,
    });
  }

  for (const alert of aiHealthReport.alerts || []) {
    const severity = mapAiAlertSeverity(alert.severity);
    if (!meetsThreshold(severity, aiThreshold)) continue;
    items.push({
      id: `ai-health:${alert.code}`,
      source: 'ai_health',
      code: alert.code,
      severity,
      title: alert.title,
      summary: buildAiAlertSummary(aiHealthReport, alert),
      evidencePaths: aiEvidencePaths,
      recommendedActions: getAiRecommendedActions(alert.code),
      generatedAt,
    });
  }

  for (const check of contentGovernanceReport.checks || []) {
    const severity = mapGovernanceStatus(check.severity);
    if (severity !== 'warning' && severity !== 'blocking') continue;
    if (!meetsThreshold(severity, governanceThreshold)) continue;
    items.push({
      id: `content-governance:${check.code}`,
      source: 'content_governance',
      code: check.code,
      severity,
      title: check.title,
      summary: check.summary,
      evidencePaths: [contentGovernanceJsonPath, DEFAULT_CONTENT_GOVERNANCE_MD_PATH],
      recommendedActions: getGovernanceRecommendedActions(check),
      generatedAt,
    });
  }

  items.sort((a, b) => {
    const severityDiff = severityRank(b.severity) - severityRank(a.severity);
    if (severityDiff !== 0) return severityDiff;
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.code.localeCompare(b.code);
  });

  const warningItems = items.filter((item) => item.severity === 'warning').length;
  const blockingItems = items.filter((item) => item.severity === 'blocking').length;

  return {
    generatedAt,
    thresholds: {
      ai: aiThreshold,
      governance: governanceThreshold,
    },
    summary: {
      totalItems: items.length,
      warningItems,
      blockingItems,
      actionable: items.length > 0,
    },
    items,
  };
}

export function buildOperatorRemediationHandoffReport(options?: {
  aiConfigReport?: AiConfigGuardReport | null;
  remediationReport?: OperatorRemediationReport;
  aiHealthReport?: AiProviderHealthReport;
  contentGovernanceReport?: ContentGovernanceReport;
  aiThreshold?: OperatorRemediationThreshold;
  governanceThreshold?: OperatorRemediationThreshold;
  generatedAt?: string;
  mode?: OperatorRemediationHandoffMode;
  owner?: string | null;
  repo?: string | null;
  baseBranch?: string | null;
  labels?: string[] | string | null;
  previousHandoffReport?: OperatorRemediationHandoffReport | null;
  previousHandoffJsonPath?: string;
  aiConfigJsonPath?: string;
  aiHealthJsonPath?: string;
  contentGovernanceJsonPath?: string;
}): OperatorRemediationHandoffReport {
  const generatedAt = options?.generatedAt || new Date().toISOString();
  const remediationReport =
    options?.remediationReport ||
    buildOperatorRemediationReport({
      aiConfigReport: options?.aiConfigReport,
      aiHealthReport: options?.aiHealthReport,
      contentGovernanceReport: options?.contentGovernanceReport,
      aiThreshold: options?.aiThreshold,
      governanceThreshold: options?.governanceThreshold,
      generatedAt,
      aiConfigJsonPath: options?.aiConfigJsonPath,
      aiHealthJsonPath: options?.aiHealthJsonPath,
      contentGovernanceJsonPath: options?.contentGovernanceJsonPath,
    });

  const mode = options?.mode || 'none';
  const owner = String(options?.owner || '').trim() || null;
  const repo = String(options?.repo || '').trim() || null;
  const baseBranch = String(options?.baseBranch || '').trim() || 'main';
  const configuredLabels = Array.isArray(options?.labels)
    ? dedupeStrings(options?.labels)
    : parseOperatorHandoffLabels(options?.labels);

  let disabledReason: string | null = null;
  if (mode === 'none') {
    disabledReason = 'handoff_mode_disabled';
  } else if (!owner || !repo) {
    disabledReason = 'handoff_repository_not_configured';
  }

  if (disabledReason) {
    return {
      generatedAt,
      status: 'disabled',
      mode,
      disabledReason,
      repository: {
        owner,
        repo,
        baseBranch: baseBranch || null,
      },
      labels: configuredLabels,
      summary: {
        configured: false,
        actionable: false,
        totalScaffolds: 0,
        newScaffolds: 0,
        repeatedScaffolds: 0,
        updatedScaffolds: 0,
      },
      scaffolds: [],
    };
  }

  const previousReport =
    options?.previousHandoffReport ??
    (options?.previousHandoffJsonPath ? readPreviousHandoffReport(options.previousHandoffJsonPath) : null);
  const previousByKey = new Map((previousReport?.scaffolds || []).map((scaffold) => [scaffold.dedupeKey, scaffold]));

  const scaffolds = remediationReport.items.map((item) => {
    const dedupeKey = `${mode}:${owner}/${repo}:${item.id}`;
    const fingerprint = hashStable({
      id: item.id,
      mode,
      summary: item.summary,
      evidencePaths: item.evidencePaths,
      recommendedActions: item.recommendedActions,
      severity: item.severity,
    });
    const previous = previousByKey.get(dedupeKey);
    const state: OperatorRemediationHandoffState = !previous
      ? 'new'
      : previous.fingerprint === fingerprint
        ? 'repeat'
        : 'updated';
    const repeatCount = previous ? previous.repeatCount + 1 : 1;
    const firstSeenAt = previous?.firstSeenAt || generatedAt;
    const lastSeenAt = generatedAt;
    const labels = dedupeStrings([
      ...configuredLabels,
      'ops-remediation',
      item.source.replace(/_/g, '-'),
      item.severity,
    ]);
    const branchName = mode === 'pull_request' ? buildHandoffBranchName(item) : null;
    const repository = {
      owner: owner!,
      repo: repo!,
      baseBranch,
    };
    const title = buildHandoffTitle(item, mode as Exclude<OperatorRemediationHandoffMode, 'none'>);
    const body = buildHandoffBody(item, {
      mode: mode as Exclude<OperatorRemediationHandoffMode, 'none'>,
      dedupeKey,
      fingerprint,
      state,
      repository,
      labels,
      branchName,
      firstSeenAt,
      lastSeenAt,
      repeatCount,
    });

    return {
      id: `ops-handoff:${mode}:${item.id}`,
      mode: mode as Exclude<OperatorRemediationHandoffMode, 'none'>,
      state,
      dedupeKey,
      fingerprint,
      title,
      body,
      summary: item.summary,
      labels,
      branchName,
      repository,
      itemIds: [item.id],
      evidencePaths: item.evidencePaths.slice(),
      firstSeenAt,
      lastSeenAt,
      repeatCount,
    } satisfies OperatorRemediationHandoffScaffold;
  });

  const newScaffolds = scaffolds.filter((scaffold) => scaffold.state === 'new').length;
  const repeatedScaffolds = scaffolds.filter((scaffold) => scaffold.state === 'repeat').length;
  const updatedScaffolds = scaffolds.filter((scaffold) => scaffold.state === 'updated').length;

  return {
    generatedAt,
    status: 'ready',
    mode,
    disabledReason: null,
    repository: {
      owner,
      repo,
      baseBranch,
    },
    labels: configuredLabels,
    summary: {
      configured: true,
      actionable: scaffolds.length > 0,
      totalScaffolds: scaffolds.length,
      newScaffolds,
      repeatedScaffolds,
      updatedScaffolds,
    },
    scaffolds,
  };
}

export function buildOperatorOpsSummaryReport(options?: {
  aiConfigReport?: AiConfigGuardReport | null;
  aiHealthReport?: AiProviderHealthReport;
  contentGovernanceReport?: ContentGovernanceReport;
  remediationReport?: OperatorRemediationReport;
  handoffReport?: OperatorRemediationHandoffReport;
  aiThreshold?: OperatorRemediationThreshold;
  governanceThreshold?: OperatorRemediationThreshold;
  generatedAt?: string;
  aiConfigJsonPath?: string;
  aiHealthJsonPath?: string;
  contentGovernanceJsonPath?: string;
}): OperatorOpsSummaryReport {
  const generatedAt = options?.generatedAt || new Date().toISOString();
  const aiConfigJsonPath = options?.aiConfigJsonPath || DEFAULT_AI_CONFIG_GUARD_JSON_PATH;
  const aiHealthJsonPath = options?.aiHealthJsonPath || DEFAULT_AI_HEALTH_JSON_PATH;
  const contentGovernanceJsonPath = options?.contentGovernanceJsonPath || DEFAULT_CONTENT_GOVERNANCE_JSON_PATH;
  const resolvedAiConfigPath = resolve(process.cwd(), aiConfigJsonPath);
  const aiConfigReport =
    options?.aiConfigReport !== undefined
      ? options.aiConfigReport
      : existsSync(resolvedAiConfigPath)
        ? readJsonFile<AiConfigGuardReport>(resolvedAiConfigPath)
        : null;
  const aiHealthReport =
    options?.aiHealthReport || readJsonFile<AiProviderHealthReport>(resolve(process.cwd(), aiHealthJsonPath));
  const contentGovernanceReport =
    options?.contentGovernanceReport ||
    readJsonFile<ContentGovernanceReport>(resolve(process.cwd(), contentGovernanceJsonPath));
  const remediationReport =
    options?.remediationReport ||
    buildOperatorRemediationReport({
      aiConfigReport,
      aiHealthReport,
      contentGovernanceReport,
      aiThreshold: options?.aiThreshold,
      governanceThreshold: options?.governanceThreshold,
      generatedAt,
      aiConfigJsonPath,
      aiHealthJsonPath,
      contentGovernanceJsonPath,
    });
  const handoffReport =
    options?.handoffReport ||
    buildOperatorRemediationHandoffReport({
      aiConfigReport,
      remediationReport,
      generatedAt,
      aiConfigJsonPath,
    });

  const aiConfigStatus = mapAiConfigStatus(aiConfigReport);
  const aiStatus = mapAiStatus(aiHealthReport.alertSummary?.status);
  const governanceStatus = mapGovernanceStatus(contentGovernanceReport.severity);
  const remediationStatus: OperatorSignalStatus =
    remediationReport.summary.blockingItems > 0
      ? 'blocking'
      : remediationReport.summary.warningItems > 0
        ? 'warning'
        : 'clear';
  const overallStatus = [aiConfigStatus, aiStatus, governanceStatus, remediationStatus].reduce<OperatorSignalStatus>(
    (current, candidate) => {
      return severityRank(candidate) > severityRank(current) ? candidate : current;
    },
    'clear',
  );
  const aiReportPaths = buildAiEvidencePaths(aiHealthJsonPath, aiHealthReport);

  return {
    generatedAt,
    overallStatus,
    quiet: remediationReport.summary.totalItems === 0,
    aiConfig: {
      status: aiConfigStatus,
      issueCount: aiConfigReport?.issues.length || 0,
      reportPaths: aiConfigReport ? [aiConfigJsonPath, DEFAULT_AI_CONFIG_GUARD_MD_PATH] : [],
      keyFindings: buildAiConfigKeyFindings(aiConfigReport),
    },
    aiHealth: {
      status: aiStatus,
      sourceStatus: aiHealthReport.alertSummary?.status || null,
      highestSeverity: aiHealthReport.alertSummary?.highestSeverity || null,
      blockingAtConfiguredThreshold: aiHealthReport.gate?.blocking || false,
      configuredThreshold: aiHealthReport.gate?.failOnSeverity || null,
      alertCount: aiHealthReport.alerts?.length || 0,
      reportPaths: aiReportPaths,
      keyFindings: buildAiHealthKeyFindings(aiHealthReport),
    },
    contentGovernance: {
      status: governanceStatus,
      blockingAtConfiguredThreshold: contentGovernanceReport.gate?.blocking || false,
      configuredThreshold: contentGovernanceReport.gate?.failOnSeverity || null,
      checkCount: contentGovernanceReport.checks?.length || 0,
      reportPaths: [contentGovernanceJsonPath, DEFAULT_CONTENT_GOVERNANCE_MD_PATH],
    },
    remediation: remediationReport,
    handoff: handoffReport,
  };
}

export function renderOperatorRemediationReport(report: OperatorRemediationReport): string {
  const lines = [
    '# Operator Remediation Seeds',
    '',
    `- Generated: ${report.generatedAt}`,
    `- AI threshold: ${report.thresholds.ai}`,
    `- Governance threshold: ${report.thresholds.governance}`,
    `- Actionable: ${report.summary.actionable ? 'yes' : 'no'}`,
    `- Items: total=${report.summary.totalItems}, blocking=${report.summary.blockingItems}, warning=${report.summary.warningItems}`,
    '',
    '## Seeded Items',
    '',
  ];

  if (report.items.length === 0) {
    lines.push('- No remediation items seeded in the current run.');
    return lines.join('\n');
  }

  for (const item of report.items) {
    lines.push(`- [${item.severity.toUpperCase()}] ${item.id} | ${item.title}`);
    lines.push(`  summary: ${item.summary}`);
    lines.push(`  evidence: ${item.evidencePaths.join(', ')}`);
    lines.push(`  actions: ${item.recommendedActions.join(' ; ')}`);
  }

  return lines.join('\n');
}

export function renderOperatorRemediationHandoffReport(report: OperatorRemediationHandoffReport): string {
  const repositoryTarget =
    report.repository.owner && report.repository.repo
      ? `${report.repository.owner}/${report.repository.repo}${report.repository.baseBranch ? ` @ ${report.repository.baseBranch}` : ''}`
      : 'n/a';

  const lines = [
    '# Operator Remediation Handoff',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Mode: ${report.mode}`,
    `- Disabled reason: ${report.disabledReason || 'n/a'}`,
    `- Repository: ${repositoryTarget}`,
    `- Labels: ${report.labels.join(', ') || 'none'}`,
    `- Configured: ${report.summary.configured ? 'yes' : 'no'}`,
    `- Actionable: ${report.summary.actionable ? 'yes' : 'no'}`,
    `- Scaffolds: total=${report.summary.totalScaffolds}, new=${report.summary.newScaffolds}, repeat=${report.summary.repeatedScaffolds}, updated=${report.summary.updatedScaffolds}`,
    '',
    '## Handoff Scaffolds',
    '',
  ];

  if (report.scaffolds.length === 0) {
    lines.push('- No handoff scaffolds generated in the current run.');
    return lines.join('\n');
  }

  for (const scaffold of report.scaffolds) {
    lines.push(`- [${scaffold.state.toUpperCase()}][${scaffold.mode}] ${scaffold.title}`);
    lines.push(`  dedupe: ${scaffold.dedupeKey}`);
    lines.push(`  repeat count: ${scaffold.repeatCount}`);
    lines.push(`  repo: ${scaffold.repository.owner}/${scaffold.repository.repo} @ ${scaffold.repository.baseBranch}`);
    if (scaffold.branchName) {
      lines.push(`  branch: ${scaffold.branchName}`);
    }
    lines.push(`  labels: ${scaffold.labels.join(', ')}`);
    lines.push(`  evidence: ${scaffold.evidencePaths.join(', ')}`);
  }

  return lines.join('\n');
}

export function renderOperatorOpsSummaryReport(report: OperatorOpsSummaryReport): string {
  const repositoryTarget =
    report.handoff.repository.owner && report.handoff.repository.repo
      ? `${report.handoff.repository.owner}/${report.handoff.repository.repo}${report.handoff.repository.baseBranch ? ` @ ${report.handoff.repository.baseBranch}` : ''}`
      : 'n/a';

  const lines = [
    '# Operator Ops Summary',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Overall status: ${report.overallStatus}`,
    `- Quiet run: ${report.quiet ? 'yes' : 'no'}`,
    '',
    '## AI Config',
    '',
    `- Status: ${report.aiConfig.status}`,
    `- Issues: ${report.aiConfig.issueCount}`,
    `- Reports: ${report.aiConfig.reportPaths.join(', ') || 'n/a'}`,
    ...(report.aiConfig.keyFindings.length > 0
      ? ['', '### AI Config Findings', '', ...report.aiConfig.keyFindings.map((item) => `- ${item}`)]
      : []),
    '',
    '## AI Health',
    '',
    `- Status: ${report.aiHealth.sourceStatus || report.aiHealth.status}`,
    `- Highest severity: ${report.aiHealth.highestSeverity || 'none'}`,
    `- Blocking at configured threshold: ${report.aiHealth.blockingAtConfiguredThreshold ? 'yes' : 'no'}`,
    `- Configured threshold: ${report.aiHealth.configuredThreshold || 'n/a'}`,
    `- Alerts: ${report.aiHealth.alertCount}`,
    `- Reports: ${report.aiHealth.reportPaths.join(', ')}`,
    ...(report.aiHealth.keyFindings.length > 0
      ? ['', '### AI Key Findings', '', ...report.aiHealth.keyFindings.map((item) => `- ${item}`)]
      : []),
    '',
    '## Content Governance',
    '',
    `- Status: ${report.contentGovernance.status}`,
    `- Blocking at configured threshold: ${report.contentGovernance.blockingAtConfiguredThreshold ? 'yes' : 'no'}`,
    `- Configured threshold: ${report.contentGovernance.configuredThreshold || 'n/a'}`,
    `- Checks: ${report.contentGovernance.checkCount}`,
    `- Reports: ${report.contentGovernance.reportPaths.join(', ')}`,
    '',
    '## Remediation',
    '',
    `- Actionable: ${report.remediation.summary.actionable ? 'yes' : 'no'}`,
    `- Items: total=${report.remediation.summary.totalItems}, blocking=${report.remediation.summary.blockingItems}, warning=${report.remediation.summary.warningItems}`,
    '',
    '## Handoff',
    '',
    `- Status: ${report.handoff.status}`,
    `- Mode: ${report.handoff.mode}`,
    `- Disabled reason: ${report.handoff.disabledReason || 'n/a'}`,
    `- Repository: ${repositoryTarget}`,
    `- Labels: ${report.handoff.labels.join(', ') || 'none'}`,
    `- Scaffolds: total=${report.handoff.summary.totalScaffolds}, new=${report.handoff.summary.newScaffolds}, repeat=${report.handoff.summary.repeatedScaffolds}, updated=${report.handoff.summary.updatedScaffolds}`,
    '',
    '## Active Items',
    '',
  ];

  if (report.remediation.items.length === 0) {
    lines.push('- No active remediation items.');
    return lines.join('\n');
  }

  for (const item of report.remediation.items) {
    lines.push(`- [${item.severity.toUpperCase()}] ${item.title} | ${item.summary}`);
  }

  return lines.join('\n');
}

export function writeOperatorOpsArtifacts(
  summary: OperatorOpsSummaryReport,
  remediation: OperatorRemediationReport,
  handoff: OperatorRemediationHandoffReport,
  options?: {
    summaryOutputPath?: string;
    summaryJsonOutputPath?: string;
    remediationOutputPath?: string;
    remediationJsonOutputPath?: string;
    handoffOutputPath?: string;
    handoffJsonOutputPath?: string;
  },
): void {
  const summaryOutputPath = resolve(process.cwd(), options?.summaryOutputPath || DEFAULT_OPS_SUMMARY_MD_PATH);
  const summaryJsonOutputPath = resolve(process.cwd(), options?.summaryJsonOutputPath || DEFAULT_OPS_SUMMARY_JSON_PATH);
  const remediationOutputPath = resolve(
    process.cwd(),
    options?.remediationOutputPath || DEFAULT_OPS_REMEDIATION_MD_PATH,
  );
  const remediationJsonOutputPath = resolve(
    process.cwd(),
    options?.remediationJsonOutputPath || DEFAULT_OPS_REMEDIATION_JSON_PATH,
  );
  const handoffOutputPath = resolve(process.cwd(), options?.handoffOutputPath || DEFAULT_OPS_HANDOFF_MD_PATH);
  const handoffJsonOutputPath = resolve(process.cwd(), options?.handoffJsonOutputPath || DEFAULT_OPS_HANDOFF_JSON_PATH);

  mkdirSync(dirname(summaryOutputPath), { recursive: true });
  mkdirSync(dirname(summaryJsonOutputPath), { recursive: true });
  mkdirSync(dirname(remediationOutputPath), { recursive: true });
  mkdirSync(dirname(remediationJsonOutputPath), { recursive: true });
  mkdirSync(dirname(handoffOutputPath), { recursive: true });
  mkdirSync(dirname(handoffJsonOutputPath), { recursive: true });

  writeFileSync(summaryOutputPath, renderOperatorOpsSummaryReport(summary));
  writeFileSync(summaryJsonOutputPath, JSON.stringify(summary, null, 2));
  writeFileSync(remediationOutputPath, renderOperatorRemediationReport(remediation));
  writeFileSync(remediationJsonOutputPath, JSON.stringify(remediation, null, 2));
  writeFileSync(handoffOutputPath, renderOperatorRemediationHandoffReport(handoff));
  writeFileSync(handoffJsonOutputPath, JSON.stringify(handoff, null, 2));
}
