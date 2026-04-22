import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import type { AIProviderLabelTelemetry, AIProviderTelemetrySnapshot } from './ai';

export type TelemetryCheckpoint = {
  status?: string;
  batch?: number;
  batchPlanPath?: string;
  startedAt?: string;
  lastUpdated?: string;
  completedAt?: string;
  selectedCount?: number;
  completedIds?: string[];
  failedIds?: Array<{ id: string; error: string }>;
  pendingIds?: string[];
  skippedIds?: string[];
  aiTelemetry?: AIProviderTelemetrySnapshot;
};

type RankedLabel = AIProviderLabelTelemetry & {
  normalizedRank: number;
};

const DEFAULT_REPORTS_DIR = resolve(process.cwd(), 'reports/seo');
const DEFAULT_OUTPUT_FILE = resolve(DEFAULT_REPORTS_DIR, 'latest-ai-telemetry-summary.md');
const PREFERRED_CHECKPOINT_BASENAMES = ['latest-ai-runtime-summary.json', 'phase-40-runtime-probe.json'];

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

function getCheckpointTimestamp(checkpoint: TelemetryCheckpoint): string | null {
  const candidate =
    checkpoint.aiTelemetry?.timestamp || checkpoint.lastUpdated || checkpoint.completedAt || checkpoint.startedAt;
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : null;
}

function compareIsoDescending(a: string | null, b: string | null): number {
  if (a && b) return b.localeCompare(a);
  if (a) return -1;
  if (b) return 1;
  return 0;
}

