import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import type { AIProviderEvent, AIProviderLabelTelemetry, AIProviderTelemetrySnapshot } from './ai';
import type { TelemetryCheckpoint } from './ai-telemetry-report';

export type TelemetrySample = {
  checkpointPath: string;
  checkpoint: TelemetryCheckpoint;
  timestamp: string;
  mtimeMs: number;
};

type LabelTrend = {
  label: string;
  provider: AIProviderLabelTelemetry['provider'];
  appearances: number;
  availableSnapshots: number;
  issueSnapshots: number;
  coolingSnapshots: number;
  quarantinedSnapshots: number;
  hardDisabledSnapshots: number;
  rankCount: number;
  rankSum: number;
  bestRank: number | null;
  worstRank: number | null;
  latestRank: number | null;
  latestSuccessCount: number;
  latestFailureCount: number;
  latestError: string | null;
  latestFlags: string[];
  lastSeenAt: string;
};

type TrendEventCount = {
  key: string;
  count: number;
};

type LatestLabelIssue = {
  label: string;
  provider: AIProviderLabelTelemetry['provider'];
  reason: string;
  at: string | null;
};

type LatestProviderIssue = {
  provider: AIProviderLabelTelemetry['provider'];
  reason: string;
};

export type AiTelemetryAlertSeverity = 'warning' | 'critical';

export type AiTelemetryAlertCode =
  | 'providers_unavailable'
  | 'latest_hard_disabled_providers'
  | 'latest_quarantined_labels'
  | 'latest_checkpoint_stale'
  | 'nvidia_instability_window'
  | 'workers_budget_low'
  | 'workers_budget_exhausted';

export type AiTelemetryAlert = {
  severity: AiTelemetryAlertSeverity;
  code: AiTelemetryAlertCode;
  title: string;
  detail: string;
};

const ALERT_SEVERITY_ORDER: Record<AiTelemetryAlertSeverity, number> = {
  warning: 1,
  critical: 2,
};

export type AiTelemetryAlertSummary = {
  total: number;
  warningCount: number;
  criticalCount: number;
  highestSeverity: AiTelemetryAlertSeverity | 'none';
  status: 'clear' | 'soft warning' | 'blocking';
};

export type AiTelemetryTrend = {
  generatedAt: string;
  reportsDir: string;
  sampleCount: number;
  windowStart: string | null;
  windowEnd: string | null;
  latestSamplePath: string | null;
  latestSampleAgeHours: number | null;
  freshness: {
    status: 'fresh' | 'warning' | 'unknown';
    warningThresholdHours: number;
  };
  latestStatus: string | null;
  latestAvailableOrder: string[];
  latestWorkersAi: NonNullable<TelemetryCheckpoint['aiTelemetry']>['workersAi'] | null;
  latestIssues: {
    quarantinedLabels: LatestLabelIssue[];
    hardDisabledProviders: LatestProviderIssue[];
  };
  alerts: AiTelemetryAlert[];
  alertSummary: AiTelemetryAlertSummary;
  strongestNvidia: LabelTrend[];
  unstableLabels: LabelTrend[];
  fallbackProviders: LabelTrend[];
  eventCounts: TrendEventCount[];
  workersBudget: {
    minRunRemaining: number | null;
    minDailyRemaining: number | null;
    maxCallsThisRun: number | null;
    maxDailyCalls: number | null;
    unavailableSnapshots: number;
  };
};

const DEFAULT_REPORTS_DIR = resolve(process.cwd(), 'reports/seo');
export const DEFAULT_AI_TREND_MD_PATH = resolve(DEFAULT_REPORTS_DIR, 'latest-ai-telemetry-trend.md');
export const DEFAULT_AI_TREND_JSON_PATH = resolve(DEFAULT_REPORTS_DIR, 'latest-ai-telemetry-trend.json');
const DEFAULT_TELEMETRY_STALE_WARNING_HOURS = 36;
const NVIDIA_INSTABILITY_RECENT_WARNING_HOURS = 8;

function walkJsonFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJsonFiles(entryPath));
      continue;
    }
    if (entry.isFile() && extname(entry.name).toLowerCase() === '.json') {
      files.push(entryPath);
    }
  }

  return files;
}

