import { describe, expect, it } from 'vitest';
import {
  ALLOWED_WORKERS_AI_FREE_MODELS,
  assertSafeAiConfig,
  inspectAiConfigGuard,
  DEFAULT_WORKERS_AI_FREE_MODEL,
  renderAiConfigGuardReport,
  DEFAULT_WORKERS_AI_FREE_DAILY_MAX_CALLS,
  DEFAULT_WORKERS_AI_FREE_MAX_CALLS,
} from './ai-config-guard';

describe('ai config guard', () => {
  it('passes the guarded free-only defaults', () => {
    const report = inspectAiConfigGuard({});

    expect(report).toMatchObject({
      workersAiMode: 'free-only',
      fallbackPolicy: 'guarded',
      workersAiModel: DEFAULT_WORKERS_AI_FREE_MODEL,
      backupProviderPostures: {
        siliconflow: expect.objectContaining({ posture: 'standby' }),
        openrouter: expect.objectContaining({ posture: 'standby' }),
        cloudflare: expect.objectContaining({ posture: 'burst-only' }),
      },
      workersAiMaxCallsPerRun: DEFAULT_WORKERS_AI_FREE_MAX_CALLS,
      workersAiMaxCallsPerDay: DEFAULT_WORKERS_AI_FREE_DAILY_MAX_CALLS,
      issues: [],
    });
    expect(report.providerModels.runtime.openrouter.model).toBe('google/gemini-2.5-flash');
    expect(report.providerModels.skill_try.openrouter.model).toBe('google/gemma-3-27b-it:free');
    expect(renderAiConfigGuardReport(report)).toContain('## Resolved Provider Models');
    expect(renderAiConfigGuardReport(report)).toContain('## Backup Provider Posture');
    expect(renderAiConfigGuardReport(report)).toContain('- Status: pass');
  });

  it('rejects invalid Workers AI modes', () => {
    expect(() => assertSafeAiConfig({ WORKERS_AI_MODE: 'unlimited' })).toThrow(/WORKERS_AI_MODE=unlimited/i);
  });

  it('rejects free-only caps above the enforced ceiling', () => {
    const report = inspectAiConfigGuard({
      WORKERS_AI_MODE: 'free-only',
      WORKERS_AI_FREE_MAX_CALLS: '120',
      WORKERS_AI_FREE_DAILY_MAX_CALLS: '80',
    });

    expect(report.issues.map((issue) => issue.code)).toEqual([
      'workers_ai_free_run_cap_too_high',
      'workers_ai_free_daily_cap_too_high',
    ]);
  });

  it('rejects invalid fallback policies', () => {
    expect(() => assertSafeAiConfig({ AI_FALLBACK_POLICY: 'open-bar' })).toThrow(/AI_FALLBACK_POLICY=open-bar/i);
  });

  it('rejects Workers AI models that are outside the free-only allowlist', () => {
    const report = inspectAiConfigGuard({
      WORKERS_AI_MODE: 'free-only',
      WORKERS_AI_FREE_MODEL: '@cf/meta/llama-3.1-70b-instruct',
    });

    expect(report.issues.map((issue) => issue.code)).toContain('invalid_workers_ai_free_model');
    expect(Array.from(ALLOWED_WORKERS_AI_FREE_MODELS)).toContain(DEFAULT_WORKERS_AI_FREE_MODEL);
  });

  it('rejects OpenRouter free-tier models outside skill try scopes', () => {
    const report = inspectAiConfigGuard({
      OPENROUTER_MODEL: 'google/gemma-3-27b-it:free',
    });

    expect(report.issues.map((issue) => issue.code)).toContain('openrouter_free_model_outside_skill_try');
    expect(renderAiConfigGuardReport(report)).toContain('runtime.openrouter: google/gemma-3-27b-it:free');
  });

  it('surfaces rejected skill-try model overrides in the rendered report', () => {
    const report = inspectAiConfigGuard({
      OPENROUTER_MODEL: 'google/gemini-2.5-flash',
    });

    expect(report.providerModels.skill_try.openrouter.rejectedOverride).toEqual({
      envKey: 'OPENROUTER_MODEL',
      model: 'google/gemini-2.5-flash',
    });
    expect(renderAiConfigGuardReport(report)).toContain(
      'skill_try.openrouter: google/gemma-3-27b-it:free (default) | rejected OPENROUTER_MODEL=google/gemini-2.5-flash',
    );
  });

  it('rejects invalid backup posture values and cloudflare standby posture', () => {
    const report = inspectAiConfigGuard({
      AI_BACKUP_SILICONFLOW_POSTURE: 'hibernate',
      AI_BACKUP_CLOUDFLARE_POSTURE: 'standby',
    });

    expect(report.issues.map((issue) => issue.code)).toEqual([
      'invalid_backup_provider_posture',
      'invalid_cloudflare_backup_posture',
    ]);
  });

  it('requires cloudflare backup posture to disable when Workers AI is disabled', () => {
    const report = inspectAiConfigGuard({
      WORKERS_AI_MODE: 'disabled',
      AI_BACKUP_CLOUDFLARE_POSTURE: 'burst-only',
    });

    expect(report.issues.map((issue) => issue.code)).toContain('workers_ai_disabled_but_cloudflare_backup_enabled');
  });

  it('validates operator profiles including budget and speed', () => {
    const validBudget = inspectAiConfigGuard({ AI_OPERATOR_PROFILE: 'budget' });
    expect(validBudget.issues).toEqual([]);

    const validSpeed = inspectAiConfigGuard({ AI_OPERATOR_PROFILE: 'speed' });
    expect(validSpeed.issues).toEqual([]);

    const invalidProfile = inspectAiConfigGuard({ AI_OPERATOR_PROFILE: 'invalid-profile' });
    expect(invalidProfile.issues.map((issue) => issue.code)).toContain('invalid_operator_profile');
  });

  it('validates composite operator profiles JSON configuration', () => {
    const validComposite = inspectAiConfigGuard({
      AI_OPERATOR_PROFILES_JSON: JSON.stringify({
        development: {
          default: 'workers-ai-fallback',
          harvest: 'workers-ai-fallback'
        },
        production: {
          default: 'nvidia-first',
          translate: 'speed'
        }
      })
    });
    expect(validComposite.issues).toEqual([]);

    const invalidJson = inspectAiConfigGuard({
      AI_OPERATOR_PROFILES_JSON: '{invalid-json}'
    });
    expect(invalidJson.issues.map((issue) => issue.code)).toContain('invalid_operator_profile');

    const invalidProfileInJson = inspectAiConfigGuard({
      AI_OPERATOR_PROFILES_JSON: JSON.stringify({
        production: {
          default: 'ultra-premium-unlimited-cost'
        }
      })
    });
    expect(invalidProfileInJson.issues.map((issue) => issue.code)).toContain('invalid_operator_profile');
  });
});