function getCheckpointPathPriority(filePath: string): number {
  const name = basename(filePath);
  const index = PREFERRED_CHECKPOINT_BASENAMES.indexOf(name);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function normalizeRank(entry: AIProviderLabelTelemetry): number {
  if (typeof entry.selectionRank === 'number' && Number.isFinite(entry.selectionRank)) {
    return entry.selectionRank;
  }
  return Number.MAX_SAFE_INTEGER;
}

function rankLabels(
  labels: AIProviderLabelTelemetry[],
  provider?: AIProviderLabelTelemetry['provider'],
): RankedLabel[] {
  return labels
    .filter((entry) => (provider ? entry.provider === provider : true))
    .map((entry) => ({ ...entry, normalizedRank: normalizeRank(entry) }))
    .sort((a, b) => {
      if (a.normalizedRank !== b.normalizedRank) return a.normalizedRank - b.normalizedRank;
      return a.label.localeCompare(b.label);
    });
}

function renderLabelLine(entry: RankedLabel): string {
  const rank =
    Number.isFinite(entry.normalizedRank) && entry.normalizedRank !== Number.MAX_SAFE_INTEGER
      ? `#${entry.normalizedRank}`
      : 'n/a';
  const health: string[] = [`${entry.successCount} ok`, `${entry.failureCount} fail`];
  if (entry.consecutiveRetryableFailures > 0) health.push(`${entry.consecutiveRetryableFailures} retryable`);
  if (entry.consecutive429s > 0) health.push(`${entry.consecutive429s}x429`);

  const flags: string[] = [];
  if (entry.quarantined) flags.push(`quarantined=${entry.quarantineReason || 'yes'}`);
  if (entry.coolingDown) flags.push(`cooldown=${entry.cooldownReason || 'active'}`);
  if (entry.hardDisabled) flags.push(`hard-disabled=${entry.hardDisableReason || 'yes'}`);
  if (!entry.currentlyAvailable) flags.push('unavailable');

  const tail = [entry.lastError, ...flags].filter(Boolean).join(' | ');
  return `- ${entry.label} (${rank}) ${health.join(', ')}${tail ? ` | ${tail}` : ''}`;
}

function renderEventLine(snapshot: AIProviderTelemetrySnapshot): string[] {
  return snapshot.recentEvents
    .slice(-8)
    .map(
      (event) =>
        `- ${event.timestamp} | ${event.type} | ${event.provider || '-'} ${event.label || '-'} | ${event.detail}`,
    );
}

function normalizeFallbackRouting(
  snapshot: AIProviderTelemetrySnapshot,
): AIProviderTelemetrySnapshot['fallbackRouting'] {
  if (snapshot.fallbackRouting) return snapshot.fallbackRouting;
  return {
    policy: snapshot.mode?.fallbackPolicy || 'cold',
    backupsAllowed: false,
    activationReason: null,
    nvidiaConfigured: snapshot.availableProviders.some((entry) => entry.provider === 'nvidia'),
    nvidiaAvailable: snapshot.availableProviders.some((entry) => entry.provider === 'nvidia'),
    configuredBackupProviders: [],
    eligibleBackupProviders: snapshot.availableProviders
      .filter((entry) => entry.provider !== 'nvidia')
      .map((entry) => ({ label: entry.label, provider: entry.provider })),
    recentActivations: [],
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

export function renderAiTelemetryReport(
  checkpoint: TelemetryCheckpoint,
  checkpointPath: string,
  generatedAt: string = new Date().toISOString(),
): string {
  if (!checkpoint.aiTelemetry) {
    throw new Error(`Checkpoint ${checkpointPath} does not contain aiTelemetry.`);
  }

  const telemetry = checkpoint.aiTelemetry;
  const fallbackRouting = normalizeFallbackRouting(telemetry);
  const workersAi = normalizeWorkersAi(telemetry);
  const nvidia = rankLabels(telemetry.labelStats, 'nvidia');
  const nonNvidia = rankLabels(telemetry.labelStats).filter((entry) => entry.provider !== 'nvidia');
  const selectedCount = countSelected(checkpoint);
  const completedCount = checkpoint.completedIds?.length || 0;
  const failedCount = checkpoint.failedIds?.length || 0;
  const pendingCount = checkpoint.pendingIds?.length || 0;
  const skippedCount = checkpoint.skippedIds?.length || 0;
  const availableOrder =
    telemetry.availableProviders.map((entry) => `${entry.label}:${entry.provider}`).join(' -> ') || 'none';
  const issueLines = [
    ...telemetry.quarantinedLabels.map((entry) => `- Quarantined ${entry.label} (${entry.provider}) | ${entry.reason}`),
    ...telemetry.coolingDownProviders.map(
      (entry) => `- Cooling down ${entry.label} | ${entry.reason} | ${entry.msRemaining}ms remaining`,
    ),
    ...telemetry.hardDisabledProviders.map((entry) => `- Hard disabled ${entry.provider} | ${entry.reason}`),
  ];

  return [
    '# AI Telemetry Summary',
    '',
    `- Generated at: ${generatedAt}`,
    `- Checkpoint: ${checkpointPath}`,
    `- Checkpoint status: ${checkpoint.status || 'unknown'}`,
    `- Batch: ${typeof checkpoint.batch === 'number' ? checkpoint.batch : 'n/a'}`,
    `- Selected / completed / failed / pending / skipped: ${selectedCount} / ${completedCount} / ${failedCount} / ${pendingCount} / ${skippedCount}`,
    `- Started at: ${checkpoint.startedAt || 'n/a'}`,
    `- Last updated: ${checkpoint.lastUpdated || checkpoint.completedAt || 'n/a'}`,
    '',
    '## Workers AI Guardrails',
    '',
    `- Mode: ${telemetry.mode.workersAi}`,
    `- Fallback policy: ${fallbackRouting.policy}`,
    `- Backup routing active: ${fallbackRouting.backupsAllowed ? 'yes' : 'no'}`,
    `- Backup activation reason: ${fallbackRouting.activationReason || 'n/a'}`,
    `- Model: ${telemetry.workersAi.model}`,
    `- Concurrency limit: ${telemetry.mode.concurrencyLimit}`,
    `- Locale batch size: ${telemetry.mode.localeBatchSize}`,
    `- Calls this run: ${workersAi.callsThisRun}`,
    `- Daily calls: ${workersAi.dailyCalls} on ${workersAi.dailyDate || 'n/a'}`,
    `- Run remaining: ${workersAi.runRemaining ?? 'n/a'}`,
    `- Daily remaining: ${workersAi.dailyRemaining ?? 'n/a'}`,
    `- Budget status: ${workersAi.status}`,
    `- Blocked reason: ${workersAi.blockedReason || 'n/a'}`,
    `- Can use now: ${workersAi.canUse ? 'yes' : 'no'}`,
    '',
    '## Provider Order',
    '',
    `- Available order: ${availableOrder}`,
    '',
    '## NVIDIA Health',
    '',
    ...(nvidia.length > 0 ? nvidia.map(renderLabelLine) : ['- No NVIDIA labels tracked']),
    '',
    '## Fallback Providers',
    '',
    ...(nonNvidia.length > 0 ? nonNvidia.map(renderLabelLine) : ['- No fallback providers tracked']),
    '',
    '## Active Issues',
    '',
    ...(issueLines.length > 0 ? issueLines : ['- No active quarantine, cooldown, or hard-disable flags']),
    '',
    '## Recent Events',
    '',
    ...(telemetry.recentEvents.length > 0 ? renderEventLine(telemetry) : ['- No recent provider events captured']),
    '',
    '## Provider Stats',
    '',
    `- nvidia=${telemetry.stats.nvidia}, siliconflow=${telemetry.stats.siliconflow}, openrouter=${telemetry.stats.openrouter}, cloudflare=${telemetry.stats.cloudflare}, nvidiaFail=${telemetry.stats.nvidiaFail}`,
    '',
  ].join('\n');
}

export function resolveAiTelemetryCheckpoint(inputPath?: string, reportsDir: string = DEFAULT_REPORTS_DIR): string {
  if (inputPath) {
    const absolutePath = resolve(process.cwd(), inputPath);
    const parsed = JSON.parse(readFileSync(absolutePath, 'utf-8')) as TelemetryCheckpoint;
    if (!parsed.aiTelemetry) {
      throw new Error(`Checkpoint ${absolutePath} does not contain aiTelemetry.`);
    }
    return absolutePath;
  }

  const candidates = walkJsonFiles(reportsDir)
    .map((filePath) => {
      try {
        const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as TelemetryCheckpoint;
        if (!parsed.aiTelemetry) return null;
        return {
          filePath,
          parsed,
          mtimeMs: statSync(filePath).mtimeMs,
          timestamp: getCheckpointTimestamp(parsed),
          pathPriority: getCheckpointPathPriority(filePath),
        };
      } catch {
        return null;
      }
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => !!candidate)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  candidates.sort((a, b) => {
    const timestampCompare = compareIsoDescending(a.timestamp, b.timestamp);
    if (timestampCompare !== 0) return timestampCompare;
    if (a.pathPriority !== b.pathPriority) return a.pathPriority - b.pathPriority;
    if (a.mtimeMs !== b.mtimeMs) return b.mtimeMs - a.mtimeMs;
    return a.filePath.localeCompare(b.filePath);
  });

  for (const candidate of candidates) {
    return candidate.filePath;
  }

  throw new Error(`No AI telemetry checkpoint found under ${reportsDir}.`);
}

export function loadAiTelemetryCheckpoint(checkpointPath: string): TelemetryCheckpoint {
  return JSON.parse(readFileSync(checkpointPath, 'utf-8')) as TelemetryCheckpoint;
}

export function getDefaultAiTelemetryOutputPath(checkpointPath: string): string {
  const fileName = basename(checkpointPath);
  if (fileName.includes('batch-progress')) {
    return resolve(DEFAULT_REPORTS_DIR, 'latest-ai-telemetry-summary.md');
  }
  return DEFAULT_OUTPUT_FILE;
}

export function getSiblingAiTelemetrySummaryPath(checkpointPath: string): string {
  const absolutePath = resolve(checkpointPath);
  if (absolutePath.toLowerCase().endsWith('.json')) {
    return absolutePath.replace(/\.json$/i, '.summary.md');
  }
  return `${absolutePath}.summary.md`;
}
