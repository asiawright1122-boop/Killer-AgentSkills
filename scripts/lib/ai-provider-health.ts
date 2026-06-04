import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { AIBackupPostureProviderName, AIBackupProviderPosture } from '../../src/lib/ai-backup-posture';
import type { AIProviderEvent, AIProviderLabelTelemetry, AIProviderTelemetrySnapshot, BackupProviderName } from './ai';
import { DEFAULT_AI_CONFIG_GUARD_JSON_PATH, type AiConfigGuardReport } from './ai-config-guard';
import type { AIProviderProbeReport, AIProviderProbeResult, AIProviderProbeTrend } from './ai-provider-probe';
import {
  buildAIProviderProbeTrend,
  listAIProviderProbeSamples,
  renderAIProviderProbeTrendReport,
} from './ai-provider-probe';
import {
  loadAiTelemetryCheckpoint,
  renderAiTelemetryReport,
  resolveAiTelemetryCheckpoint,
  type TelemetryCheckpoint,
} from './ai-telemetry-report';
import {
  buildAiTelemetryTrend,
  listAiTelemetrySamples,
  renderAiTelemetryTrendReport,
  type AiTelemetryAlert,
  type AiTelemetryAlertCode,
  type AiTelemetryAlertSeverity,
  type AiTelemetryAlertSummary,
  type AiTelemetryTrend,
  type TelemetrySample,
} from './ai-telemetry-trend';

export const DEFAULT_AI_PROVIDER_HEALTH_MD_PATH = 'reports/seo/latest-ai-provider-health.md';
export const DEFAULT_AI_PROVIDER_HEALTH_JSON_PATH = 'reports/seo/latest-ai-provider-health.json';
export const DEFAULT_AI_TELEMETRY_SUMMARY_MD_PATH = 'reports/seo/latest-ai-telemetry-summary.md';
const DEFAULT_DIRECT_PROBE_STALE_WARNING_HOURS = 24;

export type AiProviderHealthAlertCode =
  | AiTelemetryAlertCode
  | 'probe_nvidia_unreachable'
  | 'probe_backups_unreachable'
  | 'probe_rate_limited_labels'
  | 'probe_access_issues';

export type AiProviderHealthAlert = {
  severity: AiTelemetryAlertSeverity;
  code: AiProviderHealthAlertCode;
  title: string;
  detail: string;
  source: 'telemetry' | 'direct_probe';
};

export type AiProviderHealthGate = {
  failOnSeverity: AiTelemetryAlertSeverity | 'none';
  blocking: boolean;
  blockingAlertCount: number;
  blockingAlertCodes: AiProviderHealthAlertCode[];
  blockingAlertTitles: string[];
};

export type AiProviderHealthLabel = {
  label: string;
  provider: AIProviderLabelTelemetry['provider'];
  selectionRank: number | null;
  successCount: number;
  failureCount: number;
  lastError: string | null;
  flags: string[];
};

export type AiProviderRoutingGuidanceEntry = {
  label: string;
  provider: AIProviderLabelTelemetry['provider'];
  latestRank: number | null;
  averageRank: number | null;
  issueSnapshots: number;
  latestSuccessCount: number;
  latestFailureCount: number;
  latestError: string | null;
  latestFlags: string[];
};

export type AiProviderOperatorControls = {
  routingDecision: NonNullable<AIProviderTelemetrySnapshot['fallbackRouting']>['decision'];
  routingReason: string;
  actionSummary: string;
  currentPressureLabels: NonNullable<AIProviderTelemetrySnapshot['fallbackRouting']>['pressureLabels'];
  historicalPressureLabels: AiProviderRoutingGuidanceEntry[];
  workersAiGuardrail: string | null;
  aiConfigNote: string | null;
  directProbeNote: string | null;
};

export type AiProviderConfigGuardSummary = {
  available: boolean;
  reportPath: string | null;
  status: 'missing' | 'clear' | 'issues';
  issueCount: number;
  fallbackPolicy: string | null;
  workersAiMode: string | null;
  workersAiModel: string | null;
  backupPostures: Record<
    AIBackupPostureProviderName,
    {
      posture: AIBackupProviderPosture | null;
      reason: string | null;
      source: 'default' | 'env' | null;
    }
  >;
  openrouterModels: {
    runtime: string | null;
    translate: string | null;
    skillTry: string | null;
    script: string | null;
    probe: string | null;
  };
  issues: string[];
  rejectedOverrides: string[];
};

export type AiProviderDirectProbeSummary = {
  available: boolean;
  reportPath: string | null;
  generatedAt: string | null;
  ageHours: number | null;
  freshness: 'missing' | 'fresh' | 'stale';
  warningThresholdHours: number;
  summary: AIProviderProbeReport['summary'] | null;
  targets: AIProviderProbeReport['targets'] | null;
  guidance: string[];
  workersAiReason: string | null;
  rateLimitedLabels: string[];
  accessIssueLabels: string[];
  results: AIProviderProbeResult[];
};

export type AiProviderHealthReport = {
  generatedAt: string;
  reportsDir: string;
  checkpointPath: string;
  checkpointStatus: string | null;
  checkpointBatch: number | null;
  checkpointCounts: {
    selected: number;
    completed: number;
    failed: number;
    pending: number;
    skipped: number;
  };
  gate: AiProviderHealthGate;
  alertSummary: AiTelemetryAlertSummary;
  alerts: AiProviderHealthAlert[];
  latestSnapshot: {
    timestamp: string | null;
    availableOrder: string[];
    strongestNvidia: AiProviderHealthLabel[];
    fallbackProviders: AiProviderHealthLabel[];
    fallbackRouting: AIProviderTelemetrySnapshot['fallbackRouting'];
    quarantinedLabels: NonNullable<AIProviderTelemetrySnapshot['quarantinedLabels']>;
    coolingDownProviders: NonNullable<AIProviderTelemetrySnapshot['coolingDownProviders']>;
    hardDisabledProviders: NonNullable<AIProviderTelemetrySnapshot['hardDisabledProviders']>;
    workersAi: AIProviderTelemetrySnapshot['workersAi'];
    recentEvents: AIProviderEvent[];
  };
  telemetry: AIProviderTelemetrySnapshot;
  trend: AiTelemetryTrend;
  aiConfigGuard: AiProviderConfigGuardSummary;
  directProbe: AiProviderDirectProbeSummary;
  directProbeTrend: AIProviderProbeTrend;
  routingGuidance: {
    preferredNvidia: AiProviderRoutingGuidanceEntry[];
    preferredBackups: AiProviderRoutingGuidanceEntry[];
    workersAiNote: string | null;
  };
  operatorControls: AiProviderOperatorControls;
};