function getCheckpointTimestamp(checkpoint: TelemetryCheckpoint): string | null {
  return (
    checkpoint.aiTelemetry?.timestamp ||
    checkpoint.lastUpdated ||
    checkpoint.completedAt ||
    checkpoint.startedAt ||
    null
  );
}

function buildSampleFingerprint(checkpoint: TelemetryCheckpoint): string {
  const availableOrder =
    checkpoint.aiTelemetry?.availableProviders.map((entry) => `${entry.label}:${entry.provider}`).join('->') || '';
  const fallbackPolicy = checkpoint.aiTelemetry?.mode?.fallbackPolicy || '';
  const stats = checkpoint.aiTelemetry?.stats
    ? [
        checkpoint.aiTelemetry.stats.nvidia,
        checkpoint.aiTelemetry.stats.siliconflow,
        checkpoint.aiTelemetry.stats.openrouter,
        checkpoint.aiTelemetry.stats.cloudflare,
        checkpoint.aiTelemetry.stats.nvidiaFail,
      ].join(':')
    : '';
  const workers = checkpoint.aiTelemetry?.workersAi
    ? [
        checkpoint.aiTelemetry.workersAi.callsThisRun,
        checkpoint.aiTelemetry.workersAi.dailyCalls,
        checkpoint.aiTelemetry.workersAi.runRemaining,
        checkpoint.aiTelemetry.workersAi.dailyRemaining,
        checkpoint.aiTelemetry.workersAi.status || '',
      ].join(':')
    : '';
  return [
    getCheckpointTimestamp(checkpoint) || 'n/a',
    checkpoint.status || 'unknown',
    availableOrder,
    fallbackPolicy,
    stats,
    workers,
  ].join('|');
}

function compareIso(a: string, b: string): number {
  return a.localeCompare(b);
}

