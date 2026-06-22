import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAPIContext, createMockEnv } from '../../../src/lib/api-test-utils';

function createJsonKV(values: Record<string, unknown> = {}) {
  return {
    get: vi.fn(async (key: string) => values[key] ?? null),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

describe('GET /api/crawled-skills', () => {
  let GET: typeof import('../../../src/pages/api/crawled-skills/index').GET;

  beforeEach(async () => {
    vi.restoreAllMocks();
    ({ GET } = await import('../../../src/pages/api/crawled-skills/index'));
  });

  it('strips hidden reasoning and source-only fields from crawled skill listings', async () => {
    const env = createMockEnv({
      SKILLS_CACHE: createJsonKV({
        'crawled-skills': [
          {
            id: 'owner/repo',
            name: '<thinking>private</thinking>Public Skill',
            owner: 'owner',
            repo: 'repo',
            description: 'Scratchpad:\nprivate notes\n\nPublic description',
            filePath: '/private/SKILL.md',
            rawSkillMd: '<analysis>private</analysis># Skill',
            agentAnalysis: {
              recommendation: 'Hidden reasoning:\nprivate notes\n\nUse this for public workflows.',
            },
          },
        ],
      }),
    });

    const response = await GET(
      createAPIContext({
        url: 'http://localhost/api/crawled-skills',
        env,
      }) as any,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    await expect(response.json()).resolves.toEqual({
      skills: [
        {
          id: 'owner/repo',
          name: 'Public Skill',
          owner: 'owner',
          repo: 'repo',
          description: 'Public description',
          agentAnalysis: {
            recommendation: 'Use this for public workflows.',
          },
        },
      ],
      total: 1,
      page: 1,
      hasMore: false,
    });
  });
});

describe('GET /api/crawled-skills/[id]', () => {
  let GET: typeof import('../../../src/pages/api/crawled-skills/[id]').GET;

  beforeEach(async () => {
    vi.restoreAllMocks();
    ({ GET } = await import('../../../src/pages/api/crawled-skills/[id]'));
  });

  it('strips hidden reasoning from direct crawled skill detail lookups', async () => {
    const env = createMockEnv({
      SKILLS_CACHE: createJsonKV({
        'crawled:owner/repo': {
          id: 'owner/repo',
          name: 'Public Skill </Reasoning>',
          owner: 'owner',
          repo: 'repo',
          description: '<analysis>private</analysis>Public description',
          skillMd: {
            body: '<thinking>private</thinking>Public instructions',
          },
        },
      }),
    });

    const response = await GET({
      ...createAPIContext({
        url: 'http://localhost/api/crawled-skills/owner%2Frepo',
        env,
      }),
      params: { id: 'owner/repo' },
    } as any);

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    await expect(response.json()).resolves.toEqual({
      id: 'owner/repo',
      name: 'Public Skill',
      owner: 'owner',
      repo: 'repo',
      description: 'Public description',
    });
  });

  it('keeps crawled skill detail errors noindexed', async () => {
    const response = await GET({
      ...createAPIContext({
        url: 'http://localhost/api/crawled-skills/missing',
        env: createMockEnv({ SKILLS_CACHE: createJsonKV({}) }),
      }),
      params: { id: 'missing' },
    } as any);

    expect(response.status).toBe(404);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });
});