function normalizeFallbackRouting(
  snapshot: AIProviderTelemetrySnapshot,
): AIProviderTelemetrySnapshot['fallbackRouting'] {
  const availableProviders = Array.isArray(snapshot.availableProviders) ? snapshot.availableProviders : [];
  const labelStats = Array.isArray(snapshot.labelStats) ? snapshot.labelStats : [];
  const configuredBackupProviders = Array.from(
    new Set(
      labelStats
        .map((entry) => entry.provider)
        .filter((provider): provider is Exclude<typeof provider, 'nvidia'> => !!provider && provider !== 'nvidia'),
    ),
  );
  const legacyRouting: AIProviderTelemetrySnapshot['fallbackRouting'] = {
    policy: snapshot.mode?.fallbackPolicy || 'cold',
    workloadProfile: 'balanced',
    backupPriorityOrder: configuredBackupProviders,
    backupsAllowed: false,
    activationReason: null,
    decision: 'providers_exhausted',
    decisionReason: 'Legacy snapshot is missing routing decision metadata.',
    nvidiaConfigured:
      availableProviders.some((entry) => entry.provider === 'nvidia') ||
      labelStats.some((entry) => entry.provider === 'nvidia'),
    nvidiaAvailable: availableProviders.some((entry) => entry.provider === 'nvidia'),
    configuredBackupProviders,
    eligibleBackupProviders: availableProviders
      .filter((entry): entry is typeof entry & { provider: BackupProviderName } => entry.provider !== 'nvidia')
      .map((entry) => ({ label: entry.label, provider: entry.provider })),
    pressureLabels: [],
    recentActivations: (snapshot.recentEvents || [])
      .filter(
        (event) => event.type === 'fallback_activated' && event.provider && event.provider !== 'nvidia' && event.label,
      )
      .map((event) => ({
        timestamp: event.timestamp,
        provider: event.provider as BackupProviderName,
        label: event.label!,
        reason: event.detail,
        policy: snapshot.mode?.fallbackPolicy || 'cold',
        attempt: event.attempt ?? null,
      })),
  };

  if (!snapshot.fallbackRouting) return legacyRouting;

  return {
    ...legacyRouting,
    ...snapshot.fallbackRouting,
    workloadProfile: snapshot.fallbackRouting.workloadProfile || legacyRouting.workloadProfile,
    backupPriorityOrder:
      Array.isArray(snapshot.fallbackRouting.backupPriorityOrder) &&
      snapshot.fallbackRouting.backupPriorityOrder.length > 0
        ? snapshot.fallbackRouting.backupPriorityOrder
        : legacyRouting.backupPriorityOrder,
    configuredBackupProviders:
      Array.isArray(snapshot.fallbackRouting.configuredBackupProviders) &&
      snapshot.fallbackRouting.configuredBackupProviders.length > 0
        ? snapshot.fallbackRouting.configuredBackupProviders
        : legacyRouting.configuredBackupProviders,
    eligibleBackupProviders: Array.isArray(snapshot.fallbackRouting.eligibleBackupProviders)
      ? snapshot.fallbackRouting.eligibleBackupProviders
      : legacyRouting.eligibleBackupProviders,
    pressureLabels: Array.isArray(snapshot.fallbackRouting.pressureLabels)
      ? snapshot.fallbackRouting.pressureLabels
      : [],
    recentActivations: Array.isArray(snapshot.fallbackRouting.recentActivations)
      ? snapshot.fallbackRouting.recentActivations
      : legacyRouting.recentActivations,
  };
}

function normalizeWorkersAi(snapshot: AIProviderTelemetrySnapshot): AIProviderTelemetrySnapshot['workersAi'] {
  return {
    ...snapshot.workersAi,
    status:
      snapshot.workersAi?.status ||
      (snapshot.workersAi?.canUse === false
        ? snapshot.workersAi?.runRemaining === 0
          ? 'run_cap_reached'
          : snapshot.workersAi?.dailyRemaining === 0
            ? 'daily_cap_reached'
            : 'disabled'
        : 'available'),
    blockedReason: snapshot.workersAi?.blockedReason || null,
  };
}

function countSelected(checkpoint: TelemetryCheckpoint): number {
  if (typeof checkpoint.selectedCount === 'number' && Number.isFinite(checkpoint.selectedCount)) {
    return checkpoint.selectedCount;
  }

  const ids = new Set<string>();
  for (const id of checkpoint.completedIds || []) ids.add(id);
  for (const id of checkpoint.pendingIds || []) ids.add(id);
  for (const id of checkpoint.skippedIds || []) ids.add(id);
  for (const item of checkpoint.failedIds || []) ids.add(item.id);
  return ids.size;
}

function normalizeRank(selectionRank: number | null): number {
  return typeof selectionRank === 'number' && Number.isFinite(selectionRank) ? selectionRank : Number.MAX_SAFE_INTEGER;
}

function isPolicyParkedBackupLabel(
  entry: AIProviderLabelTelemetry,
  fallbackRouting: AIProviderTelemetrySnapshot['fallbackRouting'],
): boolean {
  if (
    entry.provider === 'nvidia' ||
    entry.currentlyAvailable ||
    entry.coolingDown ||
    entry.quarantined ||
    entry.hardDisabled
  ) {
    return false;
  }

  return !!fallbackRouting &&
    fallbackRouting.backupsAllowed === false &&
    Array.isArray(fallbackRouting.configuredBackupProviders)
    ? fallbackRouting.configuredBackupProviders.includes(entry.provider)
    : false;
}

function buildDirectProbeFlags(probe: AiProviderDirectProbeSummary): Map<string, string[]> {
  const flags = new Map<string, string[]>();

  for (const result of probe.results) {
    if (result.ok || result.failureClass === 'ok') continue;
    const key = `${result.label}:${result.provider}`;
    const current = flags.get(key) || [];
    if (result.failureClass === 'billing_error') current.push('probe-billing-error');
    else if (result.failureClass === 'auth_error') current.push('probe-auth-error');
    else if (result.failureClass === 'rate_limited') current.push('probe-rate-limited');
    else current.push(`probe-${result.failureClass}`);
    flags.set(key, current);
  }

  return flags;
}

function summarizeLabel(
  entry: AIProviderLabelTelemetry,
  fallbackRouting: AIProviderTelemetrySnapshot['fallbackRouting'],
  directProbeFlags: Map<string, string[]>,
): AiProviderHealthLabel {
  const flags: string[] = [];
  if (entry.quarantined) flags.push(`quarantined=${entry.quarantineReason || 'yes'}`);
  if (entry.coolingDown) flags.push(`cooldown=${entry.cooldownReason || 'active'}`);
  if (entry.hardDisabled) flags.push(`hard-disabled=${entry.hardDisableReason || 'yes'}`);
  if (!entry.currentlyAvailable) {
    flags.push(isPolicyParkedBackupLabel(entry, fallbackRouting) ? 'policy-parked' : 'unavailable');
  }
  flags.push(...(directProbeFlags.get(`${entry.label}:${entry.provider}`) || []));

  return {
    label: entry.label,
    provider: entry.provider,
    selectionRank:
      typeof entry.selectionRank === 'number' && Number.isFinite(entry.selectionRank) ? entry.selectionRank : null,
    successCount: entry.successCount,
    failureCount: entry.failureCount,
    lastError: entry.lastError,
    flags,
  };
}

