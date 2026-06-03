export type AIBackupPostureProviderName = 'siliconflow' | 'openrouter' | 'cloudflare';
export type AIBackupProviderPosture = 'standby' | 'burst-only' | 'disabled';
export type AIWorkersPolicyMode = 'free-only' | 'disabled';

export type AIOperatorProfileName =
  | 'nvidia-first'
  | 'workers-ai-fallback'
  | 'openrouter-preferred'
  | 'budget'
  | 'speed';

export const DEFAULT_OPERATOR_PROFILE: AIOperatorProfileName = 'nvidia-first';
export const VALID_OPERATOR_PROFILES = new Set<AIOperatorProfileName>([
  'nvidia-first',
  'workers-ai-fallback',
  'openrouter-preferred',
  'budget',
  'speed',
]);

export function parseAIOperatorProfile(raw: string | undefined | null): AIOperatorProfileName {
  const normalized = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  if (VALID_OPERATOR_PROFILES.has(normalized as AIOperatorProfileName)) {
    return normalized as AIOperatorProfileName;
  }
  return DEFAULT_OPERATOR_PROFILE;
}

export type AIBackupProviderPostureConfig = {
  provider: AIBackupPostureProviderName;
  posture: AIBackupProviderPosture;
  reason: string | null;
  envKey: string;
  reasonEnvKey: string;
  source: 'default' | 'env';
};

export const AI_BACKUP_PROVIDER_POSTURE_ENV_KEYS: Record<AIBackupPostureProviderName, string> = {
  siliconflow: 'AI_BACKUP_SILICONFLOW_POSTURE',
  openrouter: 'AI_BACKUP_OPENROUTER_POSTURE',
  cloudflare: 'AI_BACKUP_CLOUDFLARE_POSTURE',
};

export const AI_BACKUP_PROVIDER_REASON_ENV_KEYS: Record<AIBackupPostureProviderName, string> = {
  siliconflow: 'AI_BACKUP_SILICONFLOW_REASON',
  openrouter: 'AI_BACKUP_OPENROUTER_REASON',
  cloudflare: 'AI_BACKUP_CLOUDFLARE_REASON',
};

const VALID_BACKUP_POSTURES = new Set<AIBackupProviderPosture>(['standby', 'burst-only', 'disabled']);

function normalizeValue(raw: string | undefined | null): string {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

function normalizeReason(raw: string | undefined | null): string | null {
  const normalized = String(raw || '').trim();
  return normalized ? normalized : null;
}

export function defaultAIBackupProviderPosture(
  provider: AIBackupPostureProviderName,
  workersAiMode: AIWorkersPolicyMode = 'free-only',
): AIBackupProviderPosture {
  if (provider === 'cloudflare') {
    return workersAiMode === 'disabled' ? 'disabled' : 'burst-only';
  }
  return 'standby';
}

export function parseAIBackupProviderPosture(
  raw: string | undefined | null,
  provider: AIBackupPostureProviderName,
  workersAiMode: AIWorkersPolicyMode = 'free-only',
): AIBackupProviderPosture {
  const normalized = normalizeValue(raw);
  if (VALID_BACKUP_POSTURES.has(normalized as AIBackupProviderPosture)) {
    return normalized as AIBackupProviderPosture;
  }
  return defaultAIBackupProviderPosture(provider, workersAiMode);
}

export function inspectAIBackupProviderPosture(
  provider: AIBackupPostureProviderName,
  env: Record<string, string | undefined> = process.env,
  workersAiMode: AIWorkersPolicyMode = 'free-only',
): AIBackupProviderPostureConfig {
  const envKey = AI_BACKUP_PROVIDER_POSTURE_ENV_KEYS[provider];
  const reasonEnvKey = AI_BACKUP_PROVIDER_REASON_ENV_KEYS[provider];
  const rawPosture = env[envKey];
  const normalized = normalizeValue(rawPosture);
  const posture = parseAIBackupProviderPosture(rawPosture, provider, workersAiMode);

  return {
    provider,
    posture,
    reason:
      normalizeReason(env[reasonEnvKey]) ||
      (provider === 'cloudflare' && posture === 'burst-only'
        ? 'Workers AI remains a free-only last-resort backup during recovery.'
        : null),
    envKey,
    reasonEnvKey,
    source: normalized && VALID_BACKUP_POSTURES.has(normalized as AIBackupProviderPosture) ? 'env' : 'default',
  };
}

export function inspectAIBackupProviderPostures(
  env: Record<string, string | undefined> = process.env,
  workersAiMode: AIWorkersPolicyMode = 'free-only',
): Record<AIBackupPostureProviderName, AIBackupProviderPostureConfig> {
  return {
    siliconflow: inspectAIBackupProviderPosture('siliconflow', env, workersAiMode),
    openrouter: inspectAIBackupProviderPosture('openrouter', env, workersAiMode),
    cloudflare: inspectAIBackupProviderPosture('cloudflare', env, workersAiMode),
  };
}

export function resolveBackupPosturePriorityOffset(posture: AIBackupProviderPosture): number {
  if (posture === 'burst-only') return 100;
  if (posture === 'disabled') return 1000;
  return 0;
}

export function isCloudflareBackupPostureAllowed(posture: AIBackupProviderPosture): boolean {
  return posture === 'burst-only' || posture === 'disabled';
}

export function isValidAIBackupProviderPosture(raw: string | undefined | null): boolean {
  const normalized = normalizeValue(raw);
  return !normalized || VALID_BACKUP_POSTURES.has(normalized as AIBackupProviderPosture);
}

export function renderAIBackupProviderPosture(
  config: AIBackupProviderPostureConfig,
  includeEnvKey: boolean = false,
): string {
  const bits = [`${config.provider}=${config.posture}`];
  if (config.reason) bits.push(config.reason);
  if (includeEnvKey) bits.push(`${config.envKey}:${config.source}`);
  return bits.join(' | ');
}
