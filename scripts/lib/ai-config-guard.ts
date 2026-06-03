import type {
  AIProviderModelName,
  AIProviderModelScope,
  ResolvedAIProviderModel,
} from '../../src/lib/ai-provider-models';
import {
  inspectAIBackupProviderPostures,
  isCloudflareBackupPostureAllowed,
  isValidAIBackupProviderPosture,
  parseAIOperatorProfile,
  type AIBackupPostureProviderName,
  type AIBackupProviderPostureConfig,
  type AIOperatorProfileName,
} from '../../src/lib/ai-backup-posture';
import { resolveAIProviderModel, SKILL_TRY_PROVIDER_MODEL_ALLOWLIST } from '../../src/lib/ai-provider-models';

export const DEFAULT_WORKERS_AI_FREE_MAX_CALLS = 60;
export const DEFAULT_WORKERS_AI_FREE_DAILY_MAX_CALLS = 60;
export const DEFAULT_WORKERS_AI_FREE_MAX_TOKENS = 1024;
export const DEFAULT_WORKERS_AI_FREE_MODEL = '@cf/meta/llama-3.1-8b-instruct';
export const DEFAULT_AI_CONFIG_GUARD_MD_PATH = 'reports/seo/latest-ai-config-guard.md';
export const DEFAULT_AI_CONFIG_GUARD_JSON_PATH = 'reports/seo/latest-ai-config-guard.json';
export const ALLOWED_WORKERS_AI_FREE_MODELS = new Set([
  DEFAULT_WORKERS_AI_FREE_MODEL,
  '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
]);

const ALLOWED_WORKERS_AI_MODES = new Set(['free-only', 'disabled']);
const ALLOWED_FALLBACK_POLICIES = new Set(['cold', 'guarded', 'always']);

export type AiConfigGuardIssueCode =
  | 'invalid_workers_ai_mode'
  | 'invalid_ai_fallback_policy'
  | 'invalid_workers_ai_free_model'
  | 'openrouter_free_model_outside_skill_try'
  | 'workers_ai_free_run_cap_too_high'
  | 'workers_ai_free_daily_cap_too_high'
  | 'invalid_backup_provider_posture'
  | 'invalid_cloudflare_backup_posture'
  | 'workers_ai_disabled_but_cloudflare_backup_enabled'
  | 'invalid_operator_profile';

export type AiConfigGuardIssue = {
  code: AiConfigGuardIssueCode;
  message: string;
};

export type AiConfigGuardReport = {
  workersAiMode: 'free-only' | 'disabled';
  fallbackPolicy: 'cold' | 'guarded' | 'always';
  workersAiModel: string;
  providerModels: Record<AIProviderModelScope, Record<AIProviderModelName, ResolvedAIProviderModel>>;
  backupProviderPostures: Record<AIBackupPostureProviderName, AIBackupProviderPostureConfig>;
  workersAiMaxCallsPerRun: number;
  workersAiMaxCallsPerDay: number;
  workersAiMaxTokens: number;
  operatorProfile: AIOperatorProfileName;
  issues: AiConfigGuardIssue[];
};