function summarizeRoutingGuidance(
  entry: AiTelemetryTrend['strongestNvidia'][number] | AiTelemetryTrend['fallbackProviders'][number],
): AiProviderRoutingGuidanceEntry {
  const averageRank = entry.rankCount > 0 ? Number((entry.rankSum / entry.rankCount).toFixed(2)) : null;
  return {
    label: entry.label,
    provider: entry.provider,
    latestRank: entry.latestRank,
    averageRank,
    issueSnapshots: entry.issueSnapshots,
    latestSuccessCount: entry.latestSuccessCount,
    latestFailureCount: entry.latestFailureCount,
    latestError: entry.latestError,
    latestFlags: entry.latestFlags,
  };
}

function sortLabels(
  entries: AIProviderLabelTelemetry[],
  fallbackRouting: AIProviderTelemetrySnapshot['fallbackRouting'],
  directProbeFlags: Map<string, string[]>,
  provider?: AIProviderLabelTelemetry['provider'],
): AiProviderHealthLabel[] {
  return entries
    .filter((entry) => (provider ? entry.provider === provider : true))
    .sort((a, b) => {
      const rankDiff = normalizeRank(a.selectionRank) - normalizeRank(b.selectionRank);
      if (rankDiff !== 0) return rankDiff;
      if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
      return a.label.localeCompare(b.label);
    })
    .map((entry) => summarizeLabel(entry, fallbackRouting, directProbeFlags));
}

function fallbackSamplesFromCheckpoint(
  checkpointPath: string,
  checkpoint: TelemetryCheckpoint,
  generatedAt: string,
): TelemetrySample[] {
  const timestamp =
    checkpoint.aiTelemetry?.timestamp ||
    checkpoint.lastUpdated ||
    checkpoint.completedAt ||
    checkpoint.startedAt ||
    generatedAt;

  return [
    {
      checkpointPath,
      checkpoint,
      timestamp,
      mtimeMs: Date.now(),
    },
  ];
}

function parseIsoTimestamp(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function summarizeHealthAlerts(alerts: AiProviderHealthAlert[]): AiTelemetryAlertSummary {
  const warningCount = alerts.filter((alert) => alert.severity === 'warning').length;
  const criticalCount = alerts.filter((alert) => alert.severity === 'critical').length;
  return {
    total: alerts.length,
    warningCount,
    criticalCount,
    highestSeverity: criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'none',
    status: criticalCount > 0 ? 'blocking' : warningCount > 0 ? 'soft warning' : 'clear',
  };
}

function sortHealthAlerts(alerts: AiProviderHealthAlert[]): AiProviderHealthAlert[] {
  return [...alerts].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.title.localeCompare(b.title);
  });
}

function resolveAiConfigGuardSummary(reportsDir: string, inputPath?: string): AiProviderConfigGuardSummary {
  const reportPath = inputPath
    ? resolve(process.cwd(), inputPath)
    : resolve(join(reportsDir, 'latest-ai-config-guard.json'));

  if (!existsSync(reportPath)) {
    return {
      available: false,
      reportPath: null,
      status: 'missing',
      issueCount: 0,
      fallbackPolicy: null,
      workersAiMode: null,
      workersAiModel: null,
      backupPostures: {
        siliconflow: { posture: null, reason: null, source: null },
        openrouter: { posture: null, reason: null, source: null },
        cloudflare: { posture: null, reason: null, source: null },
      },
      openrouterModels: {
        runtime: null,
        translate: null,
        skillTry: null,
        script: null,
        probe: null,
      },
      issues: [],
      rejectedOverrides: [],
    };
  }

  try {
    const report = JSON.parse(readFileSync(reportPath, 'utf-8')) as AiConfigGuardReport;
    const skillTryRejected = report.providerModels?.skill_try?.openrouter?.rejectedOverride;
    const rejectedOverrides = [
      skillTryRejected ? `skill_try.openrouter rejected ${skillTryRejected.envKey}=${skillTryRejected.model}` : '',
    ].filter(Boolean);

    return {
      available: true,
      reportPath,
      status: report.issues.length > 0 ? 'issues' : 'clear',
      issueCount: report.issues.length,
      fallbackPolicy: report.fallbackPolicy || null,
      workersAiMode: report.workersAiMode || null,
      workersAiModel: report.workersAiModel || null,
      backupPostures: {
        siliconflow: {
          posture: report.backupProviderPostures?.siliconflow?.posture || null,
          reason: report.backupProviderPostures?.siliconflow?.reason || null,
          source: report.backupProviderPostures?.siliconflow?.source || null,
        },
        openrouter: {
          posture: report.backupProviderPostures?.openrouter?.posture || null,
          reason: report.backupProviderPostures?.openrouter?.reason || null,
          source: report.backupProviderPostures?.openrouter?.source || null,
        },
        cloudflare: {
          posture: report.backupProviderPostures?.cloudflare?.posture || null,
          reason: report.backupProviderPostures?.cloudflare?.reason || null,
          source: report.backupProviderPostures?.cloudflare?.source || null,
        },
      },
      openrouterModels: {
        runtime: report.providerModels?.runtime?.openrouter?.model || null,
        translate: report.providerModels?.translate?.openrouter?.model || null,
        skillTry: report.providerModels?.skill_try?.openrouter?.model || null,
        script: report.providerModels?.script?.openrouter?.model || null,
        probe: report.providerModels?.probe?.openrouter?.model || null,
      },
      issues: report.issues.map((issue) => issue.message),
      rejectedOverrides,
    };
  } catch {
    return {
      available: false,
      reportPath: null,
      status: 'missing',
      issueCount: 0,
      fallbackPolicy: null,
      workersAiMode: null,
      workersAiModel: null,
      backupPostures: {
        siliconflow: { posture: null, reason: null, source: null },
        openrouter: { posture: null, reason: null, source: null },
        cloudflare: { posture: null, reason: null, source: null },
      },
      openrouterModels: {
        runtime: null,
        translate: null,
        skillTry: null,
        script: null,
        probe: null,
      },
      issues: [],
      rejectedOverrides: [],
    };
  }
}

