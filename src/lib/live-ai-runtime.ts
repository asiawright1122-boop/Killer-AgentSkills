import { inspectAIBackupProviderPostures, resolveBackupPosturePriorityOffset } from './ai-backup-posture';
import { parseAIFallbackPolicy, type AIFallbackRoutingPolicy } from './ai-fallback-policy';
import { resolveAIProviderModel } from './ai-provider-models';
import {
  buildAIOnlineProviderPool,
  splitAIProviderKeys,
  type AIOnlineBackupProviderName,
  type AIOnlineProviderName,
} from './ai-online-provider-pool';
import {
  buildProviderRoutingPlan,
  parseAIProviderWorkloadProfile,
  type AIProviderRoutingDecision,
  type AIProviderRoutingPressureEntry,
  type AIProviderRoutingState,
  type AIProviderWorkloadProfileName,
} from './ai-provider-routing';
import { sanitizePublicAIOutput } from './public-ai-output';

export type LiveAIProviderName = AIOnlineProviderName;
type BackupLiveAIProviderName = AIOnlineBackupProviderName;

export interface LiveAIRuntimeEnv {
  NVIDIA_API_KEY?: string;
  NVIDIA_API_KEYS?: string;
  NVIDIA_API_KEYS_2?: string;
  NVIDIA_API_KEYS_3?: string;
  NVIDIA_API_KEYS_4?: string;
  NVIDIA_API_KEYS_5?: string;
  NVIDIA_MODEL?: string;
  SILICONFLOW_API_KEY?: string;
  SILICONFLOW_MODEL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_API_KEYS?: string;
  OPENROUTER_MODEL?: string;
  AI_FALLBACK_POLICY?: string;
  AI_FALLBACK_ALWAYS_REASON?: string;
  AI_PROVIDER_WORKLOAD_PROFILE?: string;
  WORKERS_AI_MODE?: string;
  AI_BACKUP_SILICONFLOW_POSTURE?: string;
  AI_BACKUP_SILICONFLOW_REASON?: string;
  AI_BACKUP_OPENROUTER_POSTURE?: string;
  AI_BACKUP_OPENROUTER_REASON?: string;
  AI_BACKUP_CLOUDFLARE_POSTURE?: string;
  AI_BACKUP_CLOUDFLARE_REASON?: string;
}

export interface LiveAIRoutingSnapshot {
  policy: AIFallbackRoutingPolicy;
  workloadProfile: AIProviderWorkloadProfileName;
  decision: AIProviderRoutingDecision;
  decisionReason: string;
  activationReason: string | null;
  pressureLabels: AIProviderRoutingPressureEntry[];
}

export interface LiveAICallOptions {
  userPrompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  openRouterReferer?: string;
  openRouterTitle?: string;
}

type LiveAIProviderModelResolver<Env extends LiveAIRuntimeEnv> =
  | Partial<Record<LiveAIProviderName, string>>
  | ((env: Env, provider: LiveAIProviderName) => string);

export interface LiveAIRuntimeOptions<Env extends LiveAIRuntimeEnv> {
  getEnvString?: (env: Env, key: string) => string;
  fallbackPolicy?: AIFallbackRoutingPolicy | ((env: Env) => AIFallbackRoutingPolicy);
  workloadProfile?: AIProviderWorkloadProfileName | ((env: Env) => AIProviderWorkloadProfileName);
  fallbackAlwaysReason?: string | ((env: Env) => string);
  providerModels?: LiveAIProviderModelResolver<Env>;
  defaultOpenRouterReferer?: string;
  defaultOpenRouterTitle?: string;
  requestTimeoutMs?: number;
}

export interface LiveAICallResult {
  provider: LiveAIProviderName;
  label: string;
  text: string;
  workloadProfile: AIProviderWorkloadProfileName;
  routing: LiveAIRoutingSnapshot;
}

type ProviderLabelState = {
  provider: LiveAIProviderName;
  failureWindowCount: number;
  openUntil: number;
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
  lastEventAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
};

export interface LiveAIProviderRequest<TProvider extends LiveAIProviderName = LiveAIProviderName> {
  provider: TProvider;
  label: string;
  url: string;
  apiKey: string;
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  extraHeaders?: Record<string, string>;
  groupPriority?: number;
  rotationOrder?: number;
  available?: boolean;
}