function parseIsoTimestamp(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function listAiTelemetrySamples(reportsDir: string = DEFAULT_REPORTS_DIR): TelemetrySample[] {
  const seen = new Map<string, TelemetrySample>();

  for (const checkpointPath of walkJsonFiles(reportsDir)) {
    try {
      const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf-8')) as TelemetryCheckpoint;
      if (!checkpoint.aiTelemetry) continue;
      const timestamp = getCheckpointTimestamp(checkpoint);
      if (!timestamp) continue;
      const mtimeMs = statSync(checkpointPath).mtimeMs;
      const sample: TelemetrySample = { checkpointPath, checkpoint, timestamp, mtimeMs };
      const fingerprint = buildSampleFingerprint(checkpoint);
      const existing = seen.get(fingerprint);
      if (!existing || existing.mtimeMs < sample.mtimeMs) {
        seen.set(fingerprint, sample);
      }
    } catch {
      continue;
    }
  }

  return Array.from(seen.values()).sort((a, b) => {
    const timeCompare = compareIso(a.timestamp, b.timestamp);
    if (timeCompare !== 0) return timeCompare;
    return a.checkpointPath.localeCompare(b.checkpointPath);
  });
}

function isPolicyParkedBackupLabel(
  entry: AIProviderLabelTelemetry,
  telemetry: AIProviderTelemetrySnapshot | null | undefined,
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

  const fallbackRouting = telemetry?.fallbackRouting;
  if (!fallbackRouting || fallbackRouting.backupsAllowed) return false;

  return Array.isArray(fallbackRouting.configuredBackupProviders)
    ? fallbackRouting.configuredBackupProviders.includes(entry.provider)
    : false;
}

function buildLabelFlags(
  entry: AIProviderLabelTelemetry,
  telemetry: AIProviderTelemetrySnapshot | null | undefined,
): string[] {
  const flags: string[] = [];
  if (entry.quarantined) flags.push(`quarantined=${entry.quarantineReason || 'yes'}`);
  if (entry.coolingDown) flags.push(`cooldown=${entry.cooldownReason || 'active'}`);
  if (entry.hardDisabled) flags.push(`hard-disabled=${entry.hardDisableReason || 'yes'}`);
  if (!entry.currentlyAvailable) {
    flags.push(isPolicyParkedBackupLabel(entry, telemetry) ? 'policy-parked' : 'unavailable');
  }
  return flags;
}

function createLabelTrend(entry: AIProviderLabelTelemetry): LabelTrend {
  return {
    label: entry.label,
    provider: entry.provider,
    appearances: 0,
    availableSnapshots: 0,
    issueSnapshots: 0,
    coolingSnapshots: 0,
    quarantinedSnapshots: 0,
    hardDisabledSnapshots: 0,
    rankCount: 0,
    rankSum: 0,
    bestRank: null,
    worstRank: null,
    latestRank: null,
    latestSuccessCount: 0,
    latestFailureCount: 0,
    latestError: null,
    latestFlags: [],
    lastSeenAt: '',
  };
}

function applyLabelSample(
  trend: LabelTrend,
  entry: AIProviderLabelTelemetry,
  timestamp: string,
  telemetry: AIProviderTelemetrySnapshot | null | undefined,
): void {
  const policyParked = isPolicyParkedBackupLabel(entry, telemetry);
  trend.appearances += 1;
  if (entry.currentlyAvailable) trend.availableSnapshots += 1;
  if (entry.coolingDown) trend.coolingSnapshots += 1;
  if (entry.quarantined) trend.quarantinedSnapshots += 1;
  if (entry.hardDisabled) trend.hardDisabledSnapshots += 1;
  if (entry.coolingDown || entry.quarantined || entry.hardDisabled || (!entry.currentlyAvailable && !policyParked)) {
    trend.issueSnapshots += 1;
  }
  if (typeof entry.selectionRank === 'number' && Number.isFinite(entry.selectionRank)) {
    trend.rankCount += 1;
    trend.rankSum += entry.selectionRank;
    trend.bestRank = trend.bestRank == null ? entry.selectionRank : Math.min(trend.bestRank, entry.selectionRank);
    trend.worstRank = trend.worstRank == null ? entry.selectionRank : Math.max(trend.worstRank, entry.selectionRank);
    trend.latestRank = entry.selectionRank;
  } else {
    trend.latestRank = null;
  }
  trend.latestSuccessCount = entry.successCount;
  trend.latestFailureCount = entry.failureCount;
  trend.latestError = entry.lastError;
  trend.latestFlags = buildLabelFlags(entry, telemetry);
  trend.lastSeenAt = timestamp;
}

function dedupeEvents(samples: TelemetrySample[]): AIProviderEvent[] {
  const seen = new Set<string>();
  const events: AIProviderEvent[] = [];

  for (const sample of samples) {
    for (const event of Array.isArray(sample.checkpoint.aiTelemetry?.recentEvents)
      ? sample.checkpoint.aiTelemetry!.recentEvents
      : []) {
      const key = [
        event.timestamp,
        event.type,
        event.provider || '',
        event.label || '',
        event.status ?? '',
        event.attempt ?? '',
        event.delayMs ?? '',
        event.detail,
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      events.push(event);
    }
  }

  return events.sort((a, b) => compareIso(a.timestamp, b.timestamp));
}

function countEvents(events: AIProviderEvent[]): TrendEventCount[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = `${event.type}@${event.provider || 'unknown'}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.key.localeCompare(b.key)));
}

function formatRankSummary(trend: LabelTrend): string {
  const latest = trend.latestRank != null ? `latest=#${trend.latestRank}` : 'latest=n/a';
  const avg = trend.rankCount > 0 ? `avg=${(trend.rankSum / trend.rankCount).toFixed(2)}` : 'avg=n/a';
  const span =
    trend.bestRank != null && trend.worstRank != null
      ? `best=#${trend.bestRank}, worst=#${trend.worstRank}`
      : 'best/worst=n/a';
  return `${latest}, ${avg}, ${span}`;
}

function renderTrendLine(trend: LabelTrend): string {
  const tail = [
    `${trend.appearances} snapshot(s)`,
    `${trend.availableSnapshots} available`,
    `${trend.issueSnapshots} issue`,
    formatRankSummary(trend),
    `latest=${trend.latestSuccessCount} ok/${trend.latestFailureCount} fail`,
    trend.latestError || '',
    trend.latestFlags.join(', '),
  ]
    .filter(Boolean)
    .join(' | ');
  return `- ${trend.label} (${trend.provider}) | ${tail}`;
}

function collectLatestIssues(
  telemetry: AIProviderTelemetrySnapshot | null | undefined,
): AiTelemetryTrend['latestIssues'] {
  const quarantinedLabels = new Map<string, LatestLabelIssue>();
  const hardDisabledProviders = new Map<string, LatestProviderIssue>();

  if (!telemetry) {
    return {
      quarantinedLabels: [],
      hardDisabledProviders: [],
    };
  }

  for (const entry of telemetry.quarantinedLabels || []) {
    const key = `${entry.provider}:${entry.label}`;
    quarantinedLabels.set(key, {
      label: entry.label,
      provider: entry.provider,
      reason: entry.reason || 'quarantined',
      at: entry.quarantinedAt || null,
    });
  }

  for (const entry of telemetry.labelStats || []) {
    if (!entry.quarantined) continue;
    const key = `${entry.provider}:${entry.label}`;
    quarantinedLabels.set(key, {
      label: entry.label,
      provider: entry.provider,
      reason: entry.quarantineReason || 'quarantined',
      at: entry.quarantinedAt || null,
    });
  }

  for (const entry of telemetry.hardDisabledProviders || []) {
    hardDisabledProviders.set(entry.provider, {
      provider: entry.provider,
      reason: entry.reason || 'hard-disabled',
    });
  }

  for (const entry of telemetry.labelStats || []) {
    if (!entry.hardDisabled) continue;
    hardDisabledProviders.set(entry.provider, {
      provider: entry.provider,
      reason: entry.hardDisableReason || 'hard-disabled',
    });
  }

  return {
    quarantinedLabels: Array.from(quarantinedLabels.values()).sort((a, b) => {
      if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
      return a.label.localeCompare(b.label);
    }),
    hardDisabledProviders: Array.from(hardDisabledProviders.values()).sort((a, b) =>
      a.provider.localeCompare(b.provider),
    ),
  };
}

function formatLabelIssueList(items: LatestLabelIssue[]): string {
  if (items.length === 0) return 'none';
  const head = items.slice(0, 3).map((item) => `${item.label} (${item.provider}: ${item.reason})`);
  if (items.length > 3) head.push(`+${items.length - 3} more`);
  return head.join('; ');
}

function formatProviderIssueList(items: LatestProviderIssue[]): string {
  if (items.length === 0) return 'none';
  return items.map((item) => `${item.provider} (${item.reason})`).join('; ');
}

function getAlertLevelForRemaining(
  remaining: number | null | undefined,
  maximum: number | null | undefined,
): AiTelemetryAlertSeverity | null {
  if (typeof remaining !== 'number' || !Number.isFinite(remaining)) return null;
  if (typeof maximum !== 'number' || !Number.isFinite(maximum) || maximum <= 0) return null;

  const criticalThreshold = Math.max(5, Math.ceil(maximum * 0.1));
  const warningThreshold = Math.max(10, Math.ceil(maximum * 0.25));

  if (remaining <= criticalThreshold) return 'critical';
  if (remaining <= warningThreshold) return 'warning';
  return null;
}

function renderBudgetMetric(remaining: number | null | undefined, maximum: number | null | undefined): string {
  if (typeof remaining !== 'number' || !Number.isFinite(remaining)) return 'n/a';
  if (typeof maximum !== 'number' || !Number.isFinite(maximum) || maximum <= 0) return String(remaining);
  return `${remaining}/${maximum}`;
}

function sortAlerts(alerts: AiTelemetryAlert[]): AiTelemetryAlert[] {
  return [...alerts].sort((a, b) => {
    if (ALERT_SEVERITY_ORDER[a.severity] !== ALERT_SEVERITY_ORDER[b.severity]) {
      return ALERT_SEVERITY_ORDER[b.severity] - ALERT_SEVERITY_ORDER[a.severity];
    }
    return a.title.localeCompare(b.title);
  });
}

export function filterAiTelemetryAlertsAtOrAboveSeverity(
  alerts: AiTelemetryAlert[],
  severity: AiTelemetryAlertSeverity,
): AiTelemetryAlert[] {
  const threshold = ALERT_SEVERITY_ORDER[severity];
  return alerts.filter((alert) => ALERT_SEVERITY_ORDER[alert.severity] >= threshold);
}

export function summarizeAiTelemetryAlerts(alerts: AiTelemetryAlert[]): AiTelemetryAlertSummary {
  const warningCount = alerts.filter((alert) => alert.severity === 'warning').length;
  const criticalCount = alerts.filter((alert) => alert.severity === 'critical').length;
  const total = alerts.length;
  const highestSeverity: AiTelemetryAlertSeverity | 'none' =
    criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'none';
  const status: AiTelemetryAlertSummary['status'] =
    criticalCount > 0 ? 'blocking' : warningCount > 0 ? 'soft warning' : 'clear';

  return {
    total,
    warningCount,
    criticalCount,
    highestSeverity,
    status,
  };
}

function evaluateAiTelemetryAlerts({
  sampleCount,
  generatedAt,
  latestTimestamp,
  latestAvailableOrder,
  latestWorkersAi,
  latestIssues,
  eventCountMap,
  latestNvidiaInstabilityAt,
  staleWarningHours,
}: {
  sampleCount: number;
  generatedAt: string;
  latestTimestamp: string | null;
  latestAvailableOrder: string[];
  latestWorkersAi: AiTelemetryTrend['latestWorkersAi'];
  latestIssues: AiTelemetryTrend['latestIssues'];
  eventCountMap: Map<string, number>;
  latestNvidiaInstabilityAt: string | null;
  staleWarningHours: number;
}): AiTelemetryAlert[] {
  const alerts: AiTelemetryAlert[] = [];
  const providersUnavailableCount = eventCountMap.get('providers_unavailable@unknown') || 0;
  const generatedAtMs = parseIsoTimestamp(generatedAt);
  const latestTimestampMs = parseIsoTimestamp(latestTimestamp);
  const latestNvidiaInstabilityMs = parseIsoTimestamp(latestNvidiaInstabilityAt);

  if (generatedAtMs != null && latestTimestampMs != null && generatedAtMs >= latestTimestampMs) {
    const ageHours = (generatedAtMs - latestTimestampMs) / (60 * 60 * 1000);
    if (ageHours >= staleWarningHours) {
      alerts.push({
        severity: 'warning',
        code: 'latest_checkpoint_stale',
        title: 'Latest AI telemetry checkpoint is stale',
        detail: `Latest sample timestamp ${latestTimestamp} is ${ageHours.toFixed(1)}h behind report generation time ${generatedAt}.`,
      });
    }
  }

  if (latestAvailableOrder.length === 0 || providersUnavailableCount > 0) {
    const detailParts: string[] = [];
    if (latestAvailableOrder.length === 0) {
      detailParts.push('Latest snapshot has no available providers in rotation.');
    }
    if (providersUnavailableCount > 0) {
      detailParts.push(`Observed ${providersUnavailableCount} providers_unavailable event(s) in the analyzed window.`);
    }
    alerts.push({
      severity: 'critical',
      code: 'providers_unavailable',
      title: 'Provider rotation exhausted',
      detail: detailParts.join(' '),
    });
  }

  if (latestIssues.hardDisabledProviders.length > 0) {
    alerts.push({
      severity: 'critical',
      code: 'latest_hard_disabled_providers',
      title: 'Hard-disabled AI providers present in latest snapshot',
      detail: formatProviderIssueList(latestIssues.hardDisabledProviders),
    });
  }

  if (latestIssues.quarantinedLabels.length > 0) {
    alerts.push({
      severity: 'warning',
      code: 'latest_quarantined_labels',
      title: 'Quarantined provider labels present in latest snapshot',
      detail: formatLabelIssueList(latestIssues.quarantinedLabels),
    });
  }

  const nvidiaFailures = eventCountMap.get('provider_failure@nvidia') || 0;
  const nvidiaCooldowns = eventCountMap.get('provider_cooldown@nvidia') || 0;
  const nvidiaInstabilitySignal = nvidiaFailures + nvidiaCooldowns;
  const nvidiaInstabilityThreshold = Math.max(6, sampleCount * 2);
  const nvidiaInstabilityStillRelevant =
    latestIssues.quarantinedLabels.some((item) => item.provider === 'nvidia') ||
    (generatedAtMs != null &&
      latestNvidiaInstabilityMs != null &&
      generatedAtMs >= latestNvidiaInstabilityMs &&
      generatedAtMs - latestNvidiaInstabilityMs <= NVIDIA_INSTABILITY_RECENT_WARNING_HOURS * 60 * 60 * 1000);

  if (nvidiaInstabilitySignal >= nvidiaInstabilityThreshold && nvidiaInstabilityStillRelevant) {
    const latestState =
      latestIssues.quarantinedLabels.length > 0 || latestIssues.hardDisabledProviders.length > 0
        ? 'Latest snapshot still carries blocking provider-health flags.'
        : 'Latest snapshot has recovered provider availability, but the historical window is still noisy.';

    alerts.push({
      severity: 'warning',
      code: 'nvidia_instability_window',
      title: 'Historical NVIDIA volatility detected',
      detail: `${nvidiaFailures} failure event(s) and ${nvidiaCooldowns} cooldown event(s) across ${sampleCount} sample(s). ${latestState}`,
    });
  }

  const workersBudgetExhaustedCount = Array.from(eventCountMap.entries())
    .filter(([key]) => key.startsWith('workers_budget_exhausted@'))
    .reduce((sum, [, count]) => sum + count, 0);
  const workersBudgetExhaustedNow =
    !!latestWorkersAi &&
    latestWorkersAi.canUse === false &&
    ((typeof latestWorkersAi.runRemaining === 'number' && latestWorkersAi.runRemaining <= 0) ||
      (typeof latestWorkersAi.dailyRemaining === 'number' && latestWorkersAi.dailyRemaining <= 0));

  if (workersBudgetExhaustedNow || workersBudgetExhaustedCount > 0) {
    const detailParts = [
      `run=${renderBudgetMetric(latestWorkersAi?.runRemaining, latestWorkersAi?.maxCallsPerRun)}`,
      `daily=${renderBudgetMetric(latestWorkersAi?.dailyRemaining, latestWorkersAi?.maxCallsPerDay)}`,
    ];
    if (workersBudgetExhaustedCount > 0) {
      detailParts.push(`${workersBudgetExhaustedCount} workers_budget_exhausted event(s)`);
    }
    alerts.push({
      severity: 'warning',
      code: 'workers_budget_exhausted',
      title: 'Workers AI free-tier budget exhausted',
      detail: detailParts.join(' | '),
    });
  } else if (latestWorkersAi) {
    const runLevel = getAlertLevelForRemaining(latestWorkersAi.runRemaining, latestWorkersAi.maxCallsPerRun);
    const dailyLevel = getAlertLevelForRemaining(latestWorkersAi.dailyRemaining, latestWorkersAi.maxCallsPerDay);
    const severity = runLevel === 'critical' || dailyLevel === 'critical' ? 'critical' : runLevel || dailyLevel;

    if (severity) {
      alerts.push({
        severity,
        code: 'workers_budget_low',
        title: 'Workers AI free-tier budget running low',
        detail: `run=${renderBudgetMetric(latestWorkersAi.runRemaining, latestWorkersAi.maxCallsPerRun)} | daily=${renderBudgetMetric(latestWorkersAi.dailyRemaining, latestWorkersAi.maxCallsPerDay)}`,
      });
    }
  }

  return sortAlerts(alerts);
}

function renderAlertLine(alert: AiTelemetryAlert): string {
  return `- [${alert.severity.toUpperCase()}] ${alert.title} | ${alert.detail}`;
}

export function buildAiTelemetryTrend(
  samples: TelemetrySample[],
  reportsDir: string = DEFAULT_REPORTS_DIR,
  generatedAt: string = new Date().toISOString(),
  options?: {
    staleWarningHours?: number;
  },
): AiTelemetryTrend {
  const staleWarningHours =
    typeof options?.staleWarningHours === 'number' && Number.isFinite(options.staleWarningHours)
      ? Math.max(options.staleWarningHours, 0)
      : DEFAULT_TELEMETRY_STALE_WARNING_HOURS;
  const labelTrends = new Map<string, LabelTrend>();
  const workersRunRemaining: number[] = [];
  const workersDailyRemaining: number[] = [];
  const workersCallsThisRun: number[] = [];
  const workersDailyCalls: number[] = [];
  let workersUnavailableSnapshots = 0;

  for (const sample of samples) {
    const telemetry = sample.checkpoint.aiTelemetry;
    if (!telemetry) continue;

    for (const entry of Array.isArray(telemetry.labelStats) ? telemetry.labelStats : []) {
      const current = labelTrends.get(entry.label) || createLabelTrend(entry);
      applyLabelSample(current, entry, sample.timestamp, telemetry);
      labelTrends.set(entry.label, current);
    }

    if (telemetry.workersAi && typeof telemetry.workersAi.runRemaining === 'number') {
      workersRunRemaining.push(telemetry.workersAi.runRemaining);
    }
    if (telemetry.workersAi && typeof telemetry.workersAi.dailyRemaining === 'number') {
      workersDailyRemaining.push(telemetry.workersAi.dailyRemaining);
    }
    if (telemetry.workersAi && typeof telemetry.workersAi.callsThisRun === 'number') {
      workersCallsThisRun.push(telemetry.workersAi.callsThisRun);
    }
    if (telemetry.workersAi && typeof telemetry.workersAi.dailyCalls === 'number') {
      workersDailyCalls.push(telemetry.workersAi.dailyCalls);
    }
    if (telemetry.workersAi && !telemetry.workersAi.canUse) workersUnavailableSnapshots += 1;
  }

  const orderedTrends = Array.from(labelTrends.values()).sort((a, b) => {
    const issueDiff = b.issueSnapshots - a.issueSnapshots;
    if (issueDiff !== 0) return issueDiff;
    const latestRankA = a.latestRank ?? Number.MAX_SAFE_INTEGER;
    const latestRankB = b.latestRank ?? Number.MAX_SAFE_INTEGER;
    if (latestRankA !== latestRankB) return latestRankA - latestRankB;
    return a.label.localeCompare(b.label);
  });

  const latestSample = samples.at(-1) || null;
  const strongestNvidia = orderedTrends
    .filter((trend) => trend.provider === 'nvidia')
    .sort((a, b) => {
      const issueDiff = a.issueSnapshots - b.issueSnapshots;
      if (issueDiff !== 0) return issueDiff;
      const rankA = a.latestRank ?? Number.MAX_SAFE_INTEGER;
      const rankB = b.latestRank ?? Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;
      return a.label.localeCompare(b.label);
    })
    .slice(0, 4);
  const unstableLabels = orderedTrends.filter((trend) => trend.issueSnapshots > 0).slice(0, 8);
  const fallbackProviders = orderedTrends.filter((trend) => trend.provider !== 'nvidia').slice(0, 8);
  const events = dedupeEvents(samples);
  const fullEventCounts = countEvents(events);
  const latestIssues = collectLatestIssues(latestSample?.checkpoint.aiTelemetry || null);
  const latestNvidiaInstabilityAt =
    events
      .filter(
        (event) =>
          event.provider === 'nvidia' && (event.type === 'provider_failure' || event.type === 'provider_cooldown'),
      )
      .at(-1)?.timestamp || null;
  const latestAvailableOrder =
    latestSample && Array.isArray(latestSample.checkpoint.aiTelemetry?.availableProviders)
      ? latestSample.checkpoint.aiTelemetry!.availableProviders.map((entry) => `${entry.label}:${entry.provider}`)
      : [];
  const latestWorkersAi = latestSample?.checkpoint.aiTelemetry?.workersAi || null;
  const latestTimestamp = latestSample?.timestamp || null;
  const generatedAtMs = parseIsoTimestamp(generatedAt);
  const latestTimestampMs = parseIsoTimestamp(latestTimestamp);
  const latestSampleAgeHours =
    generatedAtMs != null && latestTimestampMs != null && generatedAtMs >= latestTimestampMs
      ? Number(((generatedAtMs - latestTimestampMs) / (60 * 60 * 1000)).toFixed(2))
      : null;
  const alerts = evaluateAiTelemetryAlerts({
    sampleCount: samples.length,
    generatedAt,
    latestTimestamp,
    latestAvailableOrder,
    latestWorkersAi,
    latestIssues,
    eventCountMap: new Map(fullEventCounts.map((entry) => [entry.key, entry.count])),
    latestNvidiaInstabilityAt,
    staleWarningHours,
  });

  return {
    generatedAt,
    reportsDir,
    sampleCount: samples.length,
    windowStart: samples[0]?.timestamp || null,
    windowEnd: latestSample?.timestamp || null,
    latestSamplePath: latestSample?.checkpointPath || null,
    latestSampleAgeHours,
    freshness: {
      status:
        latestSampleAgeHours == null ? 'unknown' : latestSampleAgeHours >= staleWarningHours ? 'warning' : 'fresh',
      warningThresholdHours: staleWarningHours,
    },
    latestStatus: latestSample?.checkpoint.status || null,
    latestAvailableOrder,
    latestWorkersAi,
    latestIssues,
    alerts,
    alertSummary: summarizeAiTelemetryAlerts(alerts),
    strongestNvidia,
    unstableLabels,
    fallbackProviders,
    eventCounts: fullEventCounts.slice(0, 12),
    workersBudget: {
      minRunRemaining: workersRunRemaining.length > 0 ? Math.min(...workersRunRemaining) : null,
      minDailyRemaining: workersDailyRemaining.length > 0 ? Math.min(...workersDailyRemaining) : null,
      maxCallsThisRun: workersCallsThisRun.length > 0 ? Math.max(...workersCallsThisRun) : null,
      maxDailyCalls: workersDailyCalls.length > 0 ? Math.max(...workersDailyCalls) : null,
      unavailableSnapshots: workersUnavailableSnapshots,
    },
  };
}

export function renderAiTelemetryTrendReport(trend: AiTelemetryTrend): string {
  return [
    '# AI Telemetry Trend',
    '',
    `- Generated at: ${trend.generatedAt}`,
    `- Reports dir: ${trend.reportsDir}`,
    `- Samples analyzed: ${trend.sampleCount}`,
    `- Window: ${trend.windowStart || 'n/a'} -> ${trend.windowEnd || 'n/a'}`,
    `- Latest sample: ${trend.latestSamplePath || 'n/a'}`,
    `- Freshness: ${trend.freshness.status}${trend.latestSampleAgeHours != null ? ` (${trend.latestSampleAgeHours.toFixed(2)}h old; warn>${trend.freshness.warningThresholdHours}h)` : ''}`,
    `- Latest status: ${trend.latestStatus || 'n/a'}`,
    '',
    '## AI Alert Status',
    '',
    `- Alert status: ${trend.alertSummary.status}`,
    `- Highest severity: ${trend.alertSummary.highestSeverity}`,
    `- Alert counts: total=${trend.alertSummary.total}, critical=${trend.alertSummary.criticalCount}, warning=${trend.alertSummary.warningCount}`,
    '',
    '## AI Alerts',
    '',
    ...(trend.alerts.length > 0
      ? trend.alerts.map(renderAlertLine)
      : ['- No active AI alerts in the analyzed telemetry window']),
    '',
    '## Latest Snapshot',
    '',
    `- Available order: ${trend.latestAvailableOrder.join(' -> ') || 'none'}`,
    `- Workers AI mode: ${trend.latestWorkersAi?.model || 'n/a'} (${trend.latestWorkersAi?.canUse ? 'available' : 'blocked'})`,
    `- Workers remaining: run=${trend.latestWorkersAi?.runRemaining ?? 'n/a'}, daily=${trend.latestWorkersAi?.dailyRemaining ?? 'n/a'}`,
    `- Latest quarantined labels: ${formatLabelIssueList(trend.latestIssues.quarantinedLabels)}`,
    `- Latest hard-disabled providers: ${formatProviderIssueList(trend.latestIssues.hardDisabledProviders)}`,
    '',
    '## Strongest NVIDIA Labels',
    '',
    ...(trend.strongestNvidia.length > 0
      ? trend.strongestNvidia.map(renderTrendLine)
      : ['- No NVIDIA telemetry samples found']),
    '',
    '## Unstable Labels',
    '',
    ...(trend.unstableLabels.length > 0
      ? trend.unstableLabels.map(renderTrendLine)
      : ['- No repeated issue patterns observed']),
    '',
    '## Fallback Providers',
    '',
    ...(trend.fallbackProviders.length > 0
      ? trend.fallbackProviders.map(renderTrendLine)
      : ['- No fallback providers recorded']),
    '',
    '## Event Mix',
    '',
    ...(trend.eventCounts.length > 0
      ? trend.eventCounts.map((entry) => `- ${entry.key}: ${entry.count}`)
      : ['- No provider events captured in the current sample window']),
    '',
    '## Workers AI Budget Window',
    '',
    `- Minimum run remaining observed: ${trend.workersBudget.minRunRemaining ?? 'n/a'}`,
    `- Minimum daily remaining observed: ${trend.workersBudget.minDailyRemaining ?? 'n/a'}`,
    `- Maximum calls this run observed: ${trend.workersBudget.maxCallsThisRun ?? 'n/a'}`,
    `- Maximum daily calls observed: ${trend.workersBudget.maxDailyCalls ?? 'n/a'}`,
    `- Snapshots with Workers AI unavailable: ${trend.workersBudget.unavailableSnapshots}`,
    '',
  ].join('\n');
}
