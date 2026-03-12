#!/usr/bin/env npx tsx

type PageCheck = {
  path: string;
  titleIncludes?: string;
  descriptionIncludes?: string;
  canonical: string;
  expectNoindex?: boolean;
  expectJsonLd?: boolean;
};

const SITE_ORIGIN = 'https://killer-skills.com';
const baseUrl = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/+$/, '');
const MISSING_DOCS_SLUG = '/en/docs/__seo-smoke_missing_slug_404_guard__';

const checks: PageCheck[] = [
  {
    path: '/en',
    titleIncludes: 'AI Agent Skills',
    canonical: 'https://killer-skills.com/en',
    expectJsonLd: true,
  },
  {
    path: '/en/skills',
    titleIncludes: 'Skills',
    canonical: 'https://killer-skills.com/en/skills',
    expectJsonLd: true,
  },
  {
    path: '/en/skills?q=workflow%20automation',
    titleIncludes: 'Workflow Automation Skills',
    canonical: 'https://killer-skills.com/en/skills',
    expectNoindex: true,
    expectJsonLd: true,
  },
  {
    path: '/en/skills?category=developer-experience',
    canonical: 'https://killer-skills.com/en/skills',
    expectNoindex: true,
    expectJsonLd: true,
  },
  {
    path: '/en/solutions/workflow-automation',
    titleIncludes: 'Workflow Automation',
    canonical: 'https://killer-skills.com/en/solutions/workflow-automation',
    expectJsonLd: true,
  },
  {
    path: '/en/cli',
    titleIncludes: 'AI Agent Skills CLI',
    canonical: 'https://killer-skills.com/en/cli',
    expectJsonLd: true,
  },
  {
    path: '/en/integrations',
    titleIncludes: 'Cursor',
    canonical: 'https://killer-skills.com/en/integrations',
    expectJsonLd: true,
  },
  {
    path: '/en/docs',
    titleIncludes: 'Docs',
    canonical: 'https://killer-skills.com/en/docs',
    expectJsonLd: true,
  },
  {
    path: '/en/blog/what-are-ai-agent-skills',
    titleIncludes: 'What Are AI Agent Skills',
    descriptionIncludes: 'SKILL.md',
    canonical: 'https://killer-skills.com/en/blog/what-are-ai-agent-skills',
    expectJsonLd: true,
  },
  {
    path: '/en/blog/how-to-install-ai-agent-skills',
    titleIncludes: 'How to Install AI Agent Skills',
    descriptionIncludes: 'npx killer-skills add',
    canonical: 'https://killer-skills.com/en/blog/how-to-install-ai-agent-skills',
    expectJsonLd: true,
  },
  {
    path: '/en/blog/category/developer-experience',
    titleIncludes: 'Developer Workflow Guides',
    canonical: 'https://killer-skills.com/en/blog/category/developer-experience',
    expectJsonLd: true,
  },
];

function readTagContent(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1] || null;
}

