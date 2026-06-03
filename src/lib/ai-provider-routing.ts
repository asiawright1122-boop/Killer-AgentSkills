import { resolveAIFallbackActivation, type AIFallbackRoutingPolicy } from './ai-fallback-policy';
import { type AIOperatorProfileName, resolveAIOperatorProfile } from './ai-backup-posture';

export type AIPrimaryProviderName = 'nvidia';
export type AIBackupProviderName = 'siliconflow' | 'openrouter' | 'cloudflare';
export type AIProviderName = AIPrimaryProviderName | AIBackupProviderName;
export type AIProviderWorkloadProfileName = 'balanced' | 'interactive_demo' | 'batch_generation' | 'free_only_preview';

const DEFAULT_WORKLOAD_PROFILE: AIProviderWorkloadProfileName = 'balanced';
const DEFAULT_BACKUP_PRIORITY_ORDER: AIBackupProviderName[] = ['siliconflow', 'openrouter', 'cloudflare'];
const WORKLOAD_BACKUP_PRIORITY_ORDER: Record<AIProviderWorkloadProfileName, AIBackupProviderName[]> = {
  balanced: DEFAULT_BACKUP_PRIORITY_ORDER,
  interactive_demo: ['siliconflow', 'openrouter', 'cloudflare'],
  batch_generation: ['siliconflow', 'openrouter', 'cloudflare'],
  free_only_preview: ['cloudflare', 'openrouter', 'siliconflow'],
};

export type AIProviderRoutingState = {
  provider?: AIProviderName;
  successCount?: number | null;
  failureCount?: number | null;
  consecutiveRetryableFailures?: number | null;
  consecutive429s?: number | null;
  recentRetryableFailureCount?: number | null;
  recent429Count?: number | null;
  recentCooldownCount?: number | null;
  lastPressureAt?: string | null;
  lastStatus?: number | null;
  lastError?: string | null;
  coolingDown?: boolean | null;
  cooldownReason?: string | null;
  quarantined?: boolean | null;
  quarantineReason?: string | null;
  hardDisabled?: boolean | null;
  hardDisableReason?: string | null;
  circuitBreakerOpen?: boolean | null;
  averageLatencyMs?: number | null;
  estimatedCostPer1k?: number | null;
};

export type AIProviderRoutingCandidate<TProvider extends AIProviderName = AIProviderName> = {
  provider: TProvider;
  label: string;
  groupPriority?: number | null;
  rotationOrder?: number | null;
  available?: boolean;
};

export type AIProviderRoutingPlan<
  TPrimary extends AIProviderRoutingCandidate<AIPrimaryProviderName>,
  TBackup extends AIProviderRoutingCandidate<AIBackupProviderName>,
> = {
  primaryOrder: TPrimary[];
  backupOrder: TBackup[];
  fallbackRouting: {
    policy: AIFallbackRoutingPolicy;
    workloadProfile: AIProviderWorkloadProfileName;
    backupPriorityOrder: AIBackupProviderName[];
    backupsAllowed: boolean;
    activationReason: string | null;
    decision: AIProviderRoutingDecision;
    decisionReason: string;
    nvidiaConfigured: boolean;
    nvidiaAvailable: boolean;
    configuredBackupProviders: AIBackupProviderName[];
    eligibleBackupProviders: Array<{ label: string; provider: TBackup['provider'] }>;
    pressureLabels: AIProviderRoutingPressureEntry[];
    operatorProfile?: AIOperatorProfileName;
  };
};

type RankedCandidate<T extends AIProviderRoutingCandidate> = T & {
  state: NormalizedRoutingState;
  health: {
    consecutive429s: number;
    consecutiveRetryableFailures: number;
    recent429Count: number;
    recentRetryableFailureCount: number;
    recentCooldownCount: number;
    failureCount: number;
    successCount: number;
  };
};

