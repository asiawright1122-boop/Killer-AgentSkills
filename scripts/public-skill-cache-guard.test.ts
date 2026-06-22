import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { findPublicSkillCacheGuardIssuesInData, scanPublicSkillCacheFile } from './public-skill-cache-guard';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'public-skill-cache-guard-'));
  tempDirs.push(dir);
  return dir;
}

describe('public skill cache guard', () => {
  it('validates the sanitized public projection instead of raw upstream markdown', () => {
    const issues = findPublicSkillCacheGuardIssuesInData(
      {
        skills: [
          {
            id: 'safe-after-sanitize',
            owner: 'owner',
            repo: 'repo',
            description: '<thinking>private notes</thinking>Public description.',
            skillMd: {
              bodyPreview: 'Final answer </Reasoning>',
            },
          },
        ],
      },
      'data/skills-cache.json',
    );

    expect(issues).toEqual([]);
  });

  it('preserves normal public discussion of chain-of-thought prompting', () => {
    const issues = findPublicSkillCacheGuardIssuesInData(
      {
        skills: [
          {
            id: 'public-technique',
            description: 'Use chain-of-thought prompting only as a public prompt-engineering topic.',
          },
        ],
      },
      'data/skills-cache.json',
    );

    expect(issues).toEqual([]);
  });

  it('reads a cache file from disk and validates its public projection', () => {
    const cwd = makeTempDir();
    writeFileSync(
      join(cwd, 'skills-cache.json'),
      JSON.stringify({
        skills: [
          {
            id: 'safe-after-disk-sanitize',
            owner: 'owner',
            repo: 'repo',
            description: '<analysis>private notes</analysis>Public description.',
            skillMd: {
              bodyPreview: 'Final answer </Reasoning>',
            },
          },
        ],
      }),
    );

    const result = scanPublicSkillCacheFile('skills-cache.json', cwd);
    expect(result.file).toBe('skills-cache.json');
    expect(result.issues).toEqual([]);
  });
});
