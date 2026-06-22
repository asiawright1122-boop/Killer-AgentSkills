import { describe, expect, it } from 'vitest';
import { findHiddenReasoningPublicOutputMatches } from '../../src/lib/public-ai-output';

type RouteCase = {
  label: string;
  load: () => Promise<{ GET: (context: any) => Response | Promise<Response> }>;
  context?: Record<string, unknown>;
};

const publicTextRoutes: RouteCase[] = [
  {
    label: '/llms.txt',
    load: () => import('../../src/pages/llms.txt'),
  },
  {
    label: '/llms-full.txt',
    load: () => import('../../src/pages/llms-full.txt'),
  },
  {
    label: '/robots.txt',
    load: () => import('../../src/pages/robots.txt'),
  },
  {
    label: '/sitemap.xml',
    load: () => import('../../src/pages/sitemap.xml'),
  },
  {
    label: '/sitemap-static.xml',
    load: () => import('../../src/pages/sitemap-static.xml'),
  },
  {
    label: '/sitemap-docs.xml',
    load: () => import('../../src/pages/sitemap-docs.xml'),
  },
  {
    label: '/sitemap-skills.xml',
    load: () => import('../../src/pages/sitemap-skills.xml'),
  },
  {
    label: '/sitemap-skills-1.xml',
    load: () => import('../../src/pages/sitemap-skills-[page].xml'),
    context: { params: { page: '1' } },
  },
  {
    label: '/sitemap-owners-1.xml',
    load: () => import('../../src/pages/sitemap-owners-[page].xml'),
  },
];

describe('public text routes', () => {
  it.each(publicTextRoutes)('keeps $label free of hidden reasoning markers', async ({ load, context }) => {
    const mod = await load();
    const response = await mod.GET((context ?? {}) as never);
    const body = await response.text();

    expect(findHiddenReasoningPublicOutputMatches(body)).toEqual([]);
  });
});
