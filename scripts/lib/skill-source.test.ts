import { describe, expect, it } from 'vitest';
import { deriveSkillStubTargetPath, resolveSkillScoringPath } from './skill-source';

describe('skill-source helpers', () => {
  it('prefers the concrete file path when scoring quality', () => {
    expect(resolveSkillScoringPath('.claude/skills/build-plugin/SKILL.md', 'opentabs-dev/opentabs')).toBe(
      '.claude/skills/build-plugin/SKILL.md',
    );
  });

  it('falls back to repo path when file path is missing', () => {
    expect(resolveSkillScoringPath('', 'opentabs-dev/opentabs')).toBe('opentabs-dev/opentabs');
  });

  it('derives a stub target from an explicit __SKILL__.md pointer', () => {
    const content =
      '**IMPORTANT: This file is a stub.** Read `.claude/skills/build-plugin/__SKILL__.md` for the real content.';

    expect(deriveSkillStubTargetPath('.claude/skills/build-plugin/SKILL.md', content)).toBe(
      '.claude/skills/build-plugin/__SKILL__.md',
    );
  });

  it('derives a stub target from the sibling directory when only __SKILL__.md is mentioned', () => {
    const content = 'The actual skill content is maintained in `__SKILL__.md` in this same directory.';

    expect(deriveSkillStubTargetPath('.claude/skills/build-plugin/SKILL.md', content)).toBe(
      '.claude/skills/build-plugin/__SKILL__.md',
    );
  });

  it('returns null when the content is not a stub pointer', () => {
    expect(deriveSkillStubTargetPath('.claude/skills/build-plugin/SKILL.md', '# Real Skill')).toBeNull();
  });
});
