import { describe, expect, it } from 'vitest';
import { parseAIFallbackPolicy, resolveAIFallbackActivation } from './ai-fallback-policy';

describe('ai fallback policy', () => {
  it('parses known policy values and defaults unknown values to cold', () => {
    expect(parseAIFallbackPolicy('cold')).toBe('cold');
    expect(parseAIFallbackPolicy('guarded')).toBe('guarded');
    expect(parseAIFallbackPolicy('always')).toBe('always');
    expect(parseAIFallbackPolicy('unexpected')).toBe('cold');
    expect(parseAIFallbackPolicy(undefined)).toBe('cold');
  });

  it('allows guarded backups only when NVIDIA is unavailable or not configured', () => {
    expect(
      resolveAIFallbackActivation({
        policy: 'guarded',
        primaryConfigured: true,
        primaryAvailable: true,
      }),
    ).toEqual({
      backupsAllowed: false,
      activationReason: null,
    });

    expect(
      resolveAIFallbackActivation({
        policy: 'guarded',
        primaryConfigured: true,
        primaryAvailable: false,
      }),
    ).toEqual({
      backupsAllowed: true,
      activationReason: 'nvidia_unavailable',
    });

    expect(
      resolveAIFallbackActivation({
        policy: 'guarded',
        primaryConfigured: false,
        primaryAvailable: false,
      }),
    ).toEqual({
      backupsAllowed: true,
      activationReason: 'no_nvidia_configured',
    });
  });

  it('always mode returns an explicit policy reason', () => {
    expect(
      resolveAIFallbackActivation({
        policy: 'always',
        primaryConfigured: true,
        primaryAvailable: true,
        alwaysReason: 'operator_override',
      }),
    ).toEqual({
      backupsAllowed: true,
      activationReason: 'operator_override',
    });
  });
});
