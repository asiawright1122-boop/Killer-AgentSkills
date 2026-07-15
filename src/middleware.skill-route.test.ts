import { describe, expect, it, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import seo404RulesData from '../data/seo-404-rules.json';
import sitemapBlocklistData from '../data/seo-sitemap-blocklist.json';
import sitemapSkillsData from '../data/sitemap-skills.json';
import skillLocaleGovernanceData from '../data/seo-skill-locale-governance.json';
import {
  buildLocalizedSkillPath,
  getSkillRoutePath,
  type SitemapSkillEntry as SitemapSkillRouteEntry,
} from './lib/skill-route-paths';
import { compileSitemapBlocklist, isSitemapSkillBlocked } from './lib/sitemap-blocklist';
import { setSitemapSkillsCache, type SitemapSkillEntry } from './lib/sitemap-skills-runtime';
import { setSitemapBlocklistCache } from './lib/sitemap-blocklist-runtime';
import { setSeo404RulesCache } from './lib/seo-404-rules-runtime';
import { setSkillLocaleGovernanceCache } from './lib/skill-locale-governance';

vi.mock('astro:middleware', () => ({
  defineMiddleware: <T>(fn: T) => fn,
}));

vi.mock('./lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  generateRequestId: () => 'test-req-id',
}));

const sitemapBlocklist = compileSitemapBlocklist(sitemapBlocklistData);

// Seed runtime caches so middleware can validate skill routes without KV/DEV
beforeAll(() => {
  const sitemapSkills = (
    Array.isArray(sitemapSkillsData) ? sitemapSkillsData : ((sitemapSkillsData as { skills?: unknown[] }).skills ?? [])
  ) as SitemapSkillEntry[];
  setSitemapSkillsCache(sitemapSkills);
  setSitemapBlocklistCache(sitemapBlocklist);
  setSeo404RulesCache(seo404RulesData as unknown as import('./lib/seo-404-rules-runtime').Seo404Rule[]);
  setSkillLocaleGovernanceCache(skillLocaleGovernanceData);
});

import { onRequest } from './middleware';

const SKILL_SOURCE_FILE_EXT_RE =
  /\.(md|mdx|ts|tsx|js|jsx|py|json|go|yaml|yml|toml|rs|rb|css|html|xml|txt|ini|csv|lock)$/i;

type SkillLocaleGovernanceRecord = {
  owner: string;
  routePath: string;
  canonicalLocale: string | null;
  publishedLocales: string[];
};

function normalizeSitemapSkillRecord(record: Partial<SitemapSkillRouteEntry>) {
  const owner = typeof record.owner === 'string' ? record.owner.trim() : '';
  const rawRoutePath = typeof record.routePath === 'string' ? record.routePath.trim() : '';
  if (!owner || !rawRoutePath) return null;

  const inferredRepo =
    typeof record.repo === 'string' && record.repo.trim().length > 0
      ? record.repo.trim()
      : rawRoutePath.split('/').filter(Boolean)[0] || '';
  const routePath = getSkillRoutePath({
    owner,
    repo: inferredRepo,
    routePath: rawRoutePath,
  });

  if (!routePath) return null;

  return { owner, routePath };
}

