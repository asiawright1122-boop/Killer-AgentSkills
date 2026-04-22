import { describe, expect, it } from 'vitest';
import type { SkillCache } from './types';
import {
  buildTargetSkillFilePathCandidates,
  getSkillIdParts,
  pickPrimaryText,
  resolveExpandedSkillFilePath,
} from './target-skill-refresh';

describe('target-skill-refresh helpers', () => {
  it('parses owner repo and skill slug from a sub-skill id', () => {
    expect(getSkillIdParts('opentabs-dev/opentabs/build-plugin')).toEqual({
      owner: 'opentabs-dev',
      repo: 'opentabs',
      slug: 'build-plugin',
    });
  });

  it('resolves file path from expanded GitHub backups', () => {
    expect(
      resolveExpandedSkillFilePath(
        [
          {
            owner: 'opentabs-dev',
            repo: 'opentabs',
            filePath: '.claude/skills/build-plugin/SKILL.md',
          },
        ],
        'opentabs-dev',
        'opentabs',
        'opentabs-dev/opentabs/build-plugin',
      ),
    ).toBe('.claude/skills/build-plugin/SKILL.md');
  });

  it('falls back to common skill path guesses when cache path is missing', () => {
    const skill = {
      id: 'tfunk1030/bnredo/check',
      name: 'check',
      description: 'Run typecheck and lint in parallel',
      owner: 'tfunk1030',
      repo: 'bnredo',
      repoPath: 'tfunk1030/bnredo',
      stars: 1,
      forks: 0,
      updatedAt: '2026-02-21T23:04:54Z',
      topics: [],
      lastSynced: '2026-04-16T00:00:00Z',
    } satisfies SkillCache;

    expect(buildTargetSkillFilePathCandidates(skill)).toContain('.claude/skills/check/SKILL.md');
  });

  it('prefers english then chinese when extracting localized text', () => {
    expect(pickPrimaryText({ zh: '中文描述', en: 'English description' })).toBe('English description');
    expect(pickPrimaryText({ zh: '中文描述' })).toBe('中文描述');
  });
});
