import { describe, expect, it } from 'vitest';
import { getSkillRoutePath, isValidPublicSkillRouteSegment, normalizeSitemapSkillEntry } from './skill-route-paths';

describe('skill-route-paths', () => {
  it('keeps dotted repo names routable for public skill pages', () => {
    expect(
      getSkillRoutePath({
        id: 'vercel/next.js/flags',
        owner: 'vercel',
        repo: 'next.js',
      }),
    ).toBe('next.js/flags');

    expect(
      getSkillRoutePath({
        id: 'vercel/next.js',
        owner: 'vercel',
        repo: 'next.js',
      }),
    ).toBe('next.js');
  });

  it('still rejects file-like subskill segments', () => {
    expect(
      getSkillRoutePath({
        id: 'vercel/next.js/file.ts',
        owner: 'vercel',
        repo: 'next.js',
      }),
    ).toBeNull();

    expect(isValidPublicSkillRouteSegment('file.ts')).toBe(false);
  });

  it('rejects source-file repo names while keeping legitimate dotted repos', () => {
    expect(
      getSkillRoutePath({
        id: 'CongDon1207/AGENTS.md/angular-api-service',
        owner: 'CongDon1207',
        repo: 'AGENTS.md',
      }),
    ).toBeNull();

    expect(
      normalizeSitemapSkillEntry({
        owner: 'CongDon1207',
        repo: 'AGENTS.md',
        routePath: 'AGENTS.md/angular-api-service',
        updatedAt: '2026-04-16T00:00:00.000Z',
      }),
    ).toBeNull();

    expect(
      getSkillRoutePath({
        id: 'vercel/next.js/flags',
        owner: 'vercel',
        repo: 'next.js',
      }),
    ).toBe('next.js/flags');
  });

  it('normalizes explicit route paths that use dotted repo names', () => {
    expect(
      normalizeSitemapSkillEntry({
        owner: 'vercel',
        repo: 'next.js',
        routePath: 'next.js/flags',
        updatedAt: '2026-04-16T00:00:00.000Z',
      }),
    ).toEqual({
      owner: 'vercel',
      repo: 'next.js',
      routePath: 'next.js/flags',
      updatedAt: '2026-04-16T00:00:00.000Z',
    });
  });
});