function ensure(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseXmlLocs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gim))
    .map((m) => m[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function findDuplicates(items: string[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([item]) => item);
}

function toLocalPath(url: string): string {
  const parsed = new URL(url);
  ensure(parsed.origin === SITE_ORIGIN, `sitemap loc origin mismatch: ${url}`);
  return `${parsed.pathname}${parsed.search}`;
}

async function fetchText(path: string): Promise<string> {
  const res = await fetch(`${baseUrl}${path}`);
  ensure(res.ok, `${path}: expected 200, got ${res.status}`);
  return res.text();
}

async function assertAllPaths200(paths: string[], label: string, concurrency = 20): Promise<void> {
  if (paths.length === 0) return;
  const queue = [...paths];
  const failures: string[] = [];

  const worker = async () => {
    while (queue.length > 0) {
      const path = queue.shift();
      if (!path) return;
      try {
        const res = await fetch(`${baseUrl}${path}`);
        if (!res.ok) {
          failures.push(`${path} -> ${res.status}`);
        }
      } catch (error) {
        failures.push(`${path} -> ${(error as Error).message}`);
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, paths.length) }, () => worker());
  await Promise.all(workers);
  ensure(
    failures.length === 0,
    `${label}: found non-200 URLs\n${failures
      .slice(0, 10)
      .map((item) => `- ${item}`)
      .join('\n')}`,
  );
}

async function fetchHtml(path: string): Promise<string> {
  return fetchText(path);
}

async function runCheck(check: PageCheck) {
  const html = await fetchHtml(check.path);
  const title = readTagContent(html, /<title>(.*?)<\/title>/i);
  const description = readTagContent(html, /<meta\s+name="description"\s+content="(.*?)"/i);
  const canonical = readTagContent(html, /<link\s+rel="canonical"\s+href="(.*?)"/i);
  const robots = readTagContent(html, /<meta\s+name="robots"\s+content="(.*?)"/i);

  ensure(Boolean(title), `${check.path}: missing <title>`);
  ensure(Boolean(description), `${check.path}: missing meta description`);
  ensure(Boolean(canonical), `${check.path}: missing canonical`);
  ensure(title!.length >= 10 && title!.length <= 85, `${check.path}: title length out of range (${title!.length})`);
  ensure(
    description!.length >= 50 && description!.length <= 180,
    `${check.path}: description length out of range (${description!.length})`,
  );
  ensure(canonical === check.canonical, `${check.path}: canonical mismatch (${canonical})`);

  if (check.titleIncludes) {
    ensure(title!.includes(check.titleIncludes), `${check.path}: title missing "${check.titleIncludes}"`);
  }

  if (check.descriptionIncludes) {
    ensure(
      description!.includes(check.descriptionIncludes),
      `${check.path}: description missing "${check.descriptionIncludes}"`,
    );
  }

  if (check.expectNoindex) {
    ensure(robots?.includes('noindex') === true, `${check.path}: expected noindex robots tag`);
  } else {
    ensure(robots?.includes('index') === true, `${check.path}: expected index robots tag`);
  }

  if (check.expectJsonLd) {
    ensure(html.includes('application/ld+json'), `${check.path}: expected structured data script`);
  }

  console.log(`SEO smoke passed: ${check.path}`);
}

async function runMissingDocs404Check() {
  const res = await fetch(`${baseUrl}${MISSING_DOCS_SLUG}`);
  ensure(res.status === 404, `docs 404 guard failed: ${MISSING_DOCS_SLUG} returned ${res.status}`);
  console.log(`SEO smoke passed: docs missing slug returns 404`);
}

async function runSkillsSitemapChecks() {
  const sitemapIndexXml = await fetchText('/sitemap.xml');
  const sitemapLocs = parseXmlLocs(sitemapIndexXml);
  const skillSitemapLocs = sitemapLocs.filter((loc) => /\/sitemap-skills-\d+\.xml$/.test(new URL(loc).pathname));
  ensure(skillSitemapLocs.length > 0, 'sitemap index must include at least one /sitemap-skills-{n}.xml');

  const allSkillLocs: string[] = [];
  for (const sitemapLoc of skillSitemapLocs) {
    const localPath = toLocalPath(sitemapLoc);
    const xml = await fetchText(localPath);
    allSkillLocs.push(...parseXmlLocs(xml));
  }

  const dupSkillLocs = findDuplicates(allSkillLocs);
  ensure(
    dupSkillLocs.length === 0,
    `skills sitemap duplicate URLs detected:\n${dupSkillLocs
      .slice(0, 10)
      .map((item) => `- ${item}`)
      .join('\n')}`,
  );

  for (const loc of allSkillLocs) {
    const parsed = new URL(loc);
    ensure(parsed.origin === SITE_ORIGIN, `skills sitemap loc must use canonical origin: ${loc}`);
    ensure(parsed.search === '', `skills sitemap loc must not contain query params: ${loc}`);
    ensure(
      /^\/[a-z]{2}\/skills\/[^/]+\/[^/]+$/.test(parsed.pathname),
      `skills sitemap loc has invalid path depth/format: ${loc}`,
    );
  }

  console.log(`SEO smoke passed: skills sitemap dedupe + URL shape (${allSkillLocs.length} URLs)`);
}

async function runBlogSitemapChecks() {
  const blogXml = await fetchText('/sitemap-blog.xml');
  const blogLocs = parseXmlLocs(blogXml);
  ensure(blogLocs.length > 0, 'sitemap-blog.xml has no URLs');

  const dupBlogLocs = findDuplicates(blogLocs);
  ensure(
    dupBlogLocs.length === 0,
    `blog sitemap duplicate URLs detected:\n${dupBlogLocs
      .slice(0, 10)
      .map((item) => `- ${item}`)
      .join('\n')}`,
  );

  const localPaths: string[] = [];
  for (const loc of blogLocs) {
    const parsed = new URL(loc);
    ensure(parsed.origin === SITE_ORIGIN, `blog sitemap loc must use canonical origin: ${loc}`);
    ensure(parsed.search === '', `blog sitemap loc must not contain query params: ${loc}`);
    ensure(/^\/[a-z]{2}\/blog\/[^?#]+$/.test(parsed.pathname), `blog sitemap loc has invalid format: ${loc}`);
    localPaths.push(`${parsed.pathname}${parsed.search}`);
  }

  // Verify blog sitemap links are actually routable to avoid "sitemap -> 404" regressions.
  await assertAllPaths200(localPaths, 'blog sitemap URL availability');

  console.log(`SEO smoke passed: blog sitemap URL availability (${localPaths.length} URLs)`);
}

async function main() {
  for (const check of checks) {
    await runCheck(check);
  }

  await runMissingDocs404Check();
  await runSkillsSitemapChecks();
  await runBlogSitemapChecks();

  console.log(`SEO smoke completed successfully against ${baseUrl}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
