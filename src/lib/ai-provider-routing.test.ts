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
});
