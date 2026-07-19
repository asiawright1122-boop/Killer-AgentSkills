import { beforeEach, describe, expect, it, vi } from 'vitest';
import sitemapSkillsData from '../data/sitemap-skills.json';
import sitemapBlocklistData from '../data/seo-sitemap-blocklist.json';
import { compileSitemapBlocklist } from './lib/sitemap-blocklist';
import { type SitemapSkillEntry } from './lib/skill-route-paths';
import {
  pickSingleRouteRepoRedirectSample,
  pickSuppressedLocaleRedirectSample,
  type SkillLocaleGovernanceRecord,
} from '../scripts/lib/seo-smoke-samples';

const loaderMocks = vi.hoisted(() => ({
  getSitemapSkills: vi.fn().mockResolvedValue([]),
  isGovernanceLoaded: vi.fn().mockReturnValue(false),
  loadSkillLocaleGovernance: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('astro:middleware', () => ({
  defineMiddleware: <T>(fn: T) => fn,
}));

vi.mock('./lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  generateRequestId: () => 'lazy-loading-test-request',
}));

vi.mock('./lib/sitemap-skills-runtime', () => ({
  getSitemapSkills: loaderMocks.getSitemapSkills,
}));

vi.mock('./lib/skill-locale-governance', () => ({
  skillLocaleGovernanceMap: new Map(),
  isGovernanceLoaded: loaderMocks.isGovernanceLoaded,
  loadSkillLocaleGovernance: loaderMocks.loadSkillLocaleGovernance,
}));

import { onRequest } from './middleware';

function createContext(url: string, userAgent = 'Mozilla/5.0 Chrome/126 Safari/537.36') {
  return {
    url: new URL(url),
    request: new Request(url, {
      headers: { 'user-agent': userAgent },
    }),
    clientAddress: '192.0.2.1',
    cookies: {
      get: () => undefined,
    },
    locals: {},
  } as unknown as Parameters<typeof onRequest>[0];
}

describe('middleware route-scoped data loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not initialize skill routing data for localized blog pages', async () => {
    const next = vi.fn().mockResolvedValue(
      new Response('<html></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    );

    const response = (await onRequest(createContext('https://killer-skills.com/es/blog'), next)) as Response;

    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(1);
    expect(loaderMocks.loadSkillLocaleGovernance).not.toHaveBeenCalled();
    expect(loaderMocks.getSitemapSkills).not.toHaveBeenCalled();
  });

  it('does not initialize skill routing data for owner-only skill trap paths', async () => {
    const next = vi.fn().mockResolvedValue(new Response('<html></html>', { status: 200 }));

    const response = (await onRequest(
      createContext('https://killer-skills.com/es/skills/example-owner'),
      next,
    )) as Response;

    expect(response.status).toBe(410);
    expect(next).not.toHaveBeenCalled();
    expect(loaderMocks.loadSkillLocaleGovernance).not.toHaveBeenCalled();
    expect(loaderMocks.getSitemapSkills).not.toHaveBeenCalled();
  });

  it('uses the deployed sitemap snapshot when runtime skill routing data is unavailable', async () => {
    const sample = pickSingleRouteRepoRedirectSample(
      sitemapSkillsData as SitemapSkillEntry[],
      compileSitemapBlocklist(sitemapBlocklistData),
    );
    expect(sample).not.toBeNull();

    const next = vi.fn().mockResolvedValue(new Response('<html></html>', { status: 404 }));
    const response = (await onRequest(
      createContext(`https://killer-skills.com${sample!.sourcePath}`),
      next,
    )) as Response;

    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe(sample!.expectedPath);
    expect(next).not.toHaveBeenCalled();
    expect(loaderMocks.getSitemapSkills).toHaveBeenCalledTimes(1);
  });

  it('uses sitemap locale governance when the runtime governance binding is unavailable', async () => {
    const sample = pickSuppressedLocaleRedirectSample(
      sitemapSkillsData as SitemapSkillEntry[],
      sitemapSkillsData as SkillLocaleGovernanceRecord[],
      compileSitemapBlocklist(sitemapBlocklistData),
    );
    expect(sample).not.toBeNull();

    const next = vi.fn().mockResolvedValue(new Response('<html></html>', { status: 200 }));
    const response = (await onRequest(
      createContext(`https://killer-skills.com${sample!.sourcePath}`, 'Killer-Skills-Warmup-Bot/1.0'),
      next,
    )) as Response;

    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe(sample!.expectedPath);
    expect(next).not.toHaveBeenCalled();
  });
});