function resolveDirectProbeSummary(
  reportsDir: string,
  generatedAt: string,
  inputPath?: string,
): AiProviderDirectProbeSummary {
  const reportPath = inputPath
    ? resolve(process.cwd(), inputPath)
    : resolve(join(reportsDir, 'latest-ai-provider-probe.json'));
  if (!existsSync(reportPath)) {
    return {
      available: false,
      reportPath: null,
      generatedAt: null,
      ageHours: null,
      freshness: 'missing',
      warningThresholdHours: DEFAULT_DIRECT_PROBE_STALE_WARNING_HOURS,
      summary: null,
      targets: null,
      guidance: [],
      workersAiReason: null,
      rateLimitedLabels: [],
      accessIssueLabels: [],
      results: [],
    };
  }

  try {
    const probe = JSON.parse(readFileSync(reportPath, 'utf-8')) as AIProviderProbeReport;
    const generatedAtMs = parseIsoTimestamp(generatedAt);
    const probeGeneratedAtMs = parseIsoTimestamp(probe.generatedAt);
    const ageHours =
      generatedAtMs != null && probeGeneratedAtMs != null && generatedAtMs >= probeGeneratedAtMs
        ? Number(((generatedAtMs - probeGeneratedAtMs) / (60 * 60 * 1000)).toFixed(2))
        : null;

    const results = Array.isArray(probe.results) ? probe.results : [];
    const rateLimitedLabels = results
      .filter((entry) => entry.failureClass === 'rate_limited')
      .map((entry) => `${entry.label}:${entry.provider}`);
    const accessIssueLabels = results
      .filter((entry) => entry.failureClass === 'auth_error' || entry.failureClass === 'billing_error')
      .map((entry) => `${entry.label}:${entry.provider}`);

    return {
      available: true,
      reportPath,
      generatedAt: probe.generatedAt || null,
      ageHours,
      freshness: ageHours != null && ageHours >= DEFAULT_DIRECT_PROBE_STALE_WARNING_HOURS ? 'stale' : 'fresh',
      warningThresholdHours: DEFAULT_DIRECT_PROBE_STALE_WARNING_HOURS,
      summary: probe.summary || null,
      targets: probe.targets || null,
      guidance: Array.isArray(probe.guidance) ? probe.guidance : [],
      workersAiReason: probe.workersAi?.reason || null,
      rateLimitedLabels,
      accessIssueLabels,
      results,
    };
  } catch {
    return {
      available: false,
      reportPath: null,
      generatedAt: null,
      ageHours: null,
      freshness: 'missing',
      warningThresholdHours: DEFAULT_DIRECT_PROBE_STALE_WARNING_HOURS,
      summary: null,
      targets: null,
      guidance: [],
      workersAiReason: null,
      rateLimitedLabels: [],
      accessIssueLabels: [],
      results: [],
    };
  }
}

function buildDirectProbeAlerts(probe: AiProviderDirectProbeSummary): AiProviderHealthAlert[] {
  if (!probe.available || !probe.summary || !probe.targets) return [];

  const alerts: AiProviderHealthAlert[] = [];
  const backupTargetCount = Math.max((probe.targets.siliconflow || 0) + (probe.targets.openrouter || 0), 0);

  if (probe.targets.nvidia > 0 && probe.summary.nvidiaHealthy === 0) {
    alerts.push({
      severity: 'critical',
      code: 'probe_nvidia_unreachable',
      title: 'Direct provider probe could not reach any NVIDIA label',
      detail: `NVIDIA direct probe healthy=${probe.summary.nvidiaHealthy}/${probe.targets.nvidia}.`,
      source: 'direct_probe',
    });
  }

  if (backupTargetCount > 0 && probe.summary.backupHealthy === 0) {
    alerts.push({
      severity: 'warning',
      code: 'probe_backups_unreachable',
      title: 'Direct provider probe found no healthy backup providers',
      detail: `Backup direct probe healthy=${probe.summary.backupHealthy}/${backupTargetCount}.`,
      source: 'direct_probe',
    });
  }

  if (probe.rateLimitedLabels.length > 0) {
    alerts.push({
      severity: 'warning',
      code: 'probe_rate_limited_labels',
      title: 'Direct provider probe observed rate-limited labels',
      detail: probe.rateLimitedLabels.join(', '),
      source: 'direct_probe',
    });
  }

  if (probe.accessIssueLabels.length > 0) {
    alerts.push({
      severity: 'warning',
      code: 'probe_access_issues',
      title: 'Direct provider probe observed auth or billing issues',
      detail: probe.accessIssueLabels.join(', '),
      source: 'direct_probe',
    });
  }

  return alerts;
}

export function parseAiAlertSeverity(raw: string | undefined | null): AiTelemetryAlertSeverity | null {
  const normalized = (raw || '').trim().toLowerCase();
  if (!normalized || normalized === 'none' || normalized === 'off') return null;
  if (normalized === 'warning' || normalized === 'critical') return normalized;
  throw new Error(`Invalid AI alert severity \"${raw}\". Use warning, critical, or none.`);
}

