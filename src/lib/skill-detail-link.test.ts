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
          id: 'langgenius/dify/frontend-code-review',
          owner: 'langgenius',
          repo: 'dify',
          routePath: 'dify/frontend-code-review',
        },
        'ja',
      ),
    ).toEqual({
      owner: 'langgenius',
      routePath: 'dify/frontend-code-review',
      detailLocale: 'en',
      href: '/en/skills/langgenius/dify/frontend-code-review',
    });
  });
});
