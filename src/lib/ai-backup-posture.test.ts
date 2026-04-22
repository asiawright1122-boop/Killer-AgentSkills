import { describe, expect, it } from 'vitest';
import {
  defaultAIBackupProviderPosture,
  inspectAIBackupProviderPostures,
  isCloudflareBackupPostureAllowed,
  parseAIBackupProviderPosture,
  resolveBackupPosturePriorityOffset,
} from './ai-backup-posture';

describe('ai backup posture', () => {
  it('defaults cloudflare to burst-only while keeping online backups on standby', () => {
    expect(defaultAIBackupProviderPosture('siliconflow')).toBe('standby');
    expect(defaultAIBackupProviderPosture('openrouter')).toBe('standby');
    expect(defaultAIBackupProviderPosture('cloudflare')).toBe('burst-only');
  });

  it('parses explicit postures and falls back for invalid values', () => {
    expect(parseAIBackupProviderPosture('disabled', 'siliconflow')).toBe('disabled');
    expect(parseAIBackupProviderPosture('burst-only', 'openrouter')).toBe('burst-only');
    expect(parseAIBackupProviderPosture('unexpected', 'cloudflare')).toBe('burst-only');
  });

  it('captures configured reasons and posture ordering', () => {
    const postures = inspectAIBackupProviderPostures({
      AI_BACKUP_SILICONFLOW_POSTURE: 'disabled',
      AI_BACKUP_SILICONFLOW_REASON: 'billing 403',
      AI_BACKUP_OPENROUTER_POSTURE: 'burst-only',
    });

    expect(postures.siliconflow).toMatchObject({
      posture: 'disabled',
      reason: 'billing 403',
      source: 'env',
    });
    expect(postures.openrouter.posture).toBe('burst-only');
    expect(resolveBackupPosturePriorityOffset(postures.openrouter.posture)).toBeGreaterThan(
      resolveBackupPosturePriorityOffset('standby'),
    );
    expect(isCloudflareBackupPostureAllowed(postures.cloudflare.posture)).toBe(true);
  });
});