export function buildAiProviderHealthReport(options?: {
  checkpointPath?: string;
  reportsDir?: string;
  limit?: number;
  failOnSeverity?: AiTelemetryAlertSeverity | null;
  generatedAt?: string;
  aiConfigPath?: string;
  directProbePath?: string;
}): AiProviderHealthReport {
  const reportsDir = options?.reportsDir || 'reports/seo';
  const limit = typeof options?.limit === 'number' ? Math.max(options.limit, 0) : 20;
  const generatedAt = options?.generatedAt || new Date().toISOString();
  const checkpointPath = resolveAiTelemetryCheckpoint(options?.checkpointPath, reportsDir);
  const checkpoint = loadAiTelemetryCheckpoint(checkpointPath);

  if (!checkpoint.aiTelemetry) {
    throw new Error(`Checkpoint ${checkpointPath} does not contain aiTelemetry.`);
  }

  const allSamples = listAiTelemetrySamples(reportsDir);
  const sampled = limit > 0 ? allSamples.slice(-limit) : allSamples;
  const samples = sampled.length > 0 ? sampled : fallbackSamplesFromCheckpoint(checkpointPath, checkpoint, generatedAt);
  const trend = buildAiTelemetryTrend(samples, reportsDir, generatedAt);
  const aiConfigGuard = resolveAiConfigGuardSummary(reportsDir, options?.aiConfigPath);
  const directProbe = resolveDirectProbeSummary(reportsDir, generatedAt, options?.directProbePath);
  const directProbeSamples = listAIProviderProbeSamples(reportsDir, options?.directProbePath);
  const directProbeTrend = buildAIProviderProbeTrend(directProbeSamples, reportsDir, generatedAt);
  const failOnSeverity = options?.failOnSeverity ?? null;
  const alerts = sortHealthAlerts([
    ...trend.alerts.map((alert) => ({ ...alert, source: 'telemetry' as const })),
    ...buildDirectProbeAlerts(directProbe),
  ]);
  const alertSummary = summarizeHealthAlerts(alerts);
  const blockingAlerts = failOnSeverity
    ? alerts.filter((alert) => (failOnSeverity === 'critical' ? alert.severity === 'critical' : true))
    : [];
  const labelStats = Array.isArray(checkpoint.aiTelemetry.labelStats) ? checkpoint.aiTelemetry.labelStats : [];
  const fallbackRouting = normalizeFallbackRouting(checkpoint.aiTelemetry);
  const directProbeFlags = buildDirectProbeFlags(directProbe);
  const workersAi = normalizeWorkersAi(checkpoint.aiTelemetry);
  const workersAiNote =
    checkpoint.aiTelemetry.mode?.workersAi === 'free-only'
      ? 'Free-only is enforced with local call caps and model allowlists. Cloudflare billing is neuron-based, so treat these caps as conservative guardrails and watch 429/budget events.'
      : null;
  const historicalPressureLabels = [
    ...trend.strongestNvidia.filter((entry) => entry.issueSnapshots > 0),
    ...trend.fallbackProviders.filter(
      (entry) =>
        entry.issueSnapshots > 0 &&
        (entry.latestError != null || entry.latestFlags.some((flag) => flag !== 'policy-parked')),
    ),
  ]
    .slice(0, 6)
    .map(summarizeRoutingGuidance);
  const operatorControls: AiProviderOperatorControls = {
    routingDecision: fallbackRouting.decision,
    routingReason: fallbackRouting.decisionReason,
    actionSummary: buildOperatorActionSummary(
      fallbackRouting,
      historicalPressureLabels,
      workersAiNote,
      aiConfigGuard,
      directProbe,
    ),
    currentPressureLabels: fallbackRouting.pressureLabels,
    historicalPressureLabels,
    workersAiGuardrail: workersAiNote,
    aiConfigNote:
      aiConfigGuard.status === 'issues'
        ? `AI config guard has ${aiConfigGuard.issueCount} issue(s). Fix config drift before expanding fallback.`
        : aiConfigGuard.status === 'missing'
          ? 'AI config guard artifact is missing; config drift cannot be ruled out from this report alone.'
          : null,
    directProbeNote: buildDirectProbeNote(directProbe),
  };

  return {
    generatedAt,
    reportsDir,
    checkpointPath,
    checkpointStatus: checkpoint.status || null,
    checkpointBatch: typeof checkpoint.batch === 'number' ? checkpoint.batch : null,
    checkpointCounts: {
      selected: countSelected(checkpoint),
      completed: checkpoint.completedIds?.length || 0,
      failed: checkpoint.failedIds?.length || 0,
      pending: checkpoint.pendingIds?.length || 0,
      skipped: checkpoint.skippedIds?.length || 0,
    },
    gate: {
      failOnSeverity: failOnSeverity || 'none',
      blocking: blockingAlerts.length > 0,
      blockingAlertCount: blockingAlerts.length,
      blockingAlertCodes: blockingAlerts.map((alert) => alert.code),
      blockingAlertTitles: blockingAlerts.map((alert) => alert.title),
    },
    alertSummary,
    alerts,
    latestSnapshot: {
      timestamp: checkpoint.aiTelemetry.timestamp || null,
      availableOrder: checkpoint.aiTelemetry.availableProviders.map((entry) => `${entry.label}:${entry.provider}`),
      strongestNvidia: sortLabels(labelStats, fallbackRouting, directProbeFlags, 'nvidia').slice(0, 4),
      fallbackProviders: sortLabels(labelStats, fallbackRouting, directProbeFlags)
        .filter((entry) => entry.provider !== 'nvidia')
        .slice(0, 6),
      fallbackRouting,
      quarantinedLabels: checkpoint.aiTelemetry.quarantinedLabels || [],
      coolingDownProviders: checkpoint.aiTelemetry.coolingDownProviders || [],
      hardDisabledProviders: checkpoint.aiTelemetry.hardDisabledProviders || [],
      workersAi,
      recentEvents: checkpoint.aiTelemetry.recentEvents || [],
    },
    telemetry: checkpoint.aiTelemetry,
    trend,
    aiConfigGuard,
    directProbe,
    directProbeTrend,
    routingGuidance: {
      preferredNvidia: trend.strongestNvidia.slice(0, 4).map(summarizeRoutingGuidance),
      preferredBackups: trend.fallbackProviders.slice(0, 6).map(summarizeRoutingGuidance),
      workersAiNote,
    },
    operatorControls,
  };
}

function renderHealthLabelLine(entry: AiProviderHealthLabel): string {
  const rank = entry.selectionRank != null ? `#${entry.selectionRank}` : 'n/a';
  const providerLabel = `${entry.label} (${entry.provider}, ${rank})`;
  const tail = [entry.lastError, entry.flags.join(', ')].filter(Boolean).join(' | ');
  return `- ${providerLabel} ${entry.successCount} ok, ${entry.failureCount} fail${tail ? ` | ${tail}` : ''}`;
}

function renderAlertLine(alert: AiProviderHealthAlert | AiTelemetryAlert): string {
  return `- [${alert.severity.toUpperCase()}] ${alert.title} | ${alert.detail}`;
}

function formatQuarantinedLabels(report: AiProviderHealthReport): string {
  const items = report.latestSnapshot.quarantinedLabels;
  if (items.length === 0) return 'none';
  return items.map((item) => `${item.label} (${item.provider}: ${item.reason})`).join('; ');
}

function formatCoolingDownProviders(report: AiProviderHealthReport): string {
  const items = report.latestSnapshot.coolingDownProviders;
  if (items.length === 0) return 'none';
  return items.map((item) => `${item.label} (${item.reason}, ${item.msRemaining}ms remaining)`).join('; ');
}

function formatHardDisabledProviders(report: AiProviderHealthReport): string {
  const items = report.latestSnapshot.hardDisabledProviders;
  if (items.length === 0) return 'none';
  return items.map((item) => `${item.provider} (${item.reason})`).join('; ');
}

function renderFallbackRouting(report: AiProviderHealthReport): string[] {
  const routing = report.latestSnapshot.fallbackRouting;
  const configured =
    routing.configuredBackupProviders.length > 0 ? routing.configuredBackupProviders.join(', ') : 'none';
  const eligible =
    routing.eligibleBackupProviders.length > 0
      ? routing.eligibleBackupProviders.map((entry) => `${entry.label}:${entry.provider}`).join(' -> ')
      : 'none';

  return [
    `- Fallback policy: ${routing.policy}`,
    `- Workload profile: ${routing.workloadProfile || 'balanced'}`,
    `- Backup priority for workload: ${(routing.backupPriorityOrder || []).join(' -> ') || 'none'}`,
    `- Current routing decision: ${routing.decision}`,
    `- Routing reason: ${routing.decisionReason}`,
    `- Backup routing active now: ${routing.backupsAllowed ? 'yes' : 'no'}`,
    `- Backup activation reason: ${routing.activationReason || 'n/a'}`,
    `- NVIDIA configured / available: ${routing.nvidiaConfigured ? 'yes' : 'no'} / ${routing.nvidiaAvailable ? 'yes' : 'no'}`,
    `- Configured backup providers: ${configured}`,
    `- Eligible backup providers now: ${eligible}`,
    `- Configured backup posture: siliconflow=${report.aiConfigGuard.backupPostures.siliconflow.posture || 'n/a'}${
      report.aiConfigGuard.backupPostures.siliconflow.reason
        ? ` (${report.aiConfigGuard.backupPostures.siliconflow.reason})`
        : ''
    }, openrouter=${report.aiConfigGuard.backupPostures.openrouter.posture || 'n/a'}${
      report.aiConfigGuard.backupPostures.openrouter.reason
        ? ` (${report.aiConfigGuard.backupPostures.openrouter.reason})`
        : ''
    }, cloudflare=${report.aiConfigGuard.backupPostures.cloudflare.posture || 'n/a'}${
      report.aiConfigGuard.backupPostures.cloudflare.reason
        ? ` (${report.aiConfigGuard.backupPostures.cloudflare.reason})`
        : ''
    }`,
  ];
}

