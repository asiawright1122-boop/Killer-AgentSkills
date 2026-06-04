import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  AIService,
  parseWorkersAiFreeCap,
  parseWorkersAiFreeModel,
  parseWorkersAiMode,
  type AIProviderTelemetrySnapshot,
} from './ai';
import { collectOptimizationIssues, isSkillFullyOptimized } from './skill-quality';
import type { SkillCache } from './types';

const createService = (overrides?: ConstructorParameters<typeof AIService>[0]) => {
  const service = new AIService(overrides);
  (service as any).config = {
    nvidiaKeys: [],
    siliconFlowKey: '',
    openRouterKeys: [],
    cfAccountId: '',
    cfApiToken: '',
    workloadProfile: 'batch_generation',
    ...overrides,
  };
  return service;
};

const setLabelState = (
  service: AIService,
  label: string,
  state: Record<string, unknown> & { provider: 'nvidia' | 'siliconflow' | 'openrouter' | 'cloudflare' },
) => {
  const runtime = service as any;
  runtime.providerLabelStats.set(label, {
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
    quarantinedAt: null,
    quarantineReason: null,
    ...state,
  });
};

const nvidiaLabels = (snapshot: AIProviderTelemetrySnapshot) =>
  snapshot.labelStats
    .filter((entry) => entry.provider === 'nvidia')
    .map((entry) => [entry.label, entry.selectionRank] as const);

const createFallbackRouting = (
  overrides: Partial<AIProviderTelemetrySnapshot['fallbackRouting']> = {},
): AIProviderTelemetrySnapshot['fallbackRouting'] => ({
  policy: 'cold',
  workloadProfile: 'batch_generation',
  backupPriorityOrder: ['siliconflow', 'openrouter', 'cloudflare'],
  backupsAllowed: false,
  activationReason: null,
  decision: 'primary_preferred',
  decisionReason: 'No provider pressure is active.',
  nvidiaConfigured: false,
  nvidiaAvailable: false,
  configuredBackupProviders: [],
  eligibleBackupProviders: [],
  pressureLabels: [],
  recentActivations: [],
  ...overrides,
});

const createWorkersAiTelemetry = (
  overrides: Partial<AIProviderTelemetrySnapshot['workersAi']> = {},
): AIProviderTelemetrySnapshot['workersAi'] => ({
  usageFile: '.tmp/workers-ai-usage.json',
  model: '@cf/meta/llama-3.1-8b-instruct',
  callsThisRun: 0,
  dailyDate: '2026-04-04',
  dailyCalls: 0,
  dailyRemaining: 100,
  runRemaining: 100,
  maxCallsPerRun: 100,
  maxCallsPerDay: 100,
  maxTokens: 800,
  canUse: true,
  status: 'available',
  blockedReason: null,
  ...overrides,
});

