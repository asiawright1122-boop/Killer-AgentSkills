import { describe, expect, it } from 'vitest';
import {
  buildProviderRoutingPlan,
  getProviderRotationOrder,
  orderProviderCandidatesByHealth,
} from './ai-provider-routing';

describe('ai provider routing', () => {
  it('orders candidates by health first and rotation second', () => {
    const stateByLabel = new Map([
      [
        'N0',
        {
          provider: 'nvidia' as const,
          failureCount: 3,
          consecutiveRetryableFailures: 2,
          consecutive429s: 1,
          successCount: 0,
        },
      ],
      [
        'N1',
        {
          provider: 'nvidia' as const,
          failureCount: 0,
          consecutiveRetryableFailures: 0,
          consecutive429s: 0,
          successCount: 4,
        },
      ],
      [
        'N2',
        {
          provider: 'nvidia' as const,
          failureCount: 1,
          consecutiveRetryableFailures: 1,
          consecutive429s: 0,
          successCount: 1,
        },
      ],
      [
        'N3',
        {
          provider: 'nvidia' as const,
          failureCount: 0,
          consecutiveRetryableFailures: 0,
          consecutive429s: 0,
          successCount: 3,
        },
      ],
    ]);

    const ordered = orderProviderCandidatesByHealth(
      [
        { provider: 'nvidia' as const, label: 'N0', rotationOrder: getProviderRotationOrder(0, 0, 4) },
        { provider: 'nvidia' as const, label: 'N1', rotationOrder: getProviderRotationOrder(1, 0, 4) },
        { provider: 'nvidia' as const, label: 'N2', rotationOrder: getProviderRotationOrder(2, 0, 4) },
        { provider: 'nvidia' as const, label: 'N3', rotationOrder: getProviderRotationOrder(3, 0, 4) },
      ],
      stateByLabel,
    );

    expect(ordered.map((entry) => entry.label)).toEqual(['N1', 'N3', 'N2', 'N0']);
  });

  it('keeps backup providers cold while NVIDIA is available', () => {
    const plan = buildProviderRoutingPlan({
      primaryCandidates: [{ provider: 'nvidia' as const, label: 'N0', rotationOrder: 0, available: true }],
      backupCandidates: [
        { provider: 'siliconflow' as const, label: 'S', groupPriority: 0, rotationOrder: 0, available: true },
        { provider: 'openrouter' as const, label: 'O0', groupPriority: 1, rotationOrder: 0, available: true },
      ],
      stateByLabel: new Map(),
      policy: 'cold',
      nvidiaConfigured: true,
    });

    expect(plan.primaryOrder.map((entry) => entry.label)).toEqual(['N0']);
    expect(plan.backupOrder).toEqual([]);
    expect(plan.fallbackRouting).toMatchObject({
      policy: 'cold',
      backupsAllowed: false,
      activationReason: null,
      decision: 'primary_preferred',
      nvidiaConfigured: true,
      nvidiaAvailable: true,
      configuredBackupProviders: ['siliconflow', 'openrouter'],
      eligibleBackupProviders: [],
      pressureLabels: [],
    });
  });

  it('activates guarded backups only when NVIDIA is unavailable', () => {
    const plan = buildProviderRoutingPlan({
      primaryCandidates: [{ provider: 'nvidia' as const, label: 'N0', rotationOrder: 0, available: false }],
      backupCandidates: [
        { provider: 'siliconflow' as const, label: 'S', groupPriority: 0, rotationOrder: 0, available: true },
        { provider: 'openrouter' as const, label: 'O0', groupPriority: 1, rotationOrder: 0, available: true },
      ],
      stateByLabel: new Map(),
      policy: 'guarded',
      workloadProfile: 'interactive_demo',
      nvidiaConfigured: true,
    });

    expect(plan.primaryOrder).toEqual([]);
    expect(plan.backupOrder.map((entry) => entry.label)).toEqual(['S', 'O0']);
    expect(plan.fallbackRouting).toMatchObject({
      policy: 'guarded',
      workloadProfile: 'interactive_demo',
      backupsAllowed: true,
      activationReason: 'nvidia_unavailable',
      decision: 'backup_recovery',
      nvidiaConfigured: true,
      nvidiaAvailable: false,
      backupPriorityOrder: ['siliconflow', 'openrouter', 'cloudflare'],
      configuredBackupProviders: ['siliconflow', 'openrouter'],
      eligibleBackupProviders: [
        { label: 'S', provider: 'siliconflow' },
        { label: 'O0', provider: 'openrouter' },
      ],
    });
  });

  it('changes backup ordering by workload profile when guarded fallback is active', () => {
    const batchPlan = buildProviderRoutingPlan({
      primaryCandidates: [],
      backupCandidates: [
        { provider: 'siliconflow' as const, label: 'S', groupPriority: 0, rotationOrder: 0, available: true },
        { provider: 'openrouter' as const, label: 'O0', groupPriority: 1, rotationOrder: 0, available: true },
      ],
      stateByLabel: new Map(),
      policy: 'guarded',
      workloadProfile: 'batch_generation',
      nvidiaConfigured: false,
    });

    const interactivePlan = buildProviderRoutingPlan({
      primaryCandidates: [],
      backupCandidates: [
        { provider: 'siliconflow' as const, label: 'S', groupPriority: 0, rotationOrder: 0, available: true },
        { provider: 'openrouter' as const, label: 'O0', groupPriority: 1, rotationOrder: 0, available: true },
      ],
      stateByLabel: new Map(),
      policy: 'guarded',
      workloadProfile: 'interactive_demo',
      nvidiaConfigured: false,
    });

    expect(batchPlan.backupOrder.map((entry) => entry.label)).toEqual(['S', 'O0']);
    expect(batchPlan.fallbackRouting.workloadProfile).toBe('batch_generation');
    expect(batchPlan.fallbackRouting.backupPriorityOrder).toEqual(['siliconflow', 'openrouter', 'cloudflare']);

    expect(interactivePlan.backupOrder.map((entry) => entry.label)).toEqual(['S', 'O0']);
    expect(interactivePlan.fallbackRouting.workloadProfile).toBe('interactive_demo');
  });

  it('surfaces label-level pressure evidence when guarded fallback stays parked', () => {
    const plan = buildProviderRoutingPlan({
      primaryCandidates: [
        { provider: 'nvidia' as const, label: 'N0', rotationOrder: 0, available: false },
        { provider: 'nvidia' as const, label: 'N1', rotationOrder: 1, available: true },
      ],
      backupCandidates: [
        { provider: 'openrouter' as const, label: 'O0', groupPriority: 1, rotationOrder: 0, available: true },
      ],
      stateByLabel: new Map([
        [
          'N0',
          {
            provider: 'nvidia' as const,
            failureCount: 3,
            consecutiveRetryableFailures: 2,
            consecutive429s: 1,
            coolingDown: true,
            cooldownReason: 'N0:429',
            lastStatus: 429,
            lastError: 'nvidia 429',
          },
        ],
      ]),
      policy: 'guarded',
      workloadProfile: 'interactive_demo',
      nvidiaConfigured: true,
    });

    expect(plan.primaryOrder.map((entry) => entry.label)).toEqual(['N1']);
    expect(plan.backupOrder).toEqual([]);
    expect(plan.fallbackRouting.decision).toBe('guarded_recovery');
    expect(plan.fallbackRouting.decisionReason).toContain('N0');
    expect(plan.fallbackRouting.pressureLabels).toEqual([
      expect.objectContaining({
        label: 'N0',
        provider: 'nvidia',
        scope: 'primary',
        available: false,
        severity: 'critical',
        consecutive429s: 1,
        lastStatus: 429,
        lastError: 'nvidia 429',
        reasons: ['cooldown=N0:429', 'consecutive_429s=1', 'retryable_failures=2'],
      }),
    ]);
  });

  describe('operator profiles override', () => {
    it('supports workers-ai-fallback profile and shifts cloudflare to the front', () => {
      const plan = buildProviderRoutingPlan({
        primaryCandidates: [],
        backupCandidates: [
          { provider: 'siliconflow' as const, label: 'S', groupPriority: 0, rotationOrder: 0, available: true },
          { provider: 'openrouter' as const, label: 'O0', groupPriority: 1, rotationOrder: 0, available: true },
          { provider: 'cloudflare' as const, label: 'CF', groupPriority: 2, rotationOrder: 0, available: true },
        ],
        stateByLabel: new Map(),
        policy: 'always',
        workloadProfile: 'balanced',
        operatorProfile: 'workers-ai-fallback',
        nvidiaConfigured: false,
      });

      expect(plan.fallbackRouting.operatorProfile).toBe('workers-ai-fallback');
      expect(plan.fallbackRouting.backupPriorityOrder).toEqual(['cloudflare', 'siliconflow', 'openrouter']);
      expect(plan.backupOrder.map((entry) => entry.provider)).toEqual(['cloudflare', 'siliconflow', 'openrouter']);
    });

    it('supports openrouter-preferred profile and shifts openrouter to the front', () => {
      const plan = buildProviderRoutingPlan({
        primaryCandidates: [],
        backupCandidates: [
          { provider: 'siliconflow' as const, label: 'S', groupPriority: 0, rotationOrder: 0, available: true },
          { provider: 'openrouter' as const, label: 'O0', groupPriority: 1, rotationOrder: 0, available: true },
          { provider: 'cloudflare' as const, label: 'CF', groupPriority: 2, rotationOrder: 0, available: true },
        ],
        stateByLabel: new Map(),
        policy: 'always',
        workloadProfile: 'balanced',
        operatorProfile: 'openrouter-preferred',
        nvidiaConfigured: false,
      });

      expect(plan.fallbackRouting.operatorProfile).toBe('openrouter-preferred');
      expect(plan.fallbackRouting.backupPriorityOrder).toEqual(['openrouter', 'siliconflow', 'cloudflare']);
      expect(plan.backupOrder.map((entry) => entry.provider)).toEqual(['openrouter', 'siliconflow', 'cloudflare']);
    });

    it('resolves composite profiles dynamically based on environment and workload', () => {
      const originalJson = process.env.AI_OPERATOR_PROFILES_JSON;
      const originalNodeEnv = process.env.NODE_ENV;

      const compositeJson = JSON.stringify({
        development: {
          default: 'workers-ai-fallback',
          free_only_preview: 'workers-ai-fallback',
        },
        production: {
          default: 'nvidia-first',
          interactive_demo: 'openrouter-preferred',
        },
      });

      process.env.AI_OPERATOR_PROFILES_JSON = compositeJson;

      try {
        process.env.NODE_ENV = 'production';
        const prodInteractivePlan = buildProviderRoutingPlan({
          primaryCandidates: [],
          backupCandidates: [
            { provider: 'siliconflow' as const, label: 'S', groupPriority: 0, rotationOrder: 0, available: true },
            { provider: 'openrouter' as const, label: 'O0', groupPriority: 1, rotationOrder: 0, available: true },
            { provider: 'cloudflare' as const, label: 'CF', groupPriority: 2, rotationOrder: 0, available: true },
          ],
          stateByLabel: new Map(),
          policy: 'always',
          workloadProfile: 'interactive_demo',
          nvidiaConfigured: false,
        });
        expect(prodInteractivePlan.fallbackRouting.operatorProfile).toBe('openrouter-preferred');
        expect(prodInteractivePlan.backupOrder.map((entry) => entry.provider)).toEqual([
          'openrouter',
          'siliconflow',
          'cloudflare',
        ]);

        const prodBalancedPlan = buildProviderRoutingPlan({
          primaryCandidates: [],
          backupCandidates: [
            { provider: 'siliconflow' as const, label: 'S', groupPriority: 0, rotationOrder: 0, available: true },
            { provider: 'openrouter' as const, label: 'O0', groupPriority: 1, rotationOrder: 0, available: true },
            { provider: 'cloudflare' as const, label: 'CF', groupPriority: 2, rotationOrder: 0, available: true },
          ],
          stateByLabel: new Map(),
          policy: 'always',
          workloadProfile: 'balanced',
          nvidiaConfigured: false,
        });
        expect(prodBalancedPlan.fallbackRouting.operatorProfile).toBe('nvidia-first');

        process.env.NODE_ENV = 'development';
        const devPreviewPlan = buildProviderRoutingPlan({
          primaryCandidates: [],
          backupCandidates: [
            { provider: 'siliconflow' as const, label: 'S', groupPriority: 0, rotationOrder: 0, available: true },
            { provider: 'openrouter' as const, label: 'O0', groupPriority: 1, rotationOrder: 0, available: true },
            { provider: 'cloudflare' as const, label: 'CF', groupPriority: 2, rotationOrder: 0, available: true },
          ],
          stateByLabel: new Map(),
          policy: 'always',
          workloadProfile: 'free_only_preview',
          nvidiaConfigured: false,
        });
        expect(devPreviewPlan.fallbackRouting.operatorProfile).toBe('workers-ai-fallback');
        expect(devPreviewPlan.backupOrder.map((entry) => entry.provider)).toEqual([
          'cloudflare',
          'openrouter',
          'siliconflow',
        ]);
      } finally {
        process.env.AI_OPERATOR_PROFILES_JSON = originalJson;
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('smart fallback and degradation', () => {
    it('demotes or filters primary provider when 429 coolingDown or circuitBreakerOpen is active', () => {
      const plan = buildProviderRoutingPlan({
        primaryCandidates: [
          { provider: 'nvidia' as const, label: 'N0', rotationOrder: 0, available: true },
          { provider: 'nvidia' as const, label: 'N1', rotationOrder: 1, available: true },
        ],
        backupCandidates: [
          { provider: 'siliconflow' as const, label: 'S', groupPriority: 0, rotationOrder: 0, available: true },
        ],
        stateByLabel: new Map([
          [
            'N0',
            {
              provider: 'nvidia' as const,
              consecutive429s: 3,
              coolingDown: true,
              cooldownReason: 'rate_limit',
            },
          ],
          [
            'N1',
            {
              provider: 'nvidia' as const,
              circuitBreakerOpen: true,
            },
          ],
        ]),
        policy: 'guarded',
        nvidiaConfigured: true,
      });

      // Both N0 and N1 should be filtered out by health check (coolingDown and circuitBreakerOpen)
      expect(plan.primaryOrder).toEqual([]);
      expect(plan.backupOrder.map((e) => e.label)).toEqual(['S']);
      expect(plan.fallbackRouting.decision).toBe('backup_recovery');
      expect(plan.fallbackRouting.nvidiaAvailable).toBe(false);
    });

    it('falls back to backup when nvidia is not configured or unavailable', () => {
      // NVIDIA not configured
      const planNotConfigured = buildProviderRoutingPlan({
        primaryCandidates: [],
        backupCandidates: [
          { provider: 'siliconflow' as const, label: 'S', groupPriority: 0, rotationOrder: 0, available: true },
        ],
        stateByLabel: new Map(),
        policy: 'guarded',
        nvidiaConfigured: false,
      });

      expect(planNotConfigured.primaryOrder).toEqual([]);
      expect(planNotConfigured.backupOrder.map((e) => e.label)).toEqual(['S']);
      expect(planNotConfigured.fallbackRouting.decision).toBe('backup_recovery');

      // Policy 'cold' and NVIDIA unavailable
      const planColdUnavailable = buildProviderRoutingPlan({
        primaryCandidates: [{ provider: 'nvidia' as const, label: 'N0', rotationOrder: 0, available: false }],
        backupCandidates: [
          { provider: 'siliconflow' as const, label: 'S', groupPriority: 0, rotationOrder: 0, available: true },
        ],
        stateByLabel: new Map(),
        policy: 'cold',
        nvidiaConfigured: true,
      });

      expect(planColdUnavailable.primaryOrder).toEqual([]);
      expect(planColdUnavailable.backupOrder).toEqual([]);
      expect(planColdUnavailable.fallbackRouting.decision).toBe('providers_exhausted');
    });

    it('filters out disabled/melted backup providers and reports providers_exhausted when all are gone', () => {
      const plan = buildProviderRoutingPlan({
        primaryCandidates: [{ provider: 'nvidia' as const, label: 'N0', rotationOrder: 0, available: false }],
        backupCandidates: [
          { provider: 'siliconflow' as const, label: 'S', groupPriority: 0, rotationOrder: 0, available: true },
          { provider: 'openrouter' as const, label: 'O', groupPriority: 1, rotationOrder: 0, available: true },
        ],
        stateByLabel: new Map([
          [
            'S',
            {
              provider: 'siliconflow' as const,
              hardDisabled: true,
              hardDisableReason: 'out_of_funds',
            },
          ],
          [
            'O',
            {
              provider: 'openrouter' as const,
              quarantined: true,
              quarantineReason: 'api_keys_missing',
            },
          ],
        ]),
        policy: 'guarded',
        nvidiaConfigured: true,
      });

      expect(plan.primaryOrder).toEqual([]);
      expect(plan.backupOrder).toEqual([]);
      expect(plan.fallbackRouting.decision).toBe('providers_exhausted');
    });

    it('sorts backup candidates by estimated cost or latency under budget/speed operator profiles', () => {
      // budget: lowest cost first
      const budgetPlan = buildProviderRoutingPlan({
        primaryCandidates: [],
        backupCandidates: [
          { provider: 'siliconflow' as const, label: 'S', groupPriority: 0, rotationOrder: 0, available: true },
          { provider: 'openrouter' as const, label: 'O', groupPriority: 1, rotationOrder: 0, available: true },
          { provider: 'cloudflare' as const, label: 'CF', groupPriority: 2, rotationOrder: 0, available: true },
        ],
        stateByLabel: new Map([
          ['S', { provider: 'siliconflow' as const, estimatedCostPer1k: 0.05 }],
          ['O', { provider: 'openrouter' as const, estimatedCostPer1k: 0.001 }],
          ['CF', { provider: 'cloudflare' as const, estimatedCostPer1k: 0.01 }],
        ]),
        policy: 'always',
        operatorProfile: 'budget',
        nvidiaConfigured: false,
      });

      expect(budgetPlan.backupOrder.map((e) => e.label)).toEqual(['O', 'CF', 'S']);

      // speed: lowest latency first
      const speedPlan = buildProviderRoutingPlan({
        primaryCandidates: [],
        backupCandidates: [
          { provider: 'siliconflow' as const, label: 'S', groupPriority: 0, rotationOrder: 0, available: true },
          { provider: 'openrouter' as const, label: 'O', groupPriority: 1, rotationOrder: 0, available: true },
          { provider: 'cloudflare' as const, label: 'CF', groupPriority: 2, rotationOrder: 0, available: true },
        ],
        stateByLabel: new Map([
          ['S', { provider: 'siliconflow' as const, averageLatencyMs: 150 }],
          ['O', { provider: 'openrouter' as const, averageLatencyMs: 900 }],
          ['CF', { provider: 'cloudflare' as const, averageLatencyMs: 300 }],
        ]),
        policy: 'always',
        operatorProfile: 'speed',
        nvidiaConfigured: false,
      });

      expect(speedPlan.backupOrder.map((e) => e.label)).toEqual(['S', 'CF', 'O']);
    });
  });
});
