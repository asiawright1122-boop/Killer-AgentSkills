import { describe, expect, it, vi } from 'vitest';
import seo404RulesData from '../data/seo-404-rules.json';
import sitemapBlocklistData from '../data/seo-sitemap-blocklist.json';
import sitemapSkillsData from '../data/sitemap-skills.json';
import skillLocaleGovernanceData from '../data/seo-skill-locale-governance.json';
import { buildLocalizedSkillPath, getSkillRoutePath, type SitemapSkillEntry } from './lib/skill-route-paths';
import { compileSitemapBlocklist, isSitemapSkillBlocked } from './lib/sitemap-blocklist';

vi.mock('astro:middleware', () => ({
  defineMiddleware: <T>(fn: T) => fn,
}));

import { onRequest } from './middleware';

const SKILL_SOURCE_FILE_EXT_RE =
  /\.(md|mdx|ts|tsx|js|jsx|py|json|go|yaml|yml|toml|rs|rb|css|html|xml|txt|ini|csv|lock)$/i;

type SkillLocaleGovernanceRecord = {
  owner: string;
  routePath: string;
  canonicalLocale: string | null;
  publishedLocales: string[];
};

const sitemapBlocklist = compileSitemapBlocklist(sitemapBlocklistData);

function normalizeSitemapSkillRecord(record: Partial<SitemapSkillEntry>) {
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
  ) as Array<Partial<SitemapSkillEntry>>;

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

  it('strips first-page skills listing params back to the canonical listing URL', async () => {
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
    expect(response.headers.get('Location')).toBe('/en/skills?topic=workflow');
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
      createContext('https://killer-skills.com/en/skills/eannnnnn/taptik-labs/gh', {
        headers: { 'user-agent': 'Googlebot/2.1' },
      }),
      async () =>
        new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
    )) as Response;

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=60, s-maxage=86400, stale-while-revalidate=86400',
    );
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
      createContext('https://killer-skills.com/de/skills/DataRecce/recce/recce-mcp-e2e'),
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
    expect(response.headers.get('Location')).toBe('/en/skills/DataRecce/recce/recce-mcp-e2e');
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
      createContext('https://killer-skills.com/de/skills/Galaxy-Dawn/claude-scholar', {
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
        createContext('https://killer-skills.com/de/skills/Galaxy-Dawn/claude-scholar', {
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