function pickSeoGoneSourceLikeSkillPath() {
  const rows = ((seo404RulesData as { rules?: { gone410?: Array<{ path?: string }> } }).rules?.gone410 ?? [])
    .map((row) => (typeof row.path === 'string' ? row.path.trim() : ''))
    .filter((path) => /^\/[a-z]{2}\/skills\//.test(path) && SKILL_SOURCE_FILE_EXT_RE.test(path));

  if (rows.length === 0) {
    throw new Error('expected at least one file-like /skills path in seo-404-rules gone410 set');
  }

  return rows[0];
}

function pickUniqueRepoFallbackSample() {
  const governanceRecords = ((
    skillLocaleGovernanceData as { skills?: SkillLocaleGovernanceRecord[]; records?: SkillLocaleGovernanceRecord[] }
  ).skills ??
    (skillLocaleGovernanceData as { records?: SkillLocaleGovernanceRecord[] }).records ??
    []) as SkillLocaleGovernanceRecord[];
  const governanceMap = new Map(
    governanceRecords.map((record) => [`${record.owner.toLowerCase()}/${record.routePath.toLowerCase()}`, record]),
  );

  const candidates = new Map<string, Array<{ owner: string; repo: string; routePath: string }>>();
  const records = (
    Array.isArray(sitemapSkillsData) ? sitemapSkillsData : ((sitemapSkillsData as { skills?: unknown[] }).skills ?? [])
  ) as Array<Partial<SitemapSkillRouteEntry>>;

  for (const record of records) {
    const normalized = normalizeSitemapSkillRecord(record);
    if (!normalized) continue;
    if (isSitemapSkillBlocked(normalized.owner, normalized.routePath, sitemapBlocklist)) continue;

    const repo = normalized.routePath.split('/').filter(Boolean)[0];
    if (!repo) continue;

    const key = `${normalized.owner.toLowerCase()}/${repo.toLowerCase()}`;
    const list = candidates.get(key) || [];
    list.push({ owner: normalized.owner, repo, routePath: normalized.routePath });
    candidates.set(key, list);
  }

  for (const list of candidates.values()) {
    if (list.length !== 1) continue;
    const sample = list[0];
    const governance = governanceMap.get(`${sample.owner.toLowerCase()}/${sample.routePath.toLowerCase()}`);
    const requestLocale =
      typeof governance?.canonicalLocale === 'string' && governance.canonicalLocale.trim().length > 0
        ? governance.canonicalLocale.trim().toLowerCase()
        : 'en';

    return {
      owner: sample.owner,
      repo: sample.repo,
      routePath: sample.routePath,
      requestLocale,
      expectedLocation: buildLocalizedSkillPath(requestLocale, sample.owner, sample.routePath),
    };
  }

  throw new Error('expected at least one unique repo fallback sample in sitemap-skills data');
}

function createContext(url: string, init?: { headers?: HeadersInit }) {
  return {
    url: new URL(url),
    request: new Request(url, { headers: init?.headers }),
    cookies: {
      get: () => undefined,
    },
    locals: {},
  } as unknown as Parameters<typeof onRequest>[0];
}

describe('middleware skill route handling', () => {
  it('redirects legacy paginated skills sitemap routes to the stable skills sitemap', async () => {
    let nextCalled = false;
    const response = (await onRequest(createContext('https://killer-skills.com/sitemap-skills-3.xml'), async () => {
      nextCalled = true;
      return new Response('<xml></xml>', {
        status: 200,
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      });
    })) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('/sitemap-skills.xml');
  });

  it('canonicalizes legacy skills listing params into the current directory URL', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/skills?topic=workflow&page=1'),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('/en/skills?q=workflow');
  });

  it('keeps current skills listing source and sort filters canonical', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/skills?source=official&sort=latest'),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(true);
    expect(response.status).toBe(200);
  });

  it('keeps public skill detail routes reachable when the repo segment contains a file-like suffix', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/skills/vercel/next.js/flags', {
        headers: { 'user-agent': 'Googlebot/2.1' },
      }),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(true);
    expect(response.status).toBe(200);
  });

  it('keeps skill detail HTML cached longer at the edge to reduce crawler SSR pressure', async () => {
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/skills/langgenius/dify/backend-code-review', {
        headers: { 'user-agent': 'Mozilla/5.0 Chrome/126 Safari/537.36' },
      }),
      async () =>
        new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
    )) as Response;

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      import.meta.env.DEV ? 'no-store' : 'public, max-age=60, s-maxage=86400, stale-while-revalidate=86400',
    );
  });

  it('serves a compact capsule to AI crawlers on high-cardinality skill detail URLs', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/skills/obra/superpowers/systematic-debugging', {
        headers: {
          'user-agent': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.4)',
        },
      }),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Killer-Skills-Crawler-Capsule')).toBe('1');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.text()).toContain('systematic debugging skill');
  });

  it('serves a compact noindex capsule to search crawlers for sitemap-blocklisted skill details', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/ar/skills/udecode/plate/ankane-readme-writer', {
        headers: { 'user-agent': 'Googlebot/2.1' },
      }),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Killer-Skills-Crawler-Capsule')).toBe('1');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, follow');
  });

  it('checks blocklisted crawler paths before reading from the edge cache', () => {
    const source = readFileSync(new URL('./middleware.ts', import.meta.url), 'utf8');
    const crawlerBlocklistIndex = source.indexOf('const crawlerSkillPathMatch');
    const edgeCacheReadIndex = source.indexOf('if (shouldUseEdgeCache)');

    expect(crawlerBlocklistIndex).toBeGreaterThan(-1);
    expect(edgeCacheReadIndex).toBeGreaterThan(-1);
    expect(crawlerBlocklistIndex).toBeLessThan(edgeCacheReadIndex);
  });

  it('preserves explicit 410 rules before serving blocklisted crawler capsules', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/ar/skills/affaan-m/everything-claude-code/golang-testing', {
        headers: { 'user-agent': 'Googlebot/2.1' },
      }),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(410);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(response.headers.get('X-Killer-Skills-Crawler-Capsule')).toBeNull();
  });

  it('still blocks file-like trap paths under skills routes', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/skills/vercel/next.js/file.ts', {
        headers: { 'user-agent': 'Googlebot/2.1' },
      }),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(410);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('keeps file-like skill paths from the current seo gone rules off the index', async () => {
    const path = pickSeoGoneSourceLikeSkillPath();
    let nextCalled = false;
    const response = (await onRequest(
      createContext(`https://killer-skills.com${path}`, {
        headers: { 'user-agent': 'Googlebot/2.1' },
      }),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(410);
    expect(response.headers.get('Location')).toBeNull();
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('redirects source-file traps back to the only public repo skill when a single fallback route exists', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/skills/remotion-dev/skills/rules/lottie.md', {
        headers: { 'user-agent': 'Googlebot/2.1' },
      }),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('/en/skills/remotion-dev/skills/remotion');
  });

  it('redirects nested file-like trap paths to the canonical parent skill when a public parent exists', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/skills/vercel/next.js/flags/README.md', {
        headers: { 'user-agent': 'Googlebot/2.1' },
      }),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('/en/skills/vercel/next.js/flags');
  });

  it('redirects a repo root to the only public sub-skill route when sitemap data exposes a single fallback', async () => {
    const sample = pickUniqueRepoFallbackSample();
    let nextCalled = false;
    const response = (await onRequest(
      createContext(`https://killer-skills.com/${sample.requestLocale}/skills/${sample.owner}/${sample.repo}`, {
        headers: { 'user-agent': 'Googlebot/2.1' },
      }),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe(sample.expectedLocation);
  });

  it('redirects GSC-visible multi-skill repo roots to their canonical CTR target', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/skills/callstackincubator/agent-skills', {
        headers: { 'user-agent': 'Googlebot/2.1' },
      }),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe(
      '/en/skills/callstackincubator/agent-skills/react-native-best-practices',
    );
  });

  it('redirects suppressed locale skill pages to their governed canonical locale', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/ja/skills/langgenius/dify/frontend-code-review'),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('/en/skills/langgenius/dify/frontend-code-review');
  });

  it('returns 410 for owner-only skill trap paths instead of canonicalizing the trailing slash', async () => {
    let nextCalled = false;
    const response = (await onRequest(createContext('https://killer-skills.com/en/skills/xiangteng007/'), async () => {
      nextCalled = true;
      return new Response('<html></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    })) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(410);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('returns 410 for known repo roots that only act as multi-skill directories', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/de/skills/langgenius/dify', {
        headers: { 'user-agent': 'Googlebot/2.1' },
      }),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(410);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('allows crawler access to known repo roots that act as multi-skill directories when OVERRIDE_EXPANSION_BOUNDARY=open is set', async () => {
    process.env.OVERRIDE_EXPANSION_BOUNDARY = 'open';
    try {
      let nextCalled = false;
      const response = (await onRequest(
        createContext('https://killer-skills.com/de/skills/langgenius/dify', {
          headers: { 'user-agent': 'Googlebot/2.1' },
        }),
        async () => {
          nextCalled = true;
          return new Response('<html></html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        },
      )) as Response;

      expect(nextCalled).toBe(true);
      expect(response.status).toBe(200);
    } finally {
      delete process.env.OVERRIDE_EXPANSION_BOUNDARY;
    }
  });

  it('allows sitemap-blocklisted skill routes to render outside sitemap generation', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/skills/karyna1661/Audioform-'),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(true);
    expect(response.status).toBe(200);
  });

  it('does not canonicalize source-file repo names like AGENTS.md into fake sub-skill paths', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/en/skills/CongDon1207/AGENTS.md', {
        headers: { 'user-agent': 'Googlebot/2.1' },
      }),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(410);
    expect(response.headers.get('Location')).toBeNull();
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('returns 410 Gone for doubled path segments like /references/references', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/ar/skills/antvis/GPT-Vis/references/references/waterfall.md'),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(410);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('returns 410 Gone for doubled path segments like /rules/rules', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/pt/skills/remotion-dev/skills/rules/rules/get-video-dimensions.md'),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(410);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('returns 410 Gone for doubled path segments like /roles/roles', async () => {
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/ja/skills/catlog22/Claude-Code-Workflow/roles/roles/executor.md'),
      async () => {
        nextCalled = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    )) as Response;

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(410);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('does not flag non-repeated skill paths as gone', async () => {
    let nextCalled = false;
    const response = (await onRequest(createContext('https://killer-skills.com/en/skills/vercel/nextjs'), async () => {
      nextCalled = true;
      return new Response('<html></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    })) as Response;

    expect(nextCalled).toBe(true);
    expect(response.status).toBe(200);
  });
});