function renderWorkersStatus(report: AiProviderHealthReport): string[] {
  const workersAi = report.latestSnapshot.workersAi;
  return [
    `- Workers AI mode: ${report.telemetry.mode.workersAi}`,
    `- Workers AI model: ${workersAi.model}`,
    `- Workers AI budget status: ${workersAi.status}`,
    `- Workers AI blocked reason: ${workersAi.blockedReason || 'n/a'}`,
    `- Workers AI available now: ${workersAi.canUse ? 'yes' : 'no'}`,
    `- Workers remaining: run=${workersAi.runRemaining ?? 'n/a'}, daily=${workersAi.dailyRemaining ?? 'n/a'}`,
    `- Workers calls: run=${workersAi.callsThisRun}, daily=${workersAi.dailyCalls}`,
  ];
}

function renderFallbackActivationLine(
  entry: NonNullable<AIProviderTelemetrySnapshot['fallbackRouting']>['recentActivations'][number],
): string {
  return `- ${entry.timestamp} | ${entry.label} (${entry.provider}) | ${entry.reason} | policy=${entry.policy} | attempt=${entry.attempt ?? 'n/a'}`;
}

function renderRoutingGuidanceLine(entry: AiProviderRoutingGuidanceEntry): string {
  const rankBits = [
    entry.latestRank != null ? `latest=#${entry.latestRank}` : 'latest=n/a',
    entry.averageRank != null ? `avg=${entry.averageRank.toFixed(2)}` : 'avg=n/a',
  ].join(' | ');
  const tail = [
    `${entry.issueSnapshots} issue snapshot(s)`,
    `latest=${entry.latestSuccessCount} ok/${entry.latestFailureCount} fail`,
    entry.latestError || '',
    entry.latestFlags.join(', '),
  ]
    .filter(Boolean)
    .join(' | ');
  return `- ${entry.label} (${entry.provider}) | ${rankBits}${tail ? ` | ${tail}` : ''}`;
}

function renderPressureLabelLine(
  entry: NonNullable<AIProviderTelemetrySnapshot['fallbackRouting']>['pressureLabels'][number],
): string {
  const tail = [
    `${entry.scope}/${entry.severity}`,
    `score=${entry.pressureScore}`,
    `current429=${entry.consecutive429s}`,
    `recent429=${entry.recent429Count}`,
    `recentCooldown=${entry.recentCooldownCount}`,
    `recentRetryable=${entry.recentRetryableFailureCount}`,
    entry.lastPressureAt ? `lastPressure=${entry.lastPressureAt}` : '',
    entry.lastError || '',
    entry.reasons.join(', '),
  ]
    .filter(Boolean)
    .join(' | ');
  return `- ${entry.label} (${entry.provider}) | ${tail}`;
}

function buildDirectProbeNote(probe: AiProviderDirectProbeSummary): string | null {
  if (!probe.available || !probe.summary || !probe.targets) return null;

  const backupTargetCount = (probe.targets.siliconflow || 0) + (probe.targets.openrouter || 0);
  if (probe.targets.nvidia > 0 && probe.summary.nvidiaHealthy === 0) {
    return `Direct probe confirms all ${probe.targets.nvidia} NVIDIA labels are currently unreachable.`;
  }
  if (backupTargetCount > 0 && probe.summary.backupHealthy === 0) {
    return `Direct probe confirms no backup provider is currently healthy (${probe.summary.backupHealthy}/${backupTargetCount}).`;
  }
  if (probe.rateLimitedLabels.length > 0) {
    return `Direct probe saw rate limits on ${probe.rateLimitedLabels.join(', ')}.`;
  }
  return null;
}

function buildOperatorActionSummary(
  fallbackRouting: NonNullable<AIProviderTelemetrySnapshot['fallbackRouting']>,
  historicalPressureLabels: AiProviderRoutingGuidanceEntry[],
  workersAiNote: string | null,
  aiConfigGuard: AiProviderConfigGuardSummary,
  directProbe: AiProviderDirectProbeSummary,
): string {
  const currentLabels = fallbackRouting.pressureLabels
    .slice(0, 3)
    .map((entry) => entry.label)
    .join(', ');
  const historicalLabels = historicalPressureLabels
    .slice(0, 3)
    .map((entry) => entry.label)
    .join(', ');
  const directProbeBackupLabels = Array.from(
    new Set([...directProbe.accessIssueLabels, ...directProbe.rateLimitedLabels]),
  ).join(', ');

  if (aiConfigGuard.status === 'issues') {
    return `AI config guard is failing with ${aiConfigGuard.issueCount} issue(s). Fix provider model or Workers AI policy drift before trusting runtime fallback symptoms.`;
  }

  if (fallbackRouting.pressureLabels.length === 0) {
    if (directProbe.available && directProbe.accessIssueLabels.length > 0) {
      return historicalPressureLabels.length > 0
        ? `Latest snapshot is stable, but direct probe shows backup auth or billing issues on ${directProbeBackupLabels}. Keep NVIDIA primary, restore backup access, and continue monitoring ${historicalLabels}.`
        : `No active runtime pressure is visible, but direct probe shows backup auth or billing issues on ${directProbeBackupLabels}. Keep NVIDIA primary and restore backup access before depending on guarded fallback.`;
    }
    if (directProbe.available && directProbe.rateLimitedLabels.length > 0) {
      return historicalPressureLabels.length > 0
        ? `Latest snapshot is stable, but direct probe still sees backup rate limits on ${directProbeBackupLabels}. Keep NVIDIA primary and monitor ${historicalLabels} before widening fallback.`
        : `No active runtime pressure is visible, but direct probe still sees backup rate limits on ${directProbeBackupLabels}. Keep NVIDIA primary until those backups recover.`;
    }
    if (historicalPressureLabels.length === 0) {
      return directProbe.available && directProbe.summary && directProbe.summary.backupUnhealthy > 0
        ? 'No active runtime pressure is visible, but direct provider probe shows backup fragility. Restore backup health before depending on guarded fallback.'
        : 'No active or historical label pressure needs operator intervention right now.';
    }
    return `Latest snapshot is stable, but the trailing window is still noisy on ${historicalLabels}. Keep NVIDIA primary and monitor those labels before changing fallback policy.`;
  }

  if (fallbackRouting.decision === 'backup_recovery') {
    return `Backups are active because ${fallbackRouting.activationReason || 'primary capacity is unavailable'}. Monitor ${currentLabels} and keep Workers AI inside the current ${workersAiNote ? 'free-only' : 'configured'} guardrail.`;
  }

  if (fallbackRouting.decision === 'guarded_recovery') {
    return `Guarded recovery is holding backups in reserve while NVIDIA capacity survives. Watch ${currentLabels}; if pressure spreads across the pool, guarded fallback will engage without widening Workers AI usage.`;
  }

  if (fallbackRouting.decision === 'backup_policy_blocked') {
    return `Pressure is present on ${currentLabels}, but policy ${fallbackRouting.policy} is intentionally keeping backups parked. Only widen fallback policy deliberately, and keep Workers AI free-only.`;
  }

  return `Pressure is visible on ${currentLabels}. Review label-level reasons and historical guidance before changing provider posture.`;
}

