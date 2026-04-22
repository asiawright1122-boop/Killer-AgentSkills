import { describe, expect, it } from 'vitest';
import { resolveSkillDetailLink } from './skill-detail-link';

describe('skill detail link resolution', () => {
  it('builds a repo-root skill href when only owner/repo is available', () => {
    expect(
      resolveSkillDetailLink(
        {
          id: 'vercel/next.js',
          owner: 'vercel',
          repo: 'next.js',
        },
        'en',
      ),
    ).toEqual({
      owner: 'vercel',
      routePath: 'next.js',
      detailLocale: 'en',
      href: '/en/skills/vercel/next.js',
    });
  });

  it('keeps subskill routes canonical instead of collapsing them to repo root', () => {
    expect(
      resolveSkillDetailLink(
        {
          id: 'anthropics/skills/algorithmic-art',
          owner: 'anthropics',
          repo: 'skills',
        },
        'en',
      ),
    ).toEqual({
      owner: 'anthropics',
      routePath: 'skills/algorithmic-art',
      detailLocale: 'en',
      href: '/en/skills/anthropics/skills/algorithmic-art',
    });
  });

  it('falls back to the governed canonical locale for suppressed variants', () => {
    expect(
      resolveSkillDetailLink(
        {
          id: '0boluan0/Notes_on_Economic_Statistics/today',
          owner: '0boluan0',
          repo: 'Notes_on_Economic_Statistics',
        },
        'ja',
      ),
    ).toEqual({
      owner: '0boluan0',
      routePath: 'Notes_on_Economic_Statistics/today',
      detailLocale: 'en',
      href: '/en/skills/0boluan0/Notes_on_Economic_Statistics/today',
    });
  });
});
