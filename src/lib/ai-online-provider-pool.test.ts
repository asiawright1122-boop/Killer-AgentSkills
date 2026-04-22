import { describe, expect, it } from 'vitest';
import { buildAIOnlineProviderPool, splitAIProviderKeys } from './ai-online-provider-pool';

describe('ai online provider pool', () => {
  it('splits provider key strings across env-style sources', () => {
    expect(splitAIProviderKeys('a, b', undefined, 'c', '', ' d ')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('builds labeled candidates with rotation state and availability', () => {
    const unavailableLabels = new Set(['N1', 'O0']);
    const pool = buildAIOnlineProviderPool({
      nvidiaKeys: ['n0', 'n1', 'n2'],
      siliconFlowKey: 's0',
      openRouterKeys: ['o0', 'o1', 'o2'],
      nvidiaRotationIndex: 2,
      openRouterRotationIndex: 1,
      isAvailable: ({ label }) => !unavailableLabels.has(label),
    });

    expect(pool.nvidiaPoolSize).toBe(3);
    expect(pool.openRouterPoolSize).toBe(3);
    expect(pool.primaryCandidates).toEqual([
      expect.objectContaining({ label: 'N0', key: 'n0', rotationOrder: 1, available: true }),
      expect.objectContaining({ label: 'N1', key: 'n1', rotationOrder: 2, available: false }),
      expect.objectContaining({ label: 'N2', key: 'n2', rotationOrder: 0, available: true }),
    ]);
    expect(pool.backupCandidates).toEqual([
      expect.objectContaining({
        provider: 'siliconflow',
        label: 'S',
        key: 's0',
        groupPriority: 0,
        rotationOrder: 0,
        available: true,
      }),
      expect.objectContaining({
        provider: 'openrouter',
        label: 'O1',
        key: 'o1',
        groupPriority: 1,
        rotationOrder: 0,
        available: true,
      }),
      expect.objectContaining({
        provider: 'openrouter',
        label: 'O2',
        key: 'o2',
        groupPriority: 1,
        rotationOrder: 1,
        available: true,
      }),
      expect.objectContaining({
        provider: 'openrouter',
        label: 'O0',
        key: 'o0',
        groupPriority: 1,
        rotationOrder: 2,
        available: false,
      }),
    ]);
  });
});
