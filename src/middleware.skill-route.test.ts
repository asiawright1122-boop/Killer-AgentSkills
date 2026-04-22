import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:middleware', () => ({
  defineMiddleware: <T>(fn: T) => fn,
}));

import { onRequest } from './middleware';

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

  it('keeps reported source-file traps off the index when the repo is not in the public corpus', async () => {
    for (const url of [
      'https://killer-skills.com/ar/skills/antvis/GPT-Vis/references/references/waterfall.md',
      'https://killer-skills.com/es/skills/woody1234567/Nuxt_tech_blog/references/site-config.md',
    ]) {
      let nextCalled = false;
      const response = (await onRequest(
        createContext(url, {
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
    }
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
    let nextCalled = false;
    const response = (await onRequest(
      createContext('https://killer-skills.com/ko/skills/opentabs-dev/opentabs', {
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
    expect(response.headers.get('Location')).toBe('/en/skills/opentabs-dev/opentabs/build-plugin');
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

  it('returns 410 for blocklisted skill routes even without crawler-specific user agents', async () => {
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

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(410);
    expect(response.headers.get('Location')).toBeNull();
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
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
});
