import { describe, expect, it } from 'vitest';
import { DEFAULT_SKILL_TRY_PROVIDER_MODELS, resolveAIProviderModel } from './ai-provider-models';

describe('ai provider models', () => {
  it('defaults the shared OpenRouter runtime model away from free-tier hardcoding', () => {
    const resolution = resolveAIProviderModel('openrouter');

    expect(resolution.model).toBe('google/gemini-2.5-flash');
    expect(resolution.source).toBe('default');
  });

  it('prefers translate-specific overrides before the generic provider model env', () => {
    const resolution = resolveAIProviderModel('openrouter', {
      scope: 'translate',
      env: {
        OPENROUTER_MODEL: 'global-model',
        TRANSLATE_MODEL_OPENROUTER: 'translate-model',
      },
    });

    expect(resolution.model).toBe('translate-model');
    expect(resolution.envKey).toBe('TRANSLATE_MODEL_OPENROUTER');
  });

  it('keeps skill-try on its allowlist even when a generic OpenRouter model is configured', () => {
    const resolution = resolveAIProviderModel('openrouter', {
      scope: 'skill_try',
      env: {
        OPENROUTER_MODEL: 'google/gemini-2.5-flash',
      },
      allowList: ['google/gemma-3-27b-it:free'],
    });

    expect(resolution.model).toBe(DEFAULT_SKILL_TRY_PROVIDER_MODELS.openrouter);
    expect(resolution.source).toBe('default');
    expect(resolution.rejectedOverride).toEqual({
      envKey: 'OPENROUTER_MODEL',
      model: 'google/gemini-2.5-flash',
    });
  });
});