type NormalizedRoutingState = {
  provider?: AIProviderName;
  successCount: number;
  failureCount: number;
  consecutiveRetryableFailures: number;
  consecutive429s: number;
  recentRetryableFailureCount: number;
  recent429Count: number;
  recentCooldownCount: number;
  lastPressureAt: string | null;
  lastStatus: number | null;
  lastError: string | null;
  coolingDown: boolean;
  cooldownReason: string | null;
  quarantined: boolean;
  quarantineReason: string | null;
  hardDisabled: boolean;
  hardDisableReason: string | null;
  circuitBreakerOpen: boolean;
  averageLatencyMs: number;
  estimatedCostPer1k: number;
};

export type AIProviderRoutingDecision =
  | 'primary_preferred'
  | 'guarded_recovery'
  | 'backup_recovery'
  | 'backup_policy_blocked'
  | 'providers_exhausted';

export type AIProviderRoutingPressureEntry = {
  label: string;
  provider: AIProviderName;
  scope: 'primary' | 'backup';
  available: boolean;
  severity: 'warning' | 'critical';
  reasons: string[];
  consecutive429s: number;
  consecutiveRetryableFailures: number;
  recent429Count: number;
  recentRetryableFailureCount: number;
  recentCooldownCount: number;
  failureCount: number;
  successCount: number;
  pressureScore: number;
  lastPressureAt: string | null;
  lastStatus: number | null;
  lastError: string | null;
};