export interface LiveAIExecutionResult<TResult> {
  provider: LiveAIProviderName;
  label: string;
  result: TResult;
  workloadProfile: AIProviderWorkloadProfileName;
  routing: LiveAIRoutingSnapshot;
}

const DEFAULT_WORKLOAD_PROFILE: AIProviderWorkloadProfileName = 'balanced';
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const PROVIDER_FAILURE_THRESHOLD = 4;
const PROVIDER_COOLDOWN_MS = 2 * 60 * 1000;
const BACKUP_PROVIDER_HARD_DISABLE_STATUSES = new Set([401, 402, 403]);

function extractAiText(payload: unknown): string | null {
  const data = payload as any;
  const candidates: unknown[] = [
    data?.result?.response,
    data?.response,
    data?.result?.text,
    data?.result?.output_text,
    data?.output_text,
    data?.choices?.[0]?.message?.content,
    data?.choices?.[0]?.text,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
    if (Array.isArray(candidate)) {
      const merged = candidate
        .map((item) => (typeof item === 'string' ? item : item?.text || item?.content || ''))
        .filter(Boolean)
        .join('\n')
        .trim();
      if (merged) return merged;
    }
  }

  return null;
}

function extractStatusCode(message: string): number | null {
  const match = String(message || '').match(/\b([1-5]\d{2})\b/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRetryableProviderFailure(status: number | null, message: string): boolean {
  if (typeof status === 'number') {
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }
  return /abort|timeout|network|fetch failed|socket|econnreset|etimedout|enotfound/i.test(message);
}

export class LiveAIRuntime<Env extends LiveAIRuntimeEnv> {
  private providerLabelState = new Map<string, ProviderLabelState>();
  private providerHardDisabled = new Set<BackupLiveAIProviderName>();
  private providerHardDisableReason = new Map<BackupLiveAIProviderName, string>();
  private currentNvidiaKeyIndex = 0;
  private currentOpenRouterKeyIndex = 0;

  constructor(private options: LiveAIRuntimeOptions<Env> = {}) {}

  private getEnvString(env: Env, key: string): string {
    if (this.options.getEnvString) return this.options.getEnvString(env, key);

    const runtimeValue = env?.[key as keyof Env];
    if (typeof runtimeValue === 'string' && runtimeValue.trim()) {
      return runtimeValue.trim();
    }

    const processValue = typeof process !== 'undefined' ? process.env?.[key] : '';
    return typeof processValue === 'string' ? processValue.trim() : '';
  }

  private resolveFallbackPolicy(env: Env): AIFallbackRoutingPolicy {
    const option = this.options.fallbackPolicy;
    if (typeof option === 'function') return option(env);
    if (option) return option;
    return parseAIFallbackPolicy(this.getEnvString(env, 'AI_FALLBACK_POLICY') || 'guarded');
  }

  private resolveWorkloadProfile(env: Env): AIProviderWorkloadProfileName {
    const option = this.options.workloadProfile;
    if (typeof option === 'function') return option(env);
    if (option) return option;
    return parseAIProviderWorkloadProfile(
      this.getEnvString(env, 'AI_PROVIDER_WORKLOAD_PROFILE'),
      DEFAULT_WORKLOAD_PROFILE,
    );
  }

  private resolveFallbackAlwaysReason(env: Env): string {
    const option = this.options.fallbackAlwaysReason;
    if (typeof option === 'function') return option(env);
    if (typeof option === 'string' && option.trim()) return option.trim();
    return this.getEnvString(env, 'AI_FALLBACK_ALWAYS_REASON') || 'policy_always';
  }

  private resolveProviderModel(env: Env, provider: LiveAIProviderName): string {
    const resolver = this.options.providerModels;
    if (typeof resolver === 'function') {
      return resolver(env, provider);
    }

    if (resolver?.[provider]) {
      return resolver[provider]!;
    }

    return resolveAIProviderModel(provider, {
      scope: 'runtime',
      env,
      getEnvString: (sourceEnv, key) => this.getEnvString((sourceEnv || env) as Env, key),
    }).model;
  }

  private ensureProviderLabelState(label: string, provider: LiveAIProviderName): ProviderLabelState {
    const existing = this.providerLabelState.get(label);
    if (existing) {
      if (existing.provider !== provider) existing.provider = provider;
      return existing;
    }

    const created: ProviderLabelState = {
      provider,
      failureWindowCount: 0,
      openUntil: 0,
      successCount: 0,
      failureCount: 0,
      consecutiveRetryableFailures: 0,
      consecutive429s: 0,
      recentRetryableFailureCount: 0,
      recent429Count: 0,
      recentCooldownCount: 0,
      lastPressureAt: null,
      lastStatus: null,
      lastError: null,
      lastEventAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
    };

    this.providerLabelState.set(label, created);
    return created;
  }

  private isProviderLabelCoolingDown(label: string): boolean {
    const entry = this.providerLabelState.get(label);
    if (!entry) return false;
    return Date.now() < entry.openUntil;
  }

  private markProviderHardDisabled(provider: BackupLiveAIProviderName, reason: string): void {
    if (this.providerHardDisabled.has(provider)) return;
    this.providerHardDisabled.add(provider);
    this.providerHardDisableReason.set(provider, reason);
  }

  private noteProviderLabelSuccess(label: string, provider: LiveAIProviderName) {
    const timestamp = new Date().toISOString();
    const entry = this.ensureProviderLabelState(label, provider);
    entry.failureWindowCount = 0;
    entry.openUntil = 0;
    entry.successCount += 1;
    entry.consecutiveRetryableFailures = 0;
    entry.consecutive429s = 0;
    entry.recentRetryableFailureCount = Math.max(entry.recentRetryableFailureCount - 1, 0);
    entry.recent429Count = Math.max(entry.recent429Count - 1, 0);
    entry.recentCooldownCount = Math.max(entry.recentCooldownCount - 1, 0);
    entry.lastStatus = null;
    entry.lastError = null;
    entry.lastEventAt = timestamp;
    entry.lastSuccessAt = timestamp;
  }

  private noteProviderLabelFailure(label: string, provider: LiveAIProviderName, errorMessage: string) {
    const timestamp = new Date().toISOString();
    const status = extractStatusCode(errorMessage);
    const retryable = isRetryableProviderFailure(status, errorMessage);
    const entry = this.ensureProviderLabelState(label, provider);

    entry.failureWindowCount += 1;
    entry.failureCount += 1;
    entry.consecutiveRetryableFailures = retryable ? entry.consecutiveRetryableFailures + 1 : 0;
    if (retryable) {
      entry.recentRetryableFailureCount += 1;
      entry.lastPressureAt = timestamp;
    }
    if (status === 429) {
      entry.consecutive429s += 1;
      entry.recent429Count += 1;
      entry.lastPressureAt = timestamp;
    } else if (status != null) {
      entry.consecutive429s = 0;
    }

    if (status === 429 || (retryable && entry.failureWindowCount >= PROVIDER_FAILURE_THRESHOLD)) {
      entry.openUntil = Date.now() + PROVIDER_COOLDOWN_MS;
      entry.failureWindowCount = 0;
      entry.recentCooldownCount += 1;
      entry.lastPressureAt = timestamp;
    }

    entry.lastStatus = status;
    entry.lastError = errorMessage;
    entry.lastEventAt = timestamp;
    entry.lastFailureAt = timestamp;

    if (provider !== 'nvidia' && status != null && BACKUP_PROVIDER_HARD_DISABLE_STATUSES.has(status)) {
      this.markProviderHardDisabled(provider, `${label}:${status}`);
    }
  }

  private buildRoutingState(): ReadonlyMap<string, AIProviderRoutingState> {
    const now = Date.now();
    return new Map(
      Array.from(this.providerLabelState.entries()).map(([label, state]) => [
        label,
        {
          provider: state.provider,
          successCount: state.successCount,
          failureCount: state.failureCount,
          consecutiveRetryableFailures: state.consecutiveRetryableFailures,
          consecutive429s: state.consecutive429s,
          recentRetryableFailureCount: state.recentRetryableFailureCount,
          recent429Count: state.recent429Count,
          recentCooldownCount: state.recentCooldownCount,
          lastPressureAt: state.lastPressureAt,
          lastStatus: state.lastStatus,
          lastError: state.lastError,
          coolingDown: now < state.openUntil,
          cooldownReason: now < state.openUntil ? 'recent_failure' : null,
          hardDisabled:
            state.provider !== 'nvidia'
              ? this.providerHardDisabled.has(state.provider as BackupLiveAIProviderName)
              : false,
          hardDisableReason:
            state.provider !== 'nvidia'
              ? this.providerHardDisableReason.get(state.provider as BackupLiveAIProviderName) || null
              : null,
        },
      ]),
    );
  }

  private toRoutingSnapshot(
    routing: ReturnType<
      typeof buildProviderRoutingPlan<LiveAIProviderRequest<'nvidia'>, LiveAIProviderRequest<BackupLiveAIProviderName>>
    >,
  ): LiveAIRoutingSnapshot {
    return {
      policy: routing.fallbackRouting.policy,
      workloadProfile: routing.fallbackRouting.workloadProfile,
      decision: routing.fallbackRouting.decision,
      decisionReason: routing.fallbackRouting.decisionReason,
      activationReason: routing.fallbackRouting.activationReason,
      pressureLabels: routing.fallbackRouting.pressureLabels,
    };
  }

  private buildProviderPool(env: Env, callOptions: LiveAICallOptions, recordCoolingErrors = false) {
    const errors: string[] = [];
    const nvidiaKeys = splitAIProviderKeys(
      this.getEnvString(env, 'NVIDIA_API_KEYS'),
      this.getEnvString(env, 'NVIDIA_API_KEY'),
      this.getEnvString(env, 'NVIDIA_API_KEYS_2'),
      this.getEnvString(env, 'NVIDIA_API_KEYS_3'),
      this.getEnvString(env, 'NVIDIA_API_KEYS_4'),
      this.getEnvString(env, 'NVIDIA_API_KEYS_5'),
    );
    const openRouterKeys = splitAIProviderKeys(
      this.getEnvString(env, 'OPENROUTER_API_KEYS'),
      this.getEnvString(env, 'OPENROUTER_API_KEY'),
    );
    const onlinePool = buildAIOnlineProviderPool({
      nvidiaKeys,
      siliconFlowKey: this.getEnvString(env, 'SILICONFLOW_API_KEY'),
      openRouterKeys,
      nvidiaRotationIndex: this.currentNvidiaKeyIndex,
      openRouterRotationIndex: this.currentOpenRouterKeyIndex,
      isAvailable: ({ label, provider }) => {
        if (provider !== 'nvidia' && this.providerHardDisabled.has(provider)) {
          if (recordCoolingErrors) {
            errors.push(
              `${provider} hard disabled for this runtime: ${this.providerHardDisableReason.get(provider) || 'unknown'}`,
            );
          }
          return false;
        }
        const available = !this.isProviderLabelCoolingDown(label);
        if (!available && recordCoolingErrors) {
          errors.push(`${label} cooling down after recent failures`);
        }
        return available;
      },
    });

    const primaryCandidates: LiveAIProviderRequest<'nvidia'>[] = onlinePool.primaryCandidates.map((candidate) => ({
      provider: candidate.provider,
      label: candidate.label,
      url: 'https://integrate.api.nvidia.com/v1/chat/completions',
      apiKey: candidate.key,
      model: this.resolveProviderModel(env, 'nvidia'),
      systemPrompt: callOptions.systemPrompt,
      userPrompt: callOptions.userPrompt,
      rotationOrder: candidate.rotationOrder,
      available: candidate.available,
    }));

    const backupPostures = inspectAIBackupProviderPostures(
      env as unknown as Record<string, string | undefined>,
      this.getEnvString(env, 'WORKERS_AI_MODE') === 'disabled' ? 'disabled' : 'free-only',
    );
    const backupCandidates: LiveAIProviderRequest<BackupLiveAIProviderName>[] = onlinePool.backupCandidates.map(
      (candidate) => ({
        provider: candidate.provider,
        label: candidate.label,
        url:
          candidate.provider === 'siliconflow'
            ? 'https://api.siliconflow.cn/v1/chat/completions'
            : 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: candidate.key,
        model: this.resolveProviderModel(env, candidate.provider),
        systemPrompt: callOptions.systemPrompt,
        userPrompt: callOptions.userPrompt,
        rotationOrder: candidate.rotationOrder,
        available:
          candidate.available &&
          backupPostures[candidate.provider as keyof typeof backupPostures].posture !== 'disabled',
        extraHeaders:
          candidate.provider === 'openrouter'
            ? {
                'HTTP-Referer':
                  callOptions.openRouterReferer || this.options.defaultOpenRouterReferer || 'https://killer-skills.com',
                'X-Title':
                  callOptions.openRouterTitle || this.options.defaultOpenRouterTitle || 'Killer-Skills Live AI Runtime',
              }
            : undefined,
        groupPriority:
          candidate.groupPriority +
          resolveBackupPosturePriorityOffset(backupPostures[candidate.provider as keyof typeof backupPostures].posture),
      }),
    );

    const routing = buildProviderRoutingPlan({
      primaryCandidates,
      backupCandidates,
      stateByLabel: this.buildRoutingState(),
      policy: this.resolveFallbackPolicy(env),
      workloadProfile: this.resolveWorkloadProfile(env),
      nvidiaConfigured: nvidiaKeys.length > 0,
      alwaysReason: this.resolveFallbackAlwaysReason(env),
    });

    return {
      errors,
      nvidiaPoolSize: onlinePool.nvidiaPoolSize,
      openRouterPoolSize: onlinePool.openRouterPoolSize,
      routing,
    };
  }

  private async callProviderText(request: LiveAIProviderRequest, options: LiveAICallOptions): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS);

    try {
      const messages = request.systemPrompt
        ? [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userPrompt },
          ]
        : [{ role: 'user', content: request.userPrompt }];

      const response = await fetch(request.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${request.apiKey}`,
          ...request.extraHeaders,
        },
        body: JSON.stringify({
          model: request.model,
          messages,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 2048,
          top_p: options.topP ?? 1,
          stream: false,
        }),
        signal: controller.signal,
      });

      const raw = await response.text();
      if (!response.ok) {
        throw new Error(`${request.provider} HTTP ${response.status}: ${raw.slice(0, 220)}`);
      }

      let payload: unknown = null;
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(`${request.provider} returned non-JSON response`);
      }

      const text = extractAiText(payload);
      if (!text) {
        throw new Error(`${request.provider} returned empty text output`);
      }
      return sanitizePublicAIOutput(text);
    } finally {
      clearTimeout(timeout);
    }
  }

  async runWithExecutor<TResult>(
    env: Env,
    options: LiveAICallOptions,
    executor: (request: LiveAIProviderRequest) => Promise<TResult>,
  ): Promise<LiveAIExecutionResult<TResult>> {
    const errors: string[] = [];
    let pool = this.buildProviderPool(env, options, true);
    errors.push(...pool.errors);

    const captureCurrentRouting = (): LiveAIRoutingSnapshot => {
      const snapshotPool = this.buildProviderPool(env, options, false);
      return this.toRoutingSnapshot(snapshotPool.routing);
    };

    if (pool.nvidiaPoolSize > 0) {
      this.currentNvidiaKeyIndex += 1;
    }

    for (const candidate of pool.routing.primaryOrder) {
      try {
        const result = await executor(candidate);
        this.noteProviderLabelSuccess(candidate.label, candidate.provider);
        return {
          provider: candidate.provider,
          label: candidate.label,
          result,
          workloadProfile: pool.routing.fallbackRouting.workloadProfile,
          routing: captureCurrentRouting(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.noteProviderLabelFailure(candidate.label, candidate.provider, message);
        errors.push(`${candidate.label}:${message}`);
      }
    }

    if (!pool.routing.fallbackRouting.backupsAllowed) {
      pool = this.buildProviderPool(env, options, false);
      errors.push(...pool.errors);
    }

    if (
      pool.routing.fallbackRouting.backupsAllowed &&
      pool.routing.backupOrder.some((candidate) => candidate.provider === 'openrouter')
    ) {
      this.currentOpenRouterKeyIndex += 1;
    } else if (!pool.routing.fallbackRouting.backupsAllowed) {
      errors.push(`backup providers blocked by fallback policy: ${pool.routing.fallbackRouting.policy}`);
    }

    for (const candidate of pool.routing.backupOrder) {
      try {
        const result = await executor(candidate);
        this.noteProviderLabelSuccess(candidate.label, candidate.provider);
        return {
          provider: candidate.provider,
          label: candidate.label,
          result,
          workloadProfile: pool.routing.fallbackRouting.workloadProfile,
          routing: captureCurrentRouting(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.noteProviderLabelFailure(candidate.label, candidate.provider, message);
        errors.push(`${candidate.label}:${message}`);
      }
    }

    const reason = errors.length > 0 ? errors.join(' | ') : 'No NVIDIA/SiliconFlow/OpenRouter keys configured.';
    throw new Error(reason);
  }

  async callText(env: Env, options: LiveAICallOptions): Promise<LiveAICallResult> {
    const executed = await this.runWithExecutor(env, options, (request) => this.callProviderText(request, options));
    return {
      provider: executed.provider,
      label: executed.label,
      text: executed.result,
      workloadProfile: executed.workloadProfile,
      routing: executed.routing,
    };
  }
}
