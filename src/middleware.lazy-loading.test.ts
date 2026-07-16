import { beforeEach, describe, expect, it, vi } from 'vitest';

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

function createContext(url: string) {
  return {
    url: new URL(url),
    request: new Request(url, {
      headers: { 'user-agent': 'Mozilla/5.0 Chrome/126 Safari/537.36' },
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
});