function normalizeMetric(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeBoolean(value: boolean | null | undefined): boolean {
  return value === true;
}

function normalizeText(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function parseAIProviderWorkloadProfile(
  raw: string | undefined | null,
  fallback: AIProviderWorkloadProfileName = DEFAULT_WORKLOAD_PROFILE,
): AIProviderWorkloadProfileName {
  const normalized = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (
    normalized === 'balanced' ||
    normalized === 'interactive_demo' ||
    normalized === 'batch_generation' ||
    normalized === 'free_only_preview'
  ) {
    return normalized;
  }

  return fallback;
}

export function getBackupPriorityOrderForWorkload(
  workloadProfile: AIProviderWorkloadProfileName = DEFAULT_WORKLOAD_PROFILE,
  optionsOrProfile?: AIOperatorProfileName | { envName?: string; customOperatorProfile?: AIOperatorProfileName },
): AIBackupProviderName[] {
  const baseOrder = [...WORKLOAD_BACKUP_PRIORITY_ORDER[workloadProfile]];

  let resolvedProfile: AIOperatorProfileName;
  if (typeof optionsOrProfile === 'string') {
    resolvedProfile = optionsOrProfile;
  } else if (optionsOrProfile && typeof optionsOrProfile === 'object') {
    resolvedProfile =
      optionsOrProfile.customOperatorProfile ||
      resolveAIOperatorProfile({
        workloadProfile,
        envName: optionsOrProfile.envName,
      });
  } else {
    resolvedProfile = resolveAIOperatorProfile({ workloadProfile });
  }

  if (resolvedProfile === 'workers-ai-fallback') {
    const filtered = baseOrder.filter((p) => p !== 'cloudflare');
    return ['cloudflare', ...filtered];
  }

  if (resolvedProfile === 'openrouter-preferred') {
    const filtered = baseOrder.filter((p) => p !== 'openrouter');
    return ['openrouter', ...filtered];
  }

  return baseOrder;
}

function resolveBackupGroupPriority(
  provider: AIBackupProviderName,
  workloadProfile: AIProviderWorkloadProfileName,
  fallbackPriority?: number | null,
  operatorProfile?: AIOperatorProfileName,
): number {
  const orderedProviders = getBackupPriorityOrderForWorkload(workloadProfile, operatorProfile);
  const workloadPriority = orderedProviders.indexOf(provider);
  if (workloadPriority >= 0) return workloadPriority;
  return normalizeMetric(fallbackPriority);
}

function resolveCandidateHealth(
  candidate: AIProviderRoutingCandidate,
  stateByLabel?: ReadonlyMap<string, AIProviderRoutingState | null | undefined>,
): RankedCandidate<typeof candidate>['health'] {
  const state = resolveCandidateState(candidate, stateByLabel);
  return {
    consecutive429s: state.consecutive429s,
    consecutiveRetryableFailures: state.consecutiveRetryableFailures,
    recent429Count: state.recent429Count,
    recentRetryableFailureCount: state.recentRetryableFailureCount,
    recentCooldownCount: state.recentCooldownCount,
    failureCount: state.failureCount,
    successCount: state.successCount,
  };
}

function resolveCandidateState(
  candidate: AIProviderRoutingCandidate,
  stateByLabel?: ReadonlyMap<string, AIProviderRoutingState | null | undefined>,
): NormalizedRoutingState {
  const state = stateByLabel?.get(candidate.label);
  return {
    provider: state?.provider,
    successCount: normalizeMetric(state?.successCount),
    failureCount: normalizeMetric(state?.failureCount),
    consecutiveRetryableFailures: normalizeMetric(state?.consecutiveRetryableFailures),
    consecutive429s: normalizeMetric(state?.consecutive429s),
    recentRetryableFailureCount: normalizeMetric(state?.recentRetryableFailureCount),
    recent429Count: normalizeMetric(state?.recent429Count),
    recentCooldownCount: normalizeMetric(state?.recentCooldownCount),
    lastPressureAt: normalizeText(state?.lastPressureAt),
    lastStatus: typeof state?.lastStatus === 'number' && Number.isFinite(state.lastStatus) ? state.lastStatus : null,
    lastError: normalizeText(state?.lastError),
    coolingDown: normalizeBoolean(state?.coolingDown),
    cooldownReason: normalizeText(state?.cooldownReason),
    quarantined: normalizeBoolean(state?.quarantined),
    quarantineReason: normalizeText(state?.quarantineReason),
    hardDisabled: normalizeBoolean(state?.hardDisabled),
    hardDisableReason: normalizeText(state?.hardDisableReason),
    circuitBreakerOpen: normalizeBoolean(state?.circuitBreakerOpen),
    averageLatencyMs: normalizeMetric(state?.averageLatencyMs),
    estimatedCostPer1k: normalizeMetric(state?.estimatedCostPer1k),
  };
}

function buildPressureReasons(state: NormalizedRoutingState): string[] {
  const reasons: string[] = [];

  if (state.coolingDown) reasons.push(`cooldown=${state.cooldownReason || 'active'}`);
  if (state.circuitBreakerOpen) reasons.push(`circuit_breaker=open`);
  if (state.quarantined) reasons.push(`quarantined=${state.quarantineReason || 'yes'}`);
  if (state.hardDisabled) reasons.push(`hard_disabled=${state.hardDisableReason || 'yes'}`);
  if (state.consecutive429s > 0) reasons.push(`consecutive_429s=${state.consecutive429s}`);
  if (state.consecutiveRetryableFailures > 0) reasons.push(`retryable_failures=${state.consecutiveRetryableFailures}`);
  if (state.recent429Count > 0) reasons.push(`recent_429s=${state.recent429Count}`);
  if (state.recentCooldownCount > 0) reasons.push(`recent_cooldowns=${state.recentCooldownCount}`);
  if (state.recentRetryableFailureCount > 0) {
    reasons.push(`recent_retryable_failures=${state.recentRetryableFailureCount}`);
  }

  if (
    reasons.length === 0 &&
    state.failureCount > 0 &&
    (state.lastError ||
      state.lastStatus != null ||
      state.successCount === 0 ||
      state.failureCount >= state.successCount)
  ) {
    reasons.push(`historical_failures=${state.failureCount}`);
  }

  return reasons;
}

function calculatePressureScore(state: NormalizedRoutingState): number {
  return (
    (state.coolingDown ? 10 : 0) +
    (state.circuitBreakerOpen ? 15 : 0) +
    (state.quarantined ? 12 : 0) +
    (state.hardDisabled ? 12 : 0) +
    state.consecutive429s * 6 +
    state.consecutiveRetryableFailures * 4 +
    state.recent429Count * 3 +
    state.recentCooldownCount * 2 +
    state.recentRetryableFailureCount
  );
}

function resolvePressureSeverity(state: NormalizedRoutingState): AIProviderRoutingPressureEntry['severity'] {
  if (
    state.coolingDown ||
    state.circuitBreakerOpen ||
    state.quarantined ||
    state.hardDisabled ||
    state.consecutive429s > 0 ||
    state.recent429Count >= 2 ||
    state.recentCooldownCount >= 2
  ) {
    return 'critical';
  }
  return 'warning';
}

function comparePressureEntries(a: AIProviderRoutingPressureEntry, b: AIProviderRoutingPressureEntry): number {
  if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
  if (a.scope !== b.scope) return a.scope === 'primary' ? -1 : 1;
  if (a.available !== b.available) return a.available ? 1 : -1;
  const pressureScoreDiff = b.pressureScore - a.pressureScore;
  if (pressureScoreDiff !== 0) return pressureScoreDiff;
  const consecutive429Diff = b.consecutive429s - a.consecutive429s;
  if (consecutive429Diff !== 0) return consecutive429Diff;
  const recent429Diff = b.recent429Count - a.recent429Count;
  if (recent429Diff !== 0) return recent429Diff;
  const recentCooldownDiff = b.recentCooldownCount - a.recentCooldownCount;
  if (recentCooldownDiff !== 0) return recentCooldownDiff;
  const retryableDiff = b.consecutiveRetryableFailures - a.consecutiveRetryableFailures;
  if (retryableDiff !== 0) return retryableDiff;
  const recentRetryableDiff = b.recentRetryableFailureCount - a.recentRetryableFailureCount;
  if (recentRetryableDiff !== 0) return recentRetryableDiff;
  const failureDiff = b.failureCount - a.failureCount;
  if (failureDiff !== 0) return failureDiff;
  if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
  return a.label.localeCompare(b.label);
}

function buildPressureEntry(
  candidate: AIProviderRoutingCandidate,
  scope: AIProviderRoutingPressureEntry['scope'],
  stateByLabel?: ReadonlyMap<string, AIProviderRoutingState | null | undefined>,
): AIProviderRoutingPressureEntry | null {
  const state = resolveCandidateState(candidate, stateByLabel);
  const reasons = buildPressureReasons(state);
  if (reasons.length === 0) return null;
  const pressureScore = calculatePressureScore(state);

  return {
    label: candidate.label,
    provider: candidate.provider,
    scope,
    available: candidate.available !== false,
    severity: resolvePressureSeverity(state),
    reasons,
    consecutive429s: state.consecutive429s,
    consecutiveRetryableFailures: state.consecutiveRetryableFailures,
    recent429Count: state.recent429Count,
    recentRetryableFailureCount: state.recentRetryableFailureCount,
    recentCooldownCount: state.recentCooldownCount,
    failureCount: state.failureCount,
    successCount: state.successCount,
    pressureScore,
    lastPressureAt: state.lastPressureAt,
    lastStatus: state.lastStatus,
    lastError: state.lastError,
  };
}

function summarizePressureLabels(entries: AIProviderRoutingPressureEntry[]): string {
  const labels = entries.slice(0, 3).map((entry) => entry.label);
  return labels.length > 0 ? labels.join(', ') : 'none';
}

function resolveRoutingDecision(options: {
  policy: AIFallbackRoutingPolicy;
  backupsAllowed: boolean;
  activationReason: string | null;
  primaryOrderCount: number;
  backupOrderCount: number;
  primaryPressureLabels: AIProviderRoutingPressureEntry[];
}): { decision: AIProviderRoutingDecision; decisionReason: string } {
  const pressureSummary = summarizePressureLabels(options.primaryPressureLabels);

  if (options.primaryOrderCount > 0) {
    if (options.primaryPressureLabels.length === 0) {
      return {
        decision: 'primary_preferred',
        decisionReason: 'NVIDIA capacity is available and no label-level rate pressure is active.',
      };
    }

    if (!options.backupsAllowed) {
      return {
        decision: options.policy === 'guarded' ? 'guarded_recovery' : 'backup_policy_blocked',
        decisionReason:
          options.policy === 'guarded'
            ? `Guarded backups remain parked while NVIDIA capacity survives. Active pressure labels: ${pressureSummary}.`
            : `Fallback policy ${options.policy} keeps backups disabled despite pressure on ${pressureSummary}.`,
      };
    }

    return {
      decision: 'primary_preferred',
      decisionReason: `Backups are eligible via ${options.activationReason || options.policy}, but NVIDIA remains first in rotation. Active pressure labels: ${pressureSummary}.`,
    };
  }

  if (options.backupsAllowed && options.backupOrderCount > 0) {
    return {
      decision: 'backup_recovery',
      decisionReason: `Backup providers are active because ${options.activationReason || 'primary capacity is unavailable'}.`,
    };
  }

  if (!options.backupsAllowed && options.primaryPressureLabels.length > 0) {
    return {
      decision: 'backup_policy_blocked',
      decisionReason: `Primary pressure is present on ${pressureSummary}, but fallback policy ${options.policy} does not currently permit backup routing.`,
    };
  }

  return {
    decision: 'providers_exhausted',
    decisionReason:
      options.primaryPressureLabels.length > 0
        ? `All pressured primary labels are unavailable and no eligible backups remain. Pressure labels: ${pressureSummary}.`
        : 'No provider is currently eligible for routing.',
  };
}

function compareCandidates<T extends AIProviderRoutingCandidate>(a: RankedCandidate<T>, b: RankedCandidate<T>): number {
  const groupDiff = normalizeMetric(a.groupPriority) - normalizeMetric(b.groupPriority);
  if (groupDiff !== 0) return groupDiff;

  const consecutive429Diff = a.health.consecutive429s - b.health.consecutive429s;
  if (consecutive429Diff !== 0) return consecutive429Diff;

  const recent429Diff = a.health.recent429Count - b.health.recent429Count;
  if (recent429Diff !== 0) return recent429Diff;

  const recentCooldownDiff = a.health.recentCooldownCount - b.health.recentCooldownCount;
  if (recentCooldownDiff !== 0) return recentCooldownDiff;

  const retryableFailureDiff = a.health.consecutiveRetryableFailures - b.health.consecutiveRetryableFailures;
  if (retryableFailureDiff !== 0) return retryableFailureDiff;

  const recentRetryableFailureDiff = a.health.recentRetryableFailureCount - b.health.recentRetryableFailureCount;
  if (recentRetryableFailureDiff !== 0) return recentRetryableFailureDiff;

  const failureCountDiff = a.health.failureCount - b.health.failureCount;
  if (failureCountDiff !== 0) return failureCountDiff;

  const successCountDiff = b.health.successCount - a.health.successCount;
  if (successCountDiff !== 0) return successCountDiff;

  const rotationDiff =
    (typeof a.rotationOrder === 'number' ? a.rotationOrder : Number.MAX_SAFE_INTEGER) -
    (typeof b.rotationOrder === 'number' ? b.rotationOrder : Number.MAX_SAFE_INTEGER);
  if (rotationDiff !== 0) return rotationDiff;

  if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
  return a.label.localeCompare(b.label);
}

export function getProviderRotationOrder(index: number, rotationStart: number, poolSize: number): number {
  if (!Number.isFinite(poolSize) || poolSize <= 0) return 0;
  const normalizedStart = ((rotationStart % poolSize) + poolSize) % poolSize;
  return (index - normalizedStart + poolSize) % poolSize;
}

export function orderProviderCandidatesByHealth<T extends AIProviderRoutingCandidate>(
  candidates: T[],
  stateByLabel?: ReadonlyMap<string, AIProviderRoutingState | null | undefined>,
  operatorProfile?: AIOperatorProfileName,
): T[] {
  return candidates
    .filter((candidate) => candidate.available !== false)
    .map((candidate) => ({
      ...candidate,
      state: resolveCandidateState(candidate, stateByLabel),
      health: resolveCandidateHealth(candidate, stateByLabel),
    }))
    .filter((c) => !c.state.circuitBreakerOpen && !c.state.hardDisabled && !c.state.quarantined && !c.state.coolingDown)
    .sort((a, b) => {
      if (operatorProfile === 'budget') {
        const costDiff = (a.state.estimatedCostPer1k || 0) - (b.state.estimatedCostPer1k || 0);
        if (costDiff !== 0) return costDiff;
      } else if (operatorProfile === 'speed') {
        const latDiff = (a.state.averageLatencyMs || 0) - (b.state.averageLatencyMs || 0);
        if (latDiff !== 0) return latDiff;
      }
      return compareCandidates(a, b);
    })
    .map(({ state: _state, health: _health, ...candidate }) => candidate as unknown as T);
}

export function buildProviderRoutingPlan<
  TPrimary extends AIProviderRoutingCandidate<AIPrimaryProviderName>,
  TBackup extends AIProviderRoutingCandidate<AIBackupProviderName>,
>(options: {
  primaryCandidates: TPrimary[];
  backupCandidates: TBackup[];
  stateByLabel?: ReadonlyMap<string, AIProviderRoutingState | null | undefined>;
  policy: AIFallbackRoutingPolicy;
  workloadProfile?: AIProviderWorkloadProfileName;
  operatorProfile?: AIOperatorProfileName;
  nvidiaConfigured: boolean;
  alwaysReason?: string | null;
}): AIProviderRoutingPlan<TPrimary, TBackup> {
  const workloadProfile = options.workloadProfile || DEFAULT_WORKLOAD_PROFILE;
  const operatorProfile = options.operatorProfile || resolveAIOperatorProfile({ workloadProfile });
  const primaryOrder = orderProviderCandidatesByHealth(
    options.primaryCandidates,
    options.stateByLabel,
    operatorProfile,
  );
  const workloadAwareBackupCandidates = options.backupCandidates.map((candidate) => ({
    ...candidate,
    groupPriority: resolveBackupGroupPriority(
      candidate.provider,
      workloadProfile,
      candidate.groupPriority,
      operatorProfile,
    ),
  }));
  const configuredBackupProviders = Array.from(
    new Set(options.backupCandidates.map((candidate) => candidate.provider as AIBackupProviderName)),
  );
  const activation =
    configuredBackupProviders.length > 0
      ? resolveAIFallbackActivation({
          policy: options.policy,
          primaryConfigured: options.nvidiaConfigured,
          primaryAvailable: primaryOrder.length > 0,
          alwaysReason: options.alwaysReason,
        })
      : { backupsAllowed: false, activationReason: null };
  const backupOrder = activation.backupsAllowed
    ? orderProviderCandidatesByHealth(workloadAwareBackupCandidates, options.stateByLabel, operatorProfile)
    : [];
  const pressureLabels = [
    ...options.primaryCandidates
      .map((candidate) => buildPressureEntry(candidate, 'primary', options.stateByLabel))
      .filter((entry): entry is AIProviderRoutingPressureEntry => !!entry),
    ...workloadAwareBackupCandidates
      .map((candidate) => buildPressureEntry(candidate, 'backup', options.stateByLabel))
      .filter((entry): entry is AIProviderRoutingPressureEntry => !!entry),
  ].sort(comparePressureEntries);
  const primaryPressureLabels = pressureLabels.filter((entry) => entry.scope === 'primary');
  const decision = resolveRoutingDecision({
    policy: options.policy,
    backupsAllowed: activation.backupsAllowed,
    activationReason: activation.activationReason,
    primaryOrderCount: primaryOrder.length,
    backupOrderCount: backupOrder.length,
    primaryPressureLabels,
  });

  return {
    primaryOrder,
    backupOrder,
    fallbackRouting: {
      policy: options.policy,
      workloadProfile,
      backupPriorityOrder: getBackupPriorityOrderForWorkload(workloadProfile, operatorProfile),
      backupsAllowed: activation.backupsAllowed,
      activationReason: activation.activationReason,
      decision: decision.decision,
      decisionReason: decision.decisionReason,
      nvidiaConfigured: options.nvidiaConfigured,
      nvidiaAvailable: primaryOrder.length > 0,
      configuredBackupProviders,
      eligibleBackupProviders: backupOrder.map((candidate) => ({
        label: candidate.label,
        provider: candidate.provider,
      })),
      pressureLabels,
      operatorProfile,
    },
  };
}
