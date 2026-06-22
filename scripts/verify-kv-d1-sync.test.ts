import { describe, expect, it } from 'vitest';
import { compareDatabaseState, computeExpectedHash } from './verify-kv-d1-sync';

describe('computeExpectedHash', () => {
  it('computes content hash for a skill correctly and matches same structure', () => {
    const skill = {
      id: 'test-owner/test-repo/test-skill',
      name: 'test-skill',
      owner: 'test-owner',
      repo: 'test-repo',
      skillMd: {
        body: 'a'.repeat(1000),
        bodyPreview: 'a'.repeat(200),
      },
    };

    const hash1 = computeExpectedHash(skill);
    expect(hash1).toHaveLength(32);

    const hash2 = computeExpectedHash({ ...skill });
    expect(hash1).toBe(hash2);
  });

  it('computes expected hash from sanitized public payload', () => {
    const cleanSkill = {
      id: 'test-owner/test-repo/test-skill',
      name: 'test-skill',
      owner: 'test-owner',
      repo: 'test-repo',
      description: 'Public description',
      skillMd: {
        bodyPreview: 'Public instructions',
      },
    };
    const leakingSkill = {
      ...cleanSkill,
      description: '<thinking>private notes</thinking>Public description',
      skillMd: {
        bodyPreview: 'Scratchpad:\nprivate notes\n\nPublic instructions',
      },
    };

    expect(computeExpectedHash(leakingSkill)).toBe(computeExpectedHash(cleanSkill));
  });
});

describe('compareDatabaseState', () => {
  const localSkills = [
    { id: 'owner/repo/skill-1', name: 'skill-1', owner: 'owner', repo: 'repo' },
    { id: 'owner/repo/skill-2', name: 'skill-2', owner: 'owner', repo: 'repo' },
  ];
  const expectedHash1 = computeExpectedHash(localSkills[0]);
  const expectedHash2 = computeExpectedHash(localSkills[1]);

  it('reports healthy when local, D1, and KV are fully in sync', () => {
    const remoteD1 = [
      { id: 'owner/repo/skill-1', content_hash: expectedHash1 },
      { id: 'owner/repo/skill-2', content_hash: expectedHash2 },
    ];
    const remoteKv = ['owner/repo/skill-1', 'owner/repo/skill-2'];

    const result = compareDatabaseState(localSkills, remoteD1, remoteKv);
    expect(result.isHealthy).toBe(true);
    expect(result.d1.isHealthy).toBe(true);
    expect(result.kv.isHealthy).toBe(true);
    expect(result.d1.missing).toHaveLength(0);
    expect(result.d1.extra).toHaveLength(0);
    expect(result.d1.mismatch).toHaveLength(0);
    expect(result.kv.missing).toHaveLength(0);
  });

  it('detects missing items in D1 and KV', () => {
    const remoteD1 = [{ id: 'owner/repo/skill-1', content_hash: expectedHash1 }];
    const remoteKv: string[] = [];

    const result = compareDatabaseState(localSkills, remoteD1, remoteKv);
    expect(result.isHealthy).toBe(false);
    expect(result.d1.isHealthy).toBe(false);
    expect(result.kv.isHealthy).toBe(false);
    expect(result.d1.missing).toEqual(['owner/repo/skill-2']);
    expect(result.kv.missing).toEqual(['owner/repo/skill-1', 'owner/repo/skill-2']);
  });

  it('detects extra items in D1', () => {
    const remoteD1 = [
      { id: 'owner/repo/skill-1', content_hash: expectedHash1 },
      { id: 'owner/repo/skill-2', content_hash: expectedHash2 },
      { id: 'owner/repo/extra-skill', content_hash: 'somehash' },
    ];
    const remoteKv = ['owner/repo/skill-1', 'owner/repo/skill-2'];

    const result = compareDatabaseState(localSkills, remoteD1, remoteKv);
    expect(result.isHealthy).toBe(false);
    expect(result.d1.isHealthy).toBe(false);
    expect(result.d1.extra).toEqual(['owner/repo/extra-skill']);
  });

  it('handles strict mode for extra keys in KV', () => {
    const remoteD1 = [
      { id: 'owner/repo/skill-1', content_hash: expectedHash1 },
      { id: 'owner/repo/skill-2', content_hash: expectedHash2 },
    ];
    const remoteKv = ['owner/repo/skill-1', 'owner/repo/skill-2', 'owner/repo/extra-key'];

    const looseResult = compareDatabaseState(localSkills, remoteD1, remoteKv);
    expect(looseResult.isHealthy).toBe(true);

    const strictResult = compareDatabaseState(localSkills, remoteD1, remoteKv, { strict: true });
    expect(strictResult.isHealthy).toBe(false);
    expect(strictResult.kv.isHealthy).toBe(false);
    expect(strictResult.kv.extra).toEqual(['owner/repo/extra-key']);
  });

  it('detects hash mismatches in D1', () => {
    const remoteD1 = [
      { id: 'owner/repo/skill-1', content_hash: expectedHash1 },
      { id: 'owner/repo/skill-2', content_hash: 'wronghash' },
    ];
    const remoteKv = ['owner/repo/skill-1', 'owner/repo/skill-2'];

    const result = compareDatabaseState(localSkills, remoteD1, remoteKv);
    expect(result.isHealthy).toBe(false);
    expect(result.d1.isHealthy).toBe(false);
    expect(result.d1.mismatch).toHaveLength(1);
    expect(result.d1.mismatch[0]).toEqual({
      id: 'owner/repo/skill-2',
      expected: expectedHash2,
      got: 'wronghash',
    });
  });
});