function renderAiConfigGuardSection(report: AiProviderHealthReport): string[] {
  if (!report.aiConfigGuard.available) {
    return ['- No AI config guard artifact was available for this report window.'];
  }

  return [
    `- Config guard report: ${report.aiConfigGuard.reportPath || DEFAULT_AI_CONFIG_GUARD_JSON_PATH}`,
    `- Config guard status: ${report.aiConfigGuard.status}`,
    `- Config issues: ${report.aiConfigGuard.issueCount}`,
    `- Config fallback policy: ${report.aiConfigGuard.fallbackPolicy || 'n/a'}`,
    `- Workers AI config: mode=${report.aiConfigGuard.workersAiMode || 'n/a'}, model=${report.aiConfigGuard.workersAiModel || 'n/a'}`,
    `- Backup posture: siliconflow=${report.aiConfigGuard.backupPostures.siliconflow.posture || 'n/a'}, openrouter=${report.aiConfigGuard.backupPostures.openrouter.posture || 'n/a'}, cloudflare=${report.aiConfigGuard.backupPostures.cloudflare.posture || 'n/a'}`,
    `- OpenRouter models: runtime=${report.aiConfigGuard.openrouterModels.runtime || 'n/a'}, translate=${report.aiConfigGuard.openrouterModels.translate || 'n/a'}, skill_try=${report.aiConfigGuard.openrouterModels.skillTry || 'n/a'}, script=${report.aiConfigGuard.openrouterModels.script || 'n/a'}, probe=${report.aiConfigGuard.openrouterModels.probe || 'n/a'}`,
    ...(report.aiConfigGuard.rejectedOverrides.length > 0
      ? report.aiConfigGuard.rejectedOverrides.map((entry) => `- Rejected override: ${entry}`)
      : []),
    ...(report.aiConfigGuard.issues.length > 0
      ? ['', '### Config Issues', '', ...report.aiConfigGuard.issues.map((entry) => `- ${entry}`)]
      : []),
  ];
}

function renderDirectProbeResultLine(entry: AIProviderProbeResult): string {
  const status = entry.status != null ? String(entry.status) : '-';
  const errorText = entry.error ? ` | ${entry.error}` : '';
  return `- ${entry.label} (${entry.provider}) | ${entry.ok ? 'OK' : `ERR/${entry.failureClass}`} | status=${status} | latency=${entry.latencyMs}ms${errorText}`;
}

function renderDirectProbeSection(report: AiProviderHealthReport): string[] {
  if (!report.directProbe.available || !report.directProbe.summary || !report.directProbe.targets) {
    return ['- No direct provider probe artifact was available for this report window.'];
  }

  const backupTargetCount =
    (report.directProbe.targets.siliconflow || 0) + (report.directProbe.targets.openrouter || 0);
  return [
    `- Probe report: ${report.directProbe.reportPath || 'n/a'}`,
    `- Probe generated at: ${report.directProbe.generatedAt || 'n/a'}`,
    `- Probe freshness: ${report.directProbe.freshness}`,
    `- Probe age: ${report.directProbe.ageHours != null ? `${report.directProbe.ageHours.toFixed(2)}h` : 'n/a'} (warn>${report.directProbe.warningThresholdHours}h)`,
    `- Probe summary: nvidia healthy=${report.directProbe.summary.nvidiaHealthy}/${report.directProbe.targets.nvidia}, backups healthy=${report.directProbe.summary.backupHealthy}/${backupTargetCount}, total healthy=${report.directProbe.summary.healthy}/${report.directProbe.summary.total}`,
    `- Probe rate-limited labels: ${report.directProbe.rateLimitedLabels.join(', ') || 'none'}`,
    `- Probe access issues: ${report.directProbe.accessIssueLabels.join(', ') || 'none'}`,
    `- Workers AI direct probe: skipped (${report.directProbe.workersAiReason || 'n/a'})`,
    ...(report.directProbe.results.length > 0
      ? report.directProbe.results.map(renderDirectProbeResultLine)
      : ['- No direct provider probe results captured']),
    ...(report.directProbe.guidance.length > 0
      ? ['', '### Probe Guidance', '', ...report.directProbe.guidance.map((entry) => `- ${entry}`)]
      : []),
  ];
}

function renderDirectProbeTrendLine(entry: AIProviderProbeTrend['stableNvidia'][number]): string {
  const last =
    entry.lastFailureClass && entry.lastFailureClass !== 'ok'
      ? `${entry.lastFailureClass}${entry.lastStatus != null ? `/${entry.lastStatus}` : ''}`
      : `ok${entry.lastStatus != null ? `/${entry.lastStatus}` : ''}`;
  return `- ${entry.label} (${entry.provider}) | ok=${entry.okCount}/${entry.appearances} | fail=${entry.failureCount} | rate_limited=${entry.rateLimitedCount} | billing=${entry.billingCount} | auth=${entry.authCount} | last=${last}`;
}

function renderDirectProbeTrendSection(report: AiProviderHealthReport): string[] {
  return [
    `- Samples analyzed: ${report.directProbeTrend.sampleCount}`,
    `- Window: ${report.directProbeTrend.windowStart || 'n/a'} -> ${report.directProbeTrend.windowEnd || 'n/a'}`,
    `- Latest sample: ${report.directProbeTrend.latestReportPath || 'n/a'}`,
    '',
    '### Stable NVIDIA Labels',
    '',
    ...(report.directProbeTrend.stableNvidia.length > 0
      ? report.directProbeTrend.stableNvidia.map(renderDirectProbeTrendLine)
      : ['- No NVIDIA probe history found']),
    '',
    '### Weak Backup Providers',
    '',
    ...(report.directProbeTrend.weakBackups.length > 0
      ? report.directProbeTrend.weakBackups.map(renderDirectProbeTrendLine)
      : ['- No backup probe history found']),
    '',
    '### Frequent Rate Limits',
    '',
    ...(report.directProbeTrend.frequentRateLimitedLabels.length > 0
      ? report.directProbeTrend.frequentRateLimitedLabels.map(
          (entry) => `- ${entry.label} (${entry.provider}) | rate_limited_count=${entry.count}`,
        )
      : ['- No repeated rate limits observed across the current probe window']),
  ];
}

