import { describe, expect, it } from 'vitest';
import { compileSitemapBlocklist, isSitemapSkillBlocked } from './sitemap-blocklist';

describe('sitemap blocklist helpers', () => {
  it('parses and normalizes configured keys', () => {
    const compiled = compileSitemapBlocklist({
      rules: {
        excludeExact: ['  Foo/Repo/Sub  ', 'BAR/repo-two'],
        excludeRepo: ['Owner/Repo', ' owner-two/repo-two '],
      },
    });

    expect(compiled.exactKeys.has('foo/repo/sub')).toBe(true);
    expect(compiled.exactKeys.has('bar/repo-two')).toBe(true);
    expect(compiled.repoKeys.has('owner/repo')).toBe(true);
    expect(compiled.repoKeys.has('owner-two/repo-two')).toBe(true);
  });

  it('matches exact blocked skill routes', () => {
    const compiled = compileSitemapBlocklist({
      rules: {
        excludeExact: ['foo/repo/sub-skill'],
      },
    });

    expect(isSitemapSkillBlocked('Foo', 'Repo/Sub-Skill', compiled)).toBe(true);
    expect(isSitemapSkillBlocked('Foo', 'Repo/other', compiled)).toBe(false);
  });

  it('matches repo-level blocked prefixes', () => {
    const compiled = compileSitemapBlocklist({
      rules: {
        excludeRepo: ['foo/repo'],
      },
    });

    expect(isSitemapSkillBlocked('Foo', 'Repo', compiled)).toBe(true);
    expect(isSitemapSkillBlocked('Foo', 'Repo/sub', compiled)).toBe(true);
    expect(isSitemapSkillBlocked('Foo', 'other/sub', compiled)).toBe(false);
  });

  it('returns false for invalid inputs', () => {
    const compiled = compileSitemapBlocklist(null);
    expect(isSitemapSkillBlocked('', '', compiled)).toBe(false);
    expect(isSitemapSkillBlocked('foo', '', compiled)).toBe(false);
  });
});
