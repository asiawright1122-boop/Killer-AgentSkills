import type { AIOnlineProviderName } from './ai-online-provider-pool';

export type AIProviderModelName = AIOnlineProviderName;
export type AIProviderModelScope = 'runtime' | 'translate' | 'skill_try' | 'script' | 'probe';

export const DEFAULT_RUNTIME_PROVIDER_MODELS: Record<AIProviderModelName, string> = {
  nvidia: 'meta/llama-3.1-70b-instruct',
  siliconflow: 'Qwen/Qwen2.5-72B-Instruct',
  openrouter: 'google/gemini-2.5-flash',
};

export const DEFAULT_TRANSLATE_PROVIDER_MODELS: Record<AIProviderModelName, string> = {
  ...DEFAULT_RUNTIME_PROVIDER_MODELS,
};

export const DEFAULT_SKILL_TRY_PROVIDER_MODELS: Record<AIProviderModelName, string> = {
  nvidia: 'deepseek-ai/deepseek-v3.1',
  siliconflow: 'deepseek-ai/DeepSeek-V3',
  openrouter: 'google/gemma-3-27b-it:free',
};

export const SKILL_TRY_PROVIDER_MODEL_ALLOWLIST: Record<AIProviderModelName, readonly string[]> = {
  nvidia: ['deepseek-ai/deepseek-v3.1'],
  siliconflow: ['deepseek-ai/DeepSeek-V3'],
  openrouter: ['google/gemma-3-27b-it:free'],
};

export const DEFAULT_SCRIPT_PROVIDER_MODELS: Record<AIProviderModelName, string> = {
  nvidia: 'meta/llama-3.3-70b-instruct',
  siliconflow: 'Qwen/Qwen2.5-72B-Instruct',
  openrouter: 'google/gemini-2.5-flash',
};

export const DEFAULT_PROBE_PROVIDER_MODELS: Record<AIProviderModelName, string> = {
  ...DEFAULT_SCRIPT_PROVIDER_MODELS,
};

const DEFAULT_PROVIDER_MODELS_BY_SCOPE: Record<AIProviderModelScope, Record<AIProviderModelName, string>> = {
  runtime: DEFAULT_RUNTIME_PROVIDER_MODELS,
  translate: DEFAULT_TRANSLATE_PROVIDER_MODELS,
  skill_try: DEFAULT_SKILL_TRY_PROVIDER_MODELS,
  script: DEFAULT_SCRIPT_PROVIDER_MODELS,
  probe: DEFAULT_PROBE_PROVIDER_MODELS,
};

const PROVIDER_MODEL_ENV_KEYS_BY_SCOPE: Record<AIProviderModelScope, Record<AIProviderModelName, readonly string[]>> = {
  runtime: {
    nvidia: ['NVIDIA_MODEL'],
    siliconflow: ['SILICONFLOW_MODEL'],
    openrouter: ['OPENROUTER_MODEL'],
  },
  translate: {
    nvidia: ['TRANSLATE_MODEL_NVIDIA', 'NVIDIA_MODEL'],
    siliconflow: ['TRANSLATE_MODEL_SILICONFLOW', 'SILICONFLOW_MODEL'],
    openrouter: ['TRANSLATE_MODEL_OPENROUTER', 'OPENROUTER_MODEL'],
  },
  skill_try: {
    nvidia: ['SKILL_TRY_MODEL_NVIDIA', 'NVIDIA_MODEL'],
    siliconflow: ['SKILL_TRY_MODEL_SILICONFLOW', 'SILICONFLOW_MODEL'],
    openrouter: ['SKILL_TRY_MODEL_OPENROUTER', 'OPENROUTER_MODEL'],
  },
  script: {
    nvidia: ['NVIDIA_MODEL'],
    siliconflow: ['SILICONFLOW_MODEL'],
    openrouter: ['OPENROUTER_MODEL'],
  },
  probe: {
    nvidia: ['NVIDIA_MODEL'],
    siliconflow: ['SILICONFLOW_MODEL'],
    openrouter: ['OPENROUTER_MODEL'],
  },
};

export type ResolvedAIProviderModel = {
  model: string;
  source: 'env' | 'default';
  envKey: string | null;
  rejectedOverride: {
    envKey: string;
    model: string;
  } | null;
};

type EnvStringResolver<Env> = (env: Env | undefined, key: string) => string;

function defaultGetEnvString<Env>(env: Env | undefined, key: string): string {
  const runtimeValue = env && typeof env === 'object' ? (env as Record<string, unknown>)[key] : undefined;
  if (typeof runtimeValue === 'string' && runtimeValue.trim()) {
    return runtimeValue.trim();
  }

  const processValue = typeof process !== 'undefined' ? process.env?.[key] : '';
  return typeof processValue === 'string' ? processValue.trim() : '';
}

export function resolveAIProviderModel<Env = unknown>(
  provider: AIProviderModelName,
  options: {
    scope?: AIProviderModelScope;
    env?: Env;
    defaults?: Partial<Record<AIProviderModelName, string>>;
    allowList?: readonly string[];
    getEnvString?: EnvStringResolver<Env>;
  } = {},
): ResolvedAIProviderModel {
  const scope = options.scope || 'runtime';
  const defaultModel = options.defaults?.[provider] || DEFAULT_PROVIDER_MODELS_BY_SCOPE[scope][provider];
  const getEnvString = options.getEnvString || defaultGetEnvString<Env>;
  let rejectedOverride: ResolvedAIProviderModel['rejectedOverride'] = null;

  for (const envKey of PROVIDER_MODEL_ENV_KEYS_BY_SCOPE[scope][provider]) {
    const candidate = getEnvString(options.env, envKey);
    if (!candidate) continue;

    if (options.allowList && !options.allowList.includes(candidate)) {
      rejectedOverride ||= { envKey, model: candidate };
      continue;
    }

    return {
      model: candidate,
      source: 'env',
      envKey,
      rejectedOverride,
    };
  }

  return {
    model: defaultModel,
    source: 'default',
    envKey: null,
    rejectedOverride,
  };
}