describe('AIService provider orchestration', () => {
  const envKeys = [
    'AI_BACKUP_SILICONFLOW_POSTURE',
    'AI_BACKUP_OPENROUTER_POSTURE',
    'AI_BACKUP_CLOUDFLARE_POSTURE',
    'AI_OPERATOR_PROFILE',
  ];
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it('forces Workers AI into free-only unless it is explicitly disabled', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseWorkersAiMode(undefined)).toBe('free-only');
    expect(parseWorkersAiMode('free-only')).toBe('free-only');
    expect(parseWorkersAiMode('disabled')).toBe('disabled');
    expect(parseWorkersAiMode('unlimited')).toBe('free-only');
    expect(parseWorkersAiMode(' paid ')).toBe('free-only');
    expect(warnSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });

  it('forces Workers AI onto an allowlisted free model', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(parseWorkersAiFreeModel(undefined)).toBe('@cf/meta/llama-3.1-8b-instruct');
    expect(parseWorkersAiFreeModel('@cf/meta/llama-3.1-8b-instruct-fp8-fast')).toBe(
      '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
    );
    expect(parseWorkersAiFreeModel('@cf/meta/llama-3.1-70b-instruct')).toBe('@cf/meta/llama-3.1-8b-instruct');
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it('clamps Workers AI free caps to enforced ceilings', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(parseWorkersAiFreeCap(undefined, 60, 'WORKERS_AI_FREE_MAX_CALLS')).toBe(60);
    expect(parseWorkersAiFreeCap('30', 60, 'WORKERS_AI_FREE_MAX_CALLS')).toBe(30);
    expect(parseWorkersAiFreeCap('120', 60, 'WORKERS_AI_FREE_MAX_CALLS')).toBe(60);
    expect(parseWorkersAiFreeCap('80', 60, 'WORKERS_AI_FREE_DAILY_MAX_CALLS')).toBe(60);
    expect(warnSpy).toHaveBeenCalledTimes(2);

    warnSpy.mockRestore();
  });

  it('preserves explicit empty-string config overrides instead of falling back to env-backed providers', () => {
    const service = new AIService({
      nvidiaKeys: [],
      siliconFlowKey: '',
      openRouterKeys: [],
      cfAccountId: '',
      cfApiToken: '',
    });

    expect((service as any).config).toEqual({
      nvidiaKeys: [],
      siliconFlowKey: '',
      openRouterKeys: [],
      cfAccountId: '',
      cfApiToken: '',
      workloadProfile: 'batch_generation',
    });
  });

  it('uses unified provider routing for long-context summaries even without NVIDIA keys', async () => {
    const service = createService({
      nvidiaKeys: [],
      siliconFlowKey: 'siliconflow-key',
      openRouterKeys: [],
      cfAccountId: '',
      cfApiToken: '',
    });
    const callAISpy = vi.spyOn(service, 'callAI').mockResolvedValue('condensed summary');

    const result = await service.generateLongContextSummary('Example Skill', 'a'.repeat(12_000));

    expect(result).toBe('condensed summary');
    expect(callAISpy).toHaveBeenCalledWith(
      expect.stringContaining('Please read this complete open-source project'),
      false,
      'batch_generation',
    );
  });

  it('falls back to a raw slice when no provider capacity exists for long-context summaries', async () => {
    const service = createService({
      nvidiaKeys: [],
      siliconFlowKey: '',
      openRouterKeys: [],
      cfAccountId: '',
      cfApiToken: '',
    });
    const callAISpy = vi.spyOn(service, 'callAI');
    const raw = 'b'.repeat(5_000);

    const result = await service.generateLongContextSummary('Example Skill', raw);

    expect(result).toBe(raw.slice(0, 3000));
    expect(callAISpy).not.toHaveBeenCalled();
  });

  it('prioritizes healthier NVIDIA keys and keeps telemetry snapshots side-effect free', () => {
    const service = createService({ nvidiaKeys: ['k0', 'k1', 'k2', 'k3'] });
    const runtime = service as any;

    runtime.currentNvidiaKeyIndex = 0;
    setLabelState(service, 'N0', {
      provider: 'nvidia',
      failureCount: 3,
      consecutiveRetryableFailures: 2,
      consecutive429s: 1,
      recentRetryableFailureCount: 0,
      recent429Count: 0,
      recentCooldownCount: 0,
      lastPressureAt: null,
      lastStatus: 429,
      lastError: 'nvidia 429',
      lastEventAt: '2026-04-04T00:00:00.000Z',
      lastFailureAt: '2026-04-04T00:00:00.000Z',
    });
    setLabelState(service, 'N1', {
      provider: 'nvidia',
      successCount: 4,
      lastEventAt: '2026-04-04T00:00:10.000Z',
      lastSuccessAt: '2026-04-04T00:00:10.000Z',
    });
    setLabelState(service, 'N2', {
      provider: 'nvidia',
      successCount: 1,
      failureCount: 1,
      consecutiveRetryableFailures: 1,
      lastError: 'This operation was aborted',
      lastEventAt: '2026-04-04T00:00:20.000Z',
      lastSuccessAt: '2026-04-04T00:00:15.000Z',
      lastFailureAt: '2026-04-04T00:00:20.000Z',
    });
    setLabelState(service, 'N3', {
      provider: 'nvidia',
      successCount: 3,
      lastEventAt: '2026-04-04T00:00:30.000Z',
      lastSuccessAt: '2026-04-04T00:00:30.000Z',
    });

    expect(runtime.getAvailableProviders(false, false).map((entry: any) => entry.label)).toEqual([
      'N1',
      'N3',
      'N2',
      'N0',
    ]);

    const beforeIndex = runtime.currentNvidiaKeyIndex;
    const snapshot = service.getTelemetrySnapshot();
    const afterIndex = runtime.currentNvidiaKeyIndex;

    expect(beforeIndex).toBe(0);
    expect(afterIndex).toBe(0);
    expect(snapshot.availableProviders.map((entry) => entry.label)).toEqual(['N1', 'N3', 'N2', 'N0']);
    expect(nvidiaLabels(snapshot)).toEqual([
      ['N0', 4],
      ['N1', 1],
      ['N2', 3],
      ['N3', 2],
    ]);
  });

  it('keeps backup providers cold by default while healthy NVIDIA capacity exists', () => {
    const service = createService({
      nvidiaKeys: ['k0'],
      siliconFlowKey: 's',
      openRouterKeys: ['o0'],
      cfAccountId: 'cf-account',
      cfApiToken: 'cf-token',
    });
    const runtime = service as any;

    expect(runtime.getAvailableProviders(false, false).map((entry: any) => entry.label)).toEqual(['N0']);

    const snapshot = service.getTelemetrySnapshot();
    expect(snapshot.mode.fallbackPolicy).toBe('cold');
    expect(snapshot.fallbackRouting.backupsAllowed).toBe(false);
    expect(snapshot.fallbackRouting.workloadProfile).toBe('batch_generation');
    expect(snapshot.fallbackRouting.backupPriorityOrder).toEqual(['siliconflow', 'openrouter', 'cloudflare']);
    expect(snapshot.fallbackRouting.configuredBackupProviders).toEqual(['siliconflow', 'openrouter', 'cloudflare']);
    expect(snapshot.fallbackRouting.eligibleBackupProviders).toEqual([]);
  });

  it('activates guarded backup routing only when NVIDIA becomes unavailable and records the reason', async () => {
    const service = createService({
      nvidiaKeys: ['k0'],
      openRouterKeys: ['o0'],
      fallbackPolicy: 'guarded',
    });
    const runtime = service as any;

    setLabelState(service, 'N0', {
      provider: 'nvidia',
      quarantinedAt: '2026-04-04T00:00:00.000Z',
      quarantineReason: 'N0:429-quarantine',
      failureCount: 1,
      consecutiveRetryableFailures: 1,
      consecutive429s: 1,
      recentRetryableFailureCount: 0,
      recent429Count: 0,
      recentCooldownCount: 0,
      lastPressureAt: null,
      lastStatus: 429,
      lastError: 'nvidia 429',
      lastEventAt: '2026-04-04T00:00:00.000Z',
      lastFailureAt: '2026-04-04T00:00:00.000Z',
    });

    runtime.callAISingle = async () => 'ok';

    const result = await runtime.executeCallWithRetry('hello', false, 0);
    expect(result).toBe('ok');

    const snapshot = service.getTelemetrySnapshot();
    expect(snapshot.availableProviders.map((entry) => entry.label)).toEqual(['O0']);
    expect(snapshot.fallbackRouting.backupsAllowed).toBe(true);
    expect(snapshot.fallbackRouting.activationReason).toBe('nvidia_unavailable');
    expect(snapshot.fallbackRouting.decision).toBe('backup_recovery');
    expect(snapshot.fallbackRouting.decisionReason).toContain('nvidia_unavailable');
    expect(snapshot.fallbackRouting.pressureLabels).toEqual([
      expect.objectContaining({
        label: 'N0',
        provider: 'nvidia',
        scope: 'primary',
        severity: 'critical',
        consecutive429s: 1,
        pressureScore: expect.any(Number),
        reasons: expect.arrayContaining([
          'quarantined=N0:429-quarantine',
          'consecutive_429s=1',
          'retryable_failures=1',
        ]),
      }),
    ]);
    expect(snapshot.fallbackRouting.recentActivations[0]).toMatchObject({
      provider: 'openrouter',
      label: 'O0',
      reason: 'nvidia_unavailable',
      policy: 'guarded',
      attempt: 1,
    });
    expect(snapshot.recentEvents.some((event) => event.type === 'fallback_activated' && event.label === 'O0')).toBe(
      true,
    );
  });

  it('walks SiliconFlow -> OpenRouter -> Workers AI in order and only spends Workers AI after backup failures', async () => {
    const service = createService({
      nvidiaKeys: [],
      siliconFlowKey: 'siliconflow-key',
      openRouterKeys: ['openrouter-key'],
      cfAccountId: 'cf-account',
      cfApiToken: 'cf-token',
      fallbackPolicy: 'guarded',
    });
    const runtime = service as any;
    const attemptedProviders: string[] = [];

    runtime.callAISingle = async (_prompt: string, provider: string) => {
      attemptedProviders.push(provider);
      if (provider === 'siliconflow') throw new Error('siliconflow 403');
      if (provider === 'openrouter') throw new Error('openrouter 429');
      runtime.reserveWorkersAiCall();
      return 'workers-ai output';
    };

    const result = await runtime.executeCallWithRetry('hello', false, 0);

    expect(result).toBe('workers-ai output');
    expect(attemptedProviders).toEqual(['siliconflow', 'openrouter', 'cloudflare']);

    const snapshot = service.getTelemetrySnapshot();
    expect(snapshot.availableProviders.map((entry) => entry.label)).toEqual(['C']);
    expect(snapshot.fallbackRouting.activationReason).toBe('no_nvidia_configured');
    expect(snapshot.fallbackRouting.decision).toBe('backup_recovery');
    expect(snapshot.fallbackRouting.eligibleBackupProviders).toEqual([{ label: 'C', provider: 'cloudflare' }]);
    expect(snapshot.hardDisabledProviders).toEqual([{ provider: 'siliconflow', reason: 'S:403' }]);
    expect(snapshot.coolingDownProviders[0]).toMatchObject({
      label: 'O0',
      reason: 'O0:429',
    });
    expect(snapshot.workersAi.callsThisRun).toBe(1);
  });

  it('respects backup posture env when selecting recovery-time backups', () => {
    const previousOpenRouterPosture = process.env.AI_BACKUP_OPENROUTER_POSTURE;
    const previousCloudflarePosture = process.env.AI_BACKUP_CLOUDFLARE_POSTURE;

    process.env.AI_BACKUP_OPENROUTER_POSTURE = 'disabled';
    process.env.AI_BACKUP_CLOUDFLARE_POSTURE = 'burst-only';

    try {
      const service = createService({
        nvidiaKeys: [],
        siliconFlowKey: 'siliconflow-key',
        openRouterKeys: ['openrouter-key'],
        cfAccountId: 'cf-account',
        cfApiToken: 'cf-token',
        fallbackPolicy: 'guarded',
      });
      const runtime = service as any;

      expect(runtime.getAvailableProviders(false, false).map((entry: any) => entry.label)).toEqual(['S', 'C']);

      const snapshot = service.getTelemetrySnapshot();
      expect(snapshot.fallbackRouting.configuredBackupProviders).toEqual(['siliconflow', 'openrouter', 'cloudflare']);
      expect(snapshot.availableProviders.map((entry) => entry.label)).toEqual(['S', 'C']);
      expect(snapshot.fallbackRouting.eligibleBackupProviders).toEqual([
        { label: 'S', provider: 'siliconflow' },
        { label: 'C', provider: 'cloudflare' },
      ]);
    } finally {
      if (previousOpenRouterPosture == null) delete process.env.AI_BACKUP_OPENROUTER_POSTURE;
      else process.env.AI_BACKUP_OPENROUTER_POSTURE = previousOpenRouterPosture;

      if (previousCloudflarePosture == null) delete process.env.AI_BACKUP_CLOUDFLARE_POSTURE;
      else process.env.AI_BACKUP_CLOUDFLARE_POSTURE = previousCloudflarePosture;
    }
  });

  it('restores checkpoint telemetry into provider health order and rotation state', () => {
    const service = createService({
      nvidiaKeys: ['k0', 'k1', 'k2', 'k3'],
      openRouterKeys: ['o0', 'o1'],
    });
    const runtime = service as any;
    const snapshot: any = {
      timestamp: '2026-04-04T06:00:00.000Z',
      mode: { workersAi: 'free-only', fallbackPolicy: 'cold', concurrencyLimit: 3, localeBatchSize: 3 },
      stats: { nvidia: 4, siliconflow: 0, openrouter: 2, cloudflare: 0, nvidiaFail: 1 },
      recentEvents: [],
      availableProviders: [
        { label: 'N1', provider: 'nvidia' },
        { label: 'N3', provider: 'nvidia' },
        { label: 'N2', provider: 'nvidia' },
        { label: 'N0', provider: 'nvidia' },
        { label: 'O1', provider: 'openrouter' },
        { label: 'O0', provider: 'openrouter' },
      ],
      quarantinedLabels: [],
      hardDisabledProviders: [],
      coolingDownProviders: [],
      fallbackRouting: createFallbackRouting({
        policy: 'cold',
        nvidiaConfigured: true,
        nvidiaAvailable: true,
        configuredBackupProviders: ['openrouter'],
      }),
      workersAi: createWorkersAiTelemetry(),
      labelStats: [
        {
          label: 'N0',
          provider: 'nvidia',
          selectionRank: 4,
          successCount: 1,
          failureCount: 2,
          consecutiveRetryableFailures: 2,
          consecutive429s: 1,
          recentRetryableFailureCount: 0,
          recent429Count: 0,
          recentCooldownCount: 0,
          lastPressureAt: null,
          lastStatus: 429,
          lastError: 'nvidia 429',
          lastEventAt: '2026-04-04T05:59:00.000Z',
          lastSuccessAt: '2026-04-04T05:50:00.000Z',
          lastFailureAt: '2026-04-04T05:59:00.000Z',
          currentlyAvailable: true,
          coolingDown: false,
          cooldownUntil: null,
          cooldownReason: null,
          quarantined: false,
          quarantinedAt: null,
          quarantineReason: null,
          hardDisabled: false,
          hardDisableReason: null,
        },
        {
          label: 'N1',
          provider: 'nvidia',
          selectionRank: 1,
          successCount: 4,
          failureCount: 0,
          consecutiveRetryableFailures: 0,
          consecutive429s: 0,
          recentRetryableFailureCount: 0,
          recent429Count: 0,
          recentCooldownCount: 0,
          lastPressureAt: null,
          lastStatus: null,
          lastError: null,
          lastEventAt: '2026-04-04T05:58:00.000Z',
          lastSuccessAt: '2026-04-04T05:58:00.000Z',
          lastFailureAt: null,
          currentlyAvailable: true,
          coolingDown: false,
          cooldownUntil: null,
          cooldownReason: null,
          quarantined: false,
          quarantinedAt: null,
          quarantineReason: null,
          hardDisabled: false,
          hardDisableReason: null,
        },
        {
          label: 'N2',
          provider: 'nvidia',
          selectionRank: 3,
          successCount: 1,
          failureCount: 1,
          consecutiveRetryableFailures: 1,
          consecutive429s: 0,
          recentRetryableFailureCount: 0,
          recent429Count: 0,
          recentCooldownCount: 0,
          lastPressureAt: null,
          lastStatus: null,
          lastError: 'This operation was aborted',
          lastEventAt: '2026-04-04T05:57:00.000Z',
          lastSuccessAt: '2026-04-04T05:56:00.000Z',
          lastFailureAt: '2026-04-04T05:57:00.000Z',
          currentlyAvailable: true,
          coolingDown: false,
          cooldownUntil: null,
          cooldownReason: null,
          quarantined: false,
          quarantinedAt: null,
          quarantineReason: null,
          hardDisabled: false,
          hardDisableReason: null,
        },
        {
          label: 'N3',
          provider: 'nvidia',
          selectionRank: 2,
          successCount: 3,
          failureCount: 0,
          consecutiveRetryableFailures: 0,
          consecutive429s: 0,
          recentRetryableFailureCount: 0,
          recent429Count: 0,
          recentCooldownCount: 0,
          lastPressureAt: null,
          lastStatus: null,
          lastError: null,
          lastEventAt: '2026-04-04T05:55:00.000Z',
          lastSuccessAt: '2026-04-04T05:55:00.000Z',
          lastFailureAt: null,
          currentlyAvailable: true,
          coolingDown: false,
          cooldownUntil: null,
          cooldownReason: null,
          quarantined: false,
          quarantinedAt: null,
          quarantineReason: null,
          hardDisabled: false,
          hardDisableReason: null,
        },
        {
          label: 'O0',
          provider: 'openrouter',
          selectionRank: 6,
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
          currentlyAvailable: true,
          coolingDown: false,
          cooldownUntil: null,
          cooldownReason: null,
          quarantined: false,
          quarantinedAt: null,
          quarantineReason: null,
          hardDisabled: false,
          hardDisableReason: null,
        },
        {
          label: 'O1',
          provider: 'openrouter',
          selectionRank: 5,
          successCount: 1,
          failureCount: 0,
          consecutiveRetryableFailures: 0,
          consecutive429s: 0,
          recentRetryableFailureCount: 0,
          recent429Count: 0,
          recentCooldownCount: 0,
          lastPressureAt: null,
          lastStatus: null,
          lastError: null,
          lastEventAt: '2026-04-04T05:54:00.000Z',
          lastSuccessAt: '2026-04-04T05:54:00.000Z',
          lastFailureAt: null,
          currentlyAvailable: true,
          coolingDown: false,
          cooldownUntil: null,
          cooldownReason: null,
          quarantined: false,
          quarantinedAt: null,
          quarantineReason: null,
          hardDisabled: false,
          hardDisableReason: null,
        },
      ],
    };

    service.restoreTelemetrySnapshot(snapshot);

    expect(runtime.currentNvidiaKeyIndex).toBe(1);
    expect(runtime.currentOpenrouterKeyIndex).toBe(1);
    expect(runtime.getAvailableProviders(false, false).map((entry: any) => entry.label)).toEqual([
      'N1',
      'N3',
      'N2',
      'N0',
    ]);
    const restored = service.getTelemetrySnapshot();
    expect(restored.stats).toEqual(snapshot.stats);
    expect(restored.workersAi.callsThisRun).toBe(0);
    expect(restored.mode.fallbackPolicy).toBe('cold');
  });

  it('resets run-scoped quarantine on restore while preserving cooldown and durable hard-disable state', () => {
    const service = createService({
      nvidiaKeys: ['k0', 'k1'],
      siliconFlowKey: 's',
      openRouterKeys: ['o0'],
      cfAccountId: 'cf-account',
      cfApiToken: 'cf-token',
    });
    const runtime = service as any;
    const snapshot: any = {
      timestamp: '2026-04-04T06:10:00.000Z',
      mode: { workersAi: 'free-only', fallbackPolicy: 'cold', concurrencyLimit: 3, localeBatchSize: 3 },
      stats: { nvidia: 1, siliconflow: 0, openrouter: 1, cloudflare: 0, nvidiaFail: 0 },
      recentEvents: [],
      availableProviders: [
        { label: 'S', provider: 'siliconflow' },
        { label: 'O0', provider: 'openrouter' },
      ],
      quarantinedLabels: [
        { label: 'N1', provider: 'nvidia', reason: 'N1:429-quarantine', quarantinedAt: '2026-04-04T06:00:00.000Z' },
      ],
      hardDisabledProviders: [{ provider: 'cloudflare', reason: 'C:429' }],
      coolingDownProviders: [{ label: 'N0', until: '2099-01-01T00:00:00.000Z', msRemaining: 1, reason: 'N0:network' }],
      fallbackRouting: createFallbackRouting({
        policy: 'cold',
        nvidiaConfigured: true,
        nvidiaAvailable: false,
        configuredBackupProviders: ['siliconflow', 'openrouter', 'cloudflare'],
      }),
      workersAi: createWorkersAiTelemetry(),
      labelStats: [
        {
          label: 'N0',
          provider: 'nvidia',
          selectionRank: null,
          successCount: 1,
          failureCount: 1,
          consecutiveRetryableFailures: 1,
          consecutive429s: 0,
          recentRetryableFailureCount: 0,
          recent429Count: 0,
          recentCooldownCount: 0,
          lastPressureAt: null,
          lastStatus: null,
          lastError: 'network timeout',
          lastEventAt: '2026-04-04T06:05:00.000Z',
          lastSuccessAt: '2026-04-04T06:00:00.000Z',
          lastFailureAt: '2026-04-04T06:05:00.000Z',
          currentlyAvailable: false,
          coolingDown: true,
          cooldownUntil: '2099-01-01T00:00:00.000Z',
          cooldownReason: 'N0:network',
          quarantined: false,
          quarantinedAt: null,
          quarantineReason: null,
          hardDisabled: false,
          hardDisableReason: null,
        },
        {
          label: 'N1',
          provider: 'nvidia',
          selectionRank: null,
          successCount: 0,
          failureCount: 2,
          consecutiveRetryableFailures: 2,
          consecutive429s: 1,
          recentRetryableFailureCount: 0,
          recent429Count: 0,
          recentCooldownCount: 0,
          lastPressureAt: null,
          lastStatus: 429,
          lastError: 'nvidia 429',
          lastEventAt: '2026-04-04T06:06:00.000Z',
          lastSuccessAt: null,
          lastFailureAt: '2026-04-04T06:06:00.000Z',
          currentlyAvailable: false,
          coolingDown: false,
          cooldownUntil: null,
          cooldownReason: null,
          quarantined: true,
          quarantinedAt: '2026-04-04T06:06:00.000Z',
          quarantineReason: 'N1:429-quarantine',
          hardDisabled: false,
          hardDisableReason: null,
        },
        {
          label: 'O0',
          provider: 'openrouter',
          selectionRank: 2,
          successCount: 1,
          failureCount: 0,
          consecutiveRetryableFailures: 0,
          consecutive429s: 0,
          recentRetryableFailureCount: 0,
          recent429Count: 0,
          recentCooldownCount: 0,
          lastPressureAt: null,
          lastStatus: null,
          lastError: null,
          lastEventAt: '2026-04-04T06:04:00.000Z',
          lastSuccessAt: '2026-04-04T06:04:00.000Z',
          lastFailureAt: null,
          currentlyAvailable: true,
          coolingDown: false,
          cooldownUntil: null,
          cooldownReason: null,
          quarantined: false,
          quarantinedAt: null,
          quarantineReason: null,
          hardDisabled: false,
          hardDisableReason: null,
        },
        {
          label: 'S',
          provider: 'siliconflow',
          selectionRank: 1,
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
          currentlyAvailable: true,
          coolingDown: false,
          cooldownUntil: null,
          cooldownReason: null,
          quarantined: false,
          quarantinedAt: null,
          quarantineReason: null,
          hardDisabled: false,
          hardDisableReason: null,
        },
        {
          label: 'C',
          provider: 'cloudflare',
          selectionRank: null,
          successCount: 0,
          failureCount: 1,
          consecutiveRetryableFailures: 0,
          consecutive429s: 0,
          recentRetryableFailureCount: 0,
          recent429Count: 0,
          recentCooldownCount: 0,
          lastPressureAt: null,
          lastStatus: 429,
          lastError: 'cloudflare 429',
          lastEventAt: '2026-04-04T06:03:00.000Z',
          lastSuccessAt: null,
          lastFailureAt: '2026-04-04T06:03:00.000Z',
          currentlyAvailable: false,
          coolingDown: false,
          cooldownUntil: null,
          cooldownReason: null,
          quarantined: false,
          quarantinedAt: null,
          quarantineReason: null,
          hardDisabled: true,
          hardDisableReason: 'C:429',
        },
      ],
    };

    service.restoreTelemetrySnapshot(snapshot);

    expect(runtime.getAvailableProviders(false, false).map((entry: any) => entry.label)).toEqual(['N1']);
    const restored = service.getTelemetrySnapshot();
    expect(restored.quarantinedLabels).toEqual([]);
    expect(restored.hardDisabledProviders).toEqual([{ provider: 'cloudflare', reason: 'C:429' }]);
    expect(restored.coolingDownProviders[0]?.label).toBe('N0');
    expect(restored.mode.fallbackPolicy).toBe('cold');
  });

  it('omits Cloudflare when the Workers AI budget gate is closed and records the event', () => {
    const service = createService({
      nvidiaKeys: ['k0'],
      cfAccountId: 'cf-account',
      cfApiToken: 'cf-token',
      fallbackPolicy: 'always',
    });
    const runtime = service as any;

    runtime.workersAiCallsThisRun = 999;

    expect(runtime.getAvailableProviders(true, false).map((entry: any) => entry.label)).toEqual(['N0']);
    const snapshot = service.getTelemetrySnapshot();
    expect(snapshot.availableProviders.map((entry) => entry.label)).toEqual(['N0']);
    expect(
      snapshot.recentEvents.some((event) => event.type === 'workers_budget_exhausted' && event.label === 'C'),
    ).toBe(true);
  });

  it('hard-disables Cloudflare for the run after repeated retryable free-only failures', () => {
    const service = createService({
      cfAccountId: 'cf-account',
      cfApiToken: 'cf-token',
      fallbackPolicy: 'guarded',
    });
    const runtime = service as any;

    setLabelState(service, 'C', {
      provider: 'cloudflare',
      failureCount: 3,
      consecutiveRetryableFailures: 3,
      lastError: 'This operation was aborted',
      lastEventAt: '2026-04-04T00:00:00.000Z',
      lastFailureAt: '2026-04-04T00:00:00.000Z',
    });

    runtime.applyFailurePolicy(
      { provider: 'cloudflare', key: 'cf-token', label: 'C' },
      undefined,
      'This operation was aborted',
    );

    const snapshot = service.getTelemetrySnapshot();
    expect(snapshot.hardDisabledProviders).toEqual([{ provider: 'cloudflare', reason: 'C:retryable-failures:3' }]);
    expect(snapshot.availableProviders).toEqual([]);
  });

  it('does not carry Cloudflare retryable-failure hard-disable across checkpoint restore', () => {
    const service = createService({
      cfAccountId: 'cf-account',
      cfApiToken: 'cf-token',
      fallbackPolicy: 'guarded',
    });

    service.restoreTelemetrySnapshot({
      timestamp: '2026-04-04T06:20:00.000Z',
      mode: { workersAi: 'free-only', fallbackPolicy: 'guarded', concurrencyLimit: 3, localeBatchSize: 3 },
      stats: { nvidia: 0, siliconflow: 0, openrouter: 0, cloudflare: 1, nvidiaFail: 0 },
      recentEvents: [],
      availableProviders: [],
      quarantinedLabels: [],
      hardDisabledProviders: [{ provider: 'cloudflare', reason: 'C:retryable-failures:3' }],
      coolingDownProviders: [],
      fallbackRouting: createFallbackRouting({
        policy: 'guarded',
        backupsAllowed: true,
        activationReason: 'no_nvidia_configured',
        configuredBackupProviders: ['cloudflare'],
        eligibleBackupProviders: [{ label: 'C', provider: 'cloudflare' }],
      }),
      workersAi: createWorkersAiTelemetry({
        callsThisRun: 3,
        dailyCalls: 3,
        dailyRemaining: 117,
        runRemaining: 117,
        maxCallsPerRun: 120,
        maxCallsPerDay: 120,
        maxTokens: 1024,
      }),
      labelStats: [
        {
          label: 'C',
          provider: 'cloudflare',
          selectionRank: null,
          successCount: 1,
          failureCount: 3,
          consecutiveRetryableFailures: 3,
          consecutive429s: 0,
          recentRetryableFailureCount: 0,
          recent429Count: 0,
          recentCooldownCount: 0,
          lastPressureAt: null,
          lastStatus: null,
          lastError: 'This operation was aborted',
          lastEventAt: '2026-04-04T06:19:00.000Z',
          lastSuccessAt: '2026-04-04T06:18:00.000Z',
          lastFailureAt: '2026-04-04T06:19:00.000Z',
          currentlyAvailable: false,
          coolingDown: false,
          cooldownUntil: null,
          cooldownReason: null,
          quarantined: false,
          quarantinedAt: null,
          quarantineReason: null,
          hardDisabled: true,
          hardDisableReason: 'C:retryable-failures:3',
          circuitBreakerOpen: false,
          averageLatencyMs: 0,
        },
      ],
    });

    const snapshot = service.getTelemetrySnapshot();
    expect(snapshot.hardDisabledProviders).toEqual([]);
    expect(snapshot.availableProviders.map((entry) => entry.label)).toEqual(['C']);
  });

  it('keeps Cloudflare available before the retryable free-only failure threshold is hit', () => {
    const service = createService({
      cfAccountId: 'cf-account',
      cfApiToken: 'cf-token',
      fallbackPolicy: 'guarded',
    });
    const runtime = service as any;

    setLabelState(service, 'C', {
      provider: 'cloudflare',
      failureCount: 2,
      consecutiveRetryableFailures: 2,
      lastError: 'This operation was aborted',
      lastEventAt: '2026-04-04T00:00:00.000Z',
      lastFailureAt: '2026-04-04T00:00:00.000Z',
    });

    runtime.applyFailurePolicy(
      { provider: 'cloudflare', key: 'cf-token', label: 'C' },
      undefined,
      'This operation was aborted',
    );

    const snapshot = service.getTelemetrySnapshot();
    expect(snapshot.hardDisabledProviders).toEqual([]);
    expect(snapshot.availableProviders).toEqual([]);
    expect(snapshot.coolingDownProviders[0]?.label).toBe('C');
  });

  it('repairs legacy metadata and agent analysis deterministically before AI fallback is needed', () => {
    const service = createService({
      nvidiaKeys: [],
      siliconFlowKey: '',
      openRouterKeys: [],
      cfAccountId: '',
      cfApiToken: '',
    });

    const repairedMetadata = service.repairMetadataDeterministically(
      'Guide for creating custom variants for existing gluestack-ui v4 components with reusable styling patterns.',
      {
        name: 'gluestack-ui-v4:variants',
        topics: ['gluestack-ui', 'component styling'],
        bodyPreview:
          '# Creating variants\nCreate custom variants for gluestack-ui v4 components while keeping type safety and consistent styling.',
        category: 'frontend',
      },
      {
        description: { en: 'Guide for creating custom variants for existing gluestack-ui v4 components.' },
        seo: {
          title: { en: 'gluestack-ui-v4 variants guide' },
          description: { en: 'Read more about creating custom variants for components...' },
          definition: {},
          features: {},
          keywords: { en: ['guide', 'tutorial', 'component styling'] },
        },
      },
    );

    const repairedAgentAnalysis = service.repairAgentAnalysisDeterministically(
      'gluestack-ui-v4:variants',
      repairedMetadata.description.en,
      'Create custom variants for gluestack-ui v4 components while keeping type safety and reusable styling patterns.',
      {
        suitability: {
          en: 'Ideal for AI agents that need gluestack-ui component variant guidance.',
          zh: 'Ideal for AI agents that need gluestack-ui component variant guidance.',
        },
        recommendation: {
          en: 'Use this skill to build reusable gluestack-ui variants with type safety.',
        },
        useCases: {
          en: ['Applying reusable gluestack-ui component variants'],
        },
        limitations: {
          en: ['Requires repository-specific context'],
        },
        version: 2,
      },
    );

    const skill: SkillCache = {
      id: 'example/gluestack-ui-v4:variants',
      name: 'gluestack-ui-v4:variants',
      description: repairedMetadata.description,
      owner: 'example',
      repo: 'repo',
      repoPath: 'example/repo',
      stars: 0,
      forks: 0,
      updatedAt: '2026-04-05T00:00:00.000Z',
      topics: ['gluestack-ui', 'component styling'],
      lastSynced: '2026-04-05T00:00:00.000Z',
      seo: repairedMetadata.seo,
      agentAnalysis: repairedAgentAnalysis,
      skillMd: {
        name: 'gluestack-ui-v4:variants',
        description: 'Guide for creating custom variants for existing gluestack-ui v4 components.',
        bodyPreview:
          '# Creating variants\nCreate custom variants for gluestack-ui v4 components while keeping type safety and consistent styling.',
      },
    };

    expect(isSkillFullyOptimized(skill)).toBe(true);
    expect(collectOptimizationIssues(skill)).toEqual([]);
  });

  it('builds deterministic fallback metadata and analysis that pass the optimization gate when AI is unavailable', async () => {
    const service = createService({
      nvidiaKeys: [],
      siliconFlowKey: '',
      openRouterKeys: [],
      cfAccountId: '',
      cfApiToken: '',
    });

    const metadata = await service.translateMetadata(
      'Guide for creating custom variants for gluestack-ui v4 components with reusable styling patterns and type safety.',
      {
        name: 'gluestack-ui-v4:variants',
        topics: ['gluestack-ui', 'tailwind variants', 'component styling'],
        bodyPreview:
          '# Creating Component Variants\n- Create custom variants for existing components\n- Extend the design system with reusable patterns\n- Maintain consistency and type safety\n- Requires gluestack-ui v4 components',
        category: 'frontend',
      },
    );
    const rawAnalysis = await service.generateAgentAnalysis(
      'gluestack-ui-v4:variants',
      'Guide for creating custom variants for gluestack-ui v4 components.',
      'Create custom variants, maintain type safety, and extend the design system. Requires gluestack-ui v4 components.',
    );
    const translatedAnalysis = await service.translateAgentAnalysis(rawAnalysis!);

    const skill: SkillCache = {
      id: 'example/gluestack-ui-v4:variants',
      name: 'gluestack-ui-v4:variants',
      description: metadata.description,
      owner: 'example',
      repo: 'repo',
      repoPath: 'example/repo',
      stars: 0,
      forks: 0,
      updatedAt: '2026-04-04T00:00:00.000Z',
      topics: ['gluestack-ui', 'tailwind variants', 'component styling'],
      lastSynced: '2026-04-04T00:00:00.000Z',
      seo: metadata.seo,
      agentAnalysis: translatedAnalysis,
    };

    expect(isSkillFullyOptimized(skill)).toBe(true);
    expect(collectOptimizationIssues(skill)).toEqual([]);
  });
});