export function renderAiProviderHealthReport(report: AiProviderHealthReport): string {
  return [
    '# AI Provider Health',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Reports dir: ${report.reportsDir}`,
    `- Checkpoint: ${report.checkpointPath}`,
    `- Checkpoint status: ${report.checkpointStatus || 'unknown'}`,
    `- Gate threshold: ${report.gate.failOnSeverity}`,
    `- Blocking at threshold: ${report.gate.blocking ? 'yes' : 'no'}`,
    `- Current severity: ${report.alertSummary.status}`,
    `- Highest severity: ${report.alertSummary.highestSeverity}`,
    `- Alert counts: total=${report.alertSummary.total}, critical=${report.alertSummary.criticalCount}, warning=${report.alertSummary.warningCount}`,
    '',
    '## AI Config Guard',
    '',
    ...renderAiConfigGuardSection(report),
    '',
    '## Batch Status',
    '',
    `- Batch: ${report.checkpointBatch ?? 'n/a'}`,
    `- Selected / completed / failed / pending / skipped: ${report.checkpointCounts.selected} / ${report.checkpointCounts.completed} / ${report.checkpointCounts.failed} / ${report.checkpointCounts.pending} / ${report.checkpointCounts.skipped}`,
    `- Telemetry freshness: ${report.trend.freshness.status}`,
    `- Telemetry age: ${report.trend.latestSampleAgeHours != null ? `${report.trend.latestSampleAgeHours.toFixed(2)}h` : 'n/a'} (warn>${report.trend.freshness.warningThresholdHours}h)`,
    '',
    '## Latest Snapshot',
    '',
    `- Snapshot timestamp: ${report.latestSnapshot.timestamp || 'n/a'}`,
    `- Available order: ${report.latestSnapshot.availableOrder.join(' -> ') || 'none'}`,
    ...renderFallbackRouting(report),
    `- Quarantined labels: ${formatQuarantinedLabels(report)}`,
    `- Cooling down providers: ${formatCoolingDownProviders(report)}`,
    `- Hard-disabled providers: ${formatHardDisabledProviders(report)}`,
    ...renderWorkersStatus(report),
    '',
    '## Strongest NVIDIA Labels',
    '',
    ...(report.latestSnapshot.strongestNvidia.length > 0
      ? report.latestSnapshot.strongestNvidia.map(renderHealthLabelLine)
      : ['- No NVIDIA labels tracked in latest snapshot']),
    '',
    '## Fallback Providers',
    '',
    ...(report.latestSnapshot.fallbackProviders.length > 0
      ? report.latestSnapshot.fallbackProviders.map(renderHealthLabelLine)
      : ['- No fallback providers tracked in latest snapshot']),
    '',
    '## Recent Fallback Activations',
    '',
    ...(report.latestSnapshot.fallbackRouting.recentActivations.length > 0
      ? report.latestSnapshot.fallbackRouting.recentActivations.map(renderFallbackActivationLine)
      : ['- No backup-provider activations recorded in recent telemetry']),
    '',
    '## Rate Pressure Evidence',
    '',
    ...(report.operatorControls.currentPressureLabels.length > 0
      ? report.operatorControls.currentPressureLabels.map(renderPressureLabelLine)
      : ['- No active label/provider pressure is influencing the latest routing decision']),
    '',
    '## Operator Controls',
    '',
    `- Routing decision: ${report.operatorControls.routingDecision}`,
    `- Routing reason: ${report.operatorControls.routingReason}`,
    `- Recommended action: ${report.operatorControls.actionSummary}`,
    ...(report.operatorControls.workersAiGuardrail
      ? [`- Workers AI guardrail: ${report.operatorControls.workersAiGuardrail}`]
      : []),
    ...(report.operatorControls.aiConfigNote ? [`- AI config note: ${report.operatorControls.aiConfigNote}`] : []),
    ...(report.operatorControls.directProbeNote
      ? [`- Direct probe note: ${report.operatorControls.directProbeNote}`]
      : []),
    ...(report.operatorControls.historicalPressureLabels.length > 0
      ? report.operatorControls.historicalPressureLabels.map(
          (entry) => `- Historical watch: ${renderRoutingGuidanceLine(entry).slice(2)}`,
        )
      : ['- Historical watch: no unstable labels in the analyzed trend window']),
    '',
    '## Operator Guidance',
    '',
    ...(report.routingGuidance.preferredNvidia.length > 0
      ? report.routingGuidance.preferredNvidia.map(renderRoutingGuidanceLine)
      : ['- No NVIDIA history available for routing guidance yet']),
    ...(report.routingGuidance.preferredBackups.length > 0
      ? report.routingGuidance.preferredBackups.map(renderRoutingGuidanceLine)
      : ['- No backup-provider history available for routing guidance yet']),
    ...(report.routingGuidance.workersAiNote ? [`- Workers AI note: ${report.routingGuidance.workersAiNote}`] : []),
    '',
    '## AI Alerts',
    '',
    ...(report.alerts.length > 0
      ? report.alerts.map(renderAlertLine)
      : ['- No active AI alerts in the analyzed telemetry window']),
    '',
    '## Direct Provider Probe',
    '',
    ...renderDirectProbeSection(report),
    '',
    '## Direct Probe Trend',
    '',
    ...renderDirectProbeTrendSection(report),
    '',
    '## Trend Window',
    '',
    `- Samples analyzed: ${report.trend.sampleCount}`,
    `- Window: ${report.trend.windowStart || 'n/a'} -> ${report.trend.windowEnd || 'n/a'}`,
    `- Latest sample: ${report.trend.latestSamplePath || 'n/a'}`,
    ...(report.trend.eventCounts.length > 0
      ? report.trend.eventCounts.slice(0, 6).map((entry) => `- ${entry.key}: ${entry.count}`)
      : ['- No provider events captured in the current sample window']),
    '',
  ].join('\n');
}

export function buildAiProviderHealthArtifacts(report: AiProviderHealthReport): {
  telemetryMarkdown: string;
  trendMarkdown: string;
  probeTrendMarkdown: string;
  healthMarkdown: string;
} {
  return {
    telemetryMarkdown: renderAiTelemetryReport(
      {
        status: report.checkpointStatus || undefined,
        batch: report.checkpointBatch || undefined,
        selectedCount: report.checkpointCounts.selected,
        completedIds: new Array(report.checkpointCounts.completed).fill('completed'),
        failedIds: new Array(report.checkpointCounts.failed).fill({ id: 'failed', error: 'error' }),
        pendingIds: new Array(report.checkpointCounts.pending).fill('pending'),
        skippedIds: new Array(report.checkpointCounts.skipped).fill('skipped'),
        aiTelemetry: report.telemetry,
      },
      report.checkpointPath,
      report.generatedAt,
    ),
    trendMarkdown: renderAiTelemetryTrendReport(report.trend),
    probeTrendMarkdown: renderAIProviderProbeTrendReport(report.directProbeTrend),
    healthMarkdown: renderAiProviderHealthReport(report),
  };
}