function normalizeEnvValue(raw: string | undefined | null): string {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

function readPositiveInt(raw: string | undefined | null, fallback: number): number {
  const parsed = Number.parseInt(String(raw || '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const MODEL_SCOPES: AIProviderModelScope[] = ['runtime', 'translate', 'skill_try', 'script', 'probe'];
const MODEL_PROVIDERS: AIProviderModelName[] = ['nvidia', 'siliconflow', 'openrouter'];

function buildProviderModelReport(
  env: Record<string, string | undefined>,
): Record<AIProviderModelScope, Record<AIProviderModelName, ResolvedAIProviderModel>> {
  return Object.fromEntries(
    MODEL_SCOPES.map((scope) => [
      scope,
      Object.fromEntries(
        MODEL_PROVIDERS.map((provider) => [
          provider,
          resolveAIProviderModel(provider, {
            scope,
            env,
            ...(scope === 'skill_try' ? { allowList: SKILL_TRY_PROVIDER_MODEL_ALLOWLIST[provider] } : {}),
          }),
        ]),
      ) as Record<AIProviderModelName, ResolvedAIProviderModel>,
    ]),
  ) as Record<AIProviderModelScope, Record<AIProviderModelName, ResolvedAIProviderModel>>;
}

function describeModelResolution(
  provider: AIProviderModelName,
  resolution: ResolvedAIProviderModel,
  scope: AIProviderModelScope,
): string {
  const source = resolution.envKey ? `env:${resolution.envKey}` : resolution.source;
  return `${scope}.${provider}=${resolution.model} (${source})`;
}

export function inspectAiConfigGuard(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): AiConfigGuardReport {
  const issues: AiConfigGuardIssue[] = [];
  const rawWorkersAiMode = normalizeEnvValue(env.WORKERS_AI_MODE);
  const workersAiMode = rawWorkersAiMode === 'disabled' ? 'disabled' : 'free-only';

  if (rawWorkersAiMode && !ALLOWED_WORKERS_AI_MODES.has(rawWorkersAiMode)) {
    issues.push({
      code: 'invalid_workers_ai_mode',
      message: `WORKERS_AI_MODE=${rawWorkersAiMode} is invalid. Only free-only or disabled are allowed.`,
    });
  }

  const rawOperatorProfile = env.AI_OPERATOR_PROFILE;
  const operatorProfile = parseAIOperatorProfile(rawOperatorProfile);

  if (rawOperatorProfile) {
    const normalized = String(rawOperatorProfile).trim().toLowerCase().replace(/_/g, '-');
    if (normalized !== 'nvidia-first' && normalized !== 'workers-ai-fallback' && normalized !== 'openrouter-preferred') {
      issues.push({
        code: 'invalid_operator_profile',
        message: `AI_OPERATOR_PROFILE=${rawOperatorProfile} is invalid. Use nvidia-first, workers-ai-fallback, or openrouter-preferred.`,
      });
    }
  }

  const rawFallbackPolicy = normalizeEnvValue(env.AI_FALLBACK_POLICY);
  const fallbackPolicy = rawFallbackPolicy === 'cold' || rawFallbackPolicy === 'always' ? rawFallbackPolicy : 'guarded';

  if (rawFallbackPolicy && !ALLOWED_FALLBACK_POLICIES.has(rawFallbackPolicy)) {
    issues.push({
      code: 'invalid_ai_fallback_policy',
      message: `AI_FALLBACK_POLICY=${rawFallbackPolicy} is invalid. Use cold, guarded, or always.`,
    });
  }

  const workersAiMaxCallsPerRun = readPositiveInt(env.WORKERS_AI_FREE_MAX_CALLS, DEFAULT_WORKERS_AI_FREE_MAX_CALLS);
  const workersAiMaxCallsPerDay = readPositiveInt(
    env.WORKERS_AI_FREE_DAILY_MAX_CALLS,
    DEFAULT_WORKERS_AI_FREE_DAILY_MAX_CALLS,
  );
  const workersAiMaxTokens = readPositiveInt(env.WORKERS_AI_FREE_MAX_TOKENS, DEFAULT_WORKERS_AI_FREE_MAX_TOKENS);
  const workersAiModel =
    String(env.WORKERS_AI_FREE_MODEL || DEFAULT_WORKERS_AI_FREE_MODEL).trim() || DEFAULT_WORKERS_AI_FREE_MODEL;
  const providerModels = buildProviderModelReport(env);
  const backupProviderPostures = inspectAIBackupProviderPostures(env, workersAiMode);

  for (const [provider, posture] of Object.entries(backupProviderPostures) as Array<
    [AIBackupPostureProviderName, AIBackupProviderPostureConfig]
  >) {
    if (!isValidAIBackupProviderPosture(env[posture.envKey])) {
      issues.push({
        code: 'invalid_backup_provider_posture',
        message: `${posture.envKey}=${String(env[posture.envKey] || '').trim()} is invalid. Use standby, burst-only, or disabled.`,
      });
    }

    if (provider === 'cloudflare' && !isCloudflareBackupPostureAllowed(posture.posture)) {
      issues.push({
        code: 'invalid_cloudflare_backup_posture',
        message: `${posture.envKey}=${posture.posture} is not allowed. Cloudflare Workers AI backup posture must stay burst-only or disabled while free-only guardrails apply.`,
      });
    }
  }

  if (workersAiMode === 'disabled' && backupProviderPostures.cloudflare.posture !== 'disabled') {
    issues.push({
      code: 'workers_ai_disabled_but_cloudflare_backup_enabled',
      message: `WORKERS_AI_MODE=disabled requires ${backupProviderPostures.cloudflare.envKey}=disabled.`,
    });
  }

  if (workersAiMode === 'free-only' && !ALLOWED_WORKERS_AI_FREE_MODELS.has(workersAiModel)) {
    issues.push({
      code: 'invalid_workers_ai_free_model',
      message: `WORKERS_AI_FREE_MODEL=${workersAiModel} is not allowlisted for free-only mode. Allowed models: ${Array.from(
        ALLOWED_WORKERS_AI_FREE_MODELS,
      ).join(', ')}.`,
    });
  }

  const openrouterFreeScopes = MODEL_SCOPES.filter(
    (scope) => scope !== 'skill_try' && providerModels[scope].openrouter.model.includes(':free'),
  );
  if (openrouterFreeScopes.length > 0) {
    issues.push({
      code: 'openrouter_free_model_outside_skill_try',
      message: `OpenRouter resolves to a free-tier model outside skill_try: ${openrouterFreeScopes
        .map((scope) => describeModelResolution('openrouter', providerModels[scope].openrouter, scope))
        .join(', ')}. Keep shared runtime/probe/script paths off :free models to avoid recurrent 429 pressure.`,
    });
  }

  if (workersAiMode === 'free-only' && workersAiMaxCallsPerRun > DEFAULT_WORKERS_AI_FREE_MAX_CALLS) {
    issues.push({
      code: 'workers_ai_free_run_cap_too_high',
      message: `WORKERS_AI_FREE_MAX_CALLS=${workersAiMaxCallsPerRun} exceeds the enforced free-only ceiling of ${DEFAULT_WORKERS_AI_FREE_MAX_CALLS}.`,
    });
  }

  if (workersAiMode === 'free-only' && workersAiMaxCallsPerDay > DEFAULT_WORKERS_AI_FREE_DAILY_MAX_CALLS) {
    issues.push({
      code: 'workers_ai_free_daily_cap_too_high',
      message: `WORKERS_AI_FREE_DAILY_MAX_CALLS=${workersAiMaxCallsPerDay} exceeds the enforced free-only ceiling of ${DEFAULT_WORKERS_AI_FREE_DAILY_MAX_CALLS}.`,
    });
  }

  return {
    workersAiMode,
    fallbackPolicy,
    workersAiModel,
    providerModels,
    backupProviderPostures,
    workersAiMaxCallsPerRun,
    workersAiMaxCallsPerDay,
    workersAiMaxTokens,
    operatorProfile,
    issues,
  };
}

export function renderAiConfigGuardReport(report: AiConfigGuardReport): string {
  const renderResolutionLine = (
    scope: AIProviderModelScope,
    provider: AIProviderModelName,
    resolution: ResolvedAIProviderModel,
  ): string => {
    const source = resolution.envKey ? `env:${resolution.envKey}` : resolution.source;
    const rejected = resolution.rejectedOverride
      ? ` | rejected ${resolution.rejectedOverride.envKey}=${resolution.rejectedOverride.model}`
      : '';
    return `- ${scope}.${provider}: ${resolution.model} (${source})${rejected}`;
  };

  const lines = [
    '# AI Config Guard',
    '',
    `- Workers AI mode: ${report.workersAiMode}`,
    `- Fallback policy: ${report.fallbackPolicy}`,
    `- Operator profile: ${report.operatorProfile}`,
    `- Workers AI model: ${report.workersAiModel}`,
    `- Workers AI max calls per run: ${report.workersAiMaxCallsPerRun}`,
    `- Workers AI max calls per day: ${report.workersAiMaxCallsPerDay}`,
    `- Workers AI max tokens: ${report.workersAiMaxTokens}`,
    '',
    '## Backup Provider Posture',
    '',
    ...Object.values(report.backupProviderPostures).map((entry) => {
      const reason = entry.reason ? ` | reason=${entry.reason}` : '';
      return `- ${entry.provider}: ${entry.posture} (${entry.source}${reason})`;
    }),
    '',
    '## Resolved Provider Models',
    '',
  ];

  for (const scope of MODEL_SCOPES) {
    lines.push(`### ${scope}`, '');
    for (const provider of MODEL_PROVIDERS) {
      lines.push(renderResolutionLine(scope, provider, report.providerModels[scope][provider]));
    }
    lines.push('');
  }

  if (report.issues.length === 0) {
    lines.push('- Status: pass');
  } else {
    lines.push('- Status: fail', '', '## Issues', '', ...report.issues.map((issue) => `- ${issue.message}`));
  }

  return lines.join('\n');
}

export function assertSafeAiConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): AiConfigGuardReport {
  const report = inspectAiConfigGuard(env);
  if (report.issues.length > 0) {
    throw new Error(renderAiConfigGuardReport(report));
  }
  return report;
}
