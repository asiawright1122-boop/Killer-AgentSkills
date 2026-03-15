#!/usr/bin/env npx tsx

type PageCheck = {
  path: string;
  titleIncludes?: string;
  descriptionIncludes?: string;
  canonical: string;
  expectNoindex?: boolean;
  expectJsonLd?: boolean;
  mustNotContain?: string[];
};

const SITE_ORIGIN = 'https://killer-skills.com';
const baseUrl = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/+$/, '');
const MISSING_DOCS_SLUG = '/en/docs/__seo-smoke_missing_slug_404_guard__';
const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504, 522, 524]);
const SKILL_FILE_EXT_REGEX = /\.(md|ts|js|py|json|go|yaml|yml|toml|rs|rb|css|html|xml|txt)$/i;
const FETCH_TIMEOUT_MS = readPositiveInt(process.env.SEO_SMOKE_FETCH_TIMEOUT_MS, 15000);
const FETCH_RETRY_ATTEMPTS = readPositiveInt(
  process.env.SEO_SMOKE_FETCH_RETRIES,
  baseUrl.startsWith('https://') ? 6 : 3,
);
const FETCH_RETRY_DELAY_MS = readPositiveInt(process.env.SEO_SMOKE_FETCH_RETRY_DELAY_MS, 2000);
const SEO_SMOKE_CACHE_BUST = process.env.SEO_SMOKE_CACHE_BUST === '1';
const CACHE_BUST_VALUE = Date.now();

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
    path: '/en/skills?topic=browser%20automation',
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
  {
    path: '/es/collections/top-agentic-ai-mcp-servers',
    titleIncludes: 'Top',
    canonical: 'https://killer-skills.com/en/collections/top-agentic-ai-mcp-servers',
    expectNoindex: true,
    expectJsonLd: true,
  },
  {
    path: '/en/skills/anthropics/skills/side-project-personality-quiz',
    canonical: 'https://killer-skills.com/en/skills/anthropics/skills',
    expectJsonLd: true,
    mustNotContain: ['aggregateRating', 'ratingValue'],
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

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTransientFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError') return true;
  return /fetch failed|network|econnreset|enotfound|etimedout|socket hang up|unexpected eof/i.test(error.message);
}

function withCacheBust(path: string): string {
  if (!SEO_SMOKE_CACHE_BUST) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}seo_smoke_cache_bust=${CACHE_BUST_VALUE}`;
}

async function fetchWithRetry(path: string, expectedStatus?: number): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= FETCH_RETRY_ATTEMPTS; attempt += 1) {
    const requestUrl = `${baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(requestUrl, { signal: controller.signal });
      const passed = expectedStatus != null ? res.status === expectedStatus : res.ok;

      if (passed) return res;

      const expectedLabel = expectedStatus != null ? expectedStatus : 200;
      const transient = TRANSIENT_STATUS_CODES.has(res.status);
      lastError = new Error(`${path}: expected ${expectedLabel}, got ${res.status}`);

      if (transient && attempt < FETCH_RETRY_ATTEMPTS) {
        const waitMs = FETCH_RETRY_DELAY_MS * attempt;
        console.warn(
          `SEO smoke retry ${attempt}/${FETCH_RETRY_ATTEMPTS - 1} for ${path}: status ${res.status}, waiting ${waitMs}ms`,
        );
        await sleep(waitMs);
        continue;
      }

      throw lastError;
    } catch (error) {
      if (attempt < FETCH_RETRY_ATTEMPTS && isTransientFetchError(error)) {
        const waitMs = FETCH_RETRY_DELAY_MS * attempt;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `SEO smoke retry ${attempt}/${FETCH_RETRY_ATTEMPTS - 1} for ${path}: ${message}, waiting ${waitMs}ms`,
        );
        await sleep(waitMs);
        continue;
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(`${path}: request failed (${String(error)})`, { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error(`${path}: request failed after ${FETCH_RETRY_ATTEMPTS} attempts`);
}

async function fetchRedirectWithRetry(path: string, expectedStatus = 301): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= FETCH_RETRY_ATTEMPTS; attempt += 1) {
    const requestUrl = `${baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(requestUrl, { signal: controller.signal, redirect: 'manual' });
      if (res.status === expectedStatus) return res;

      const transient = TRANSIENT_STATUS_CODES.has(res.status);
      lastError = new Error(`${path}: expected ${expectedStatus}, got ${res.status}`);

      if (transient && attempt < FETCH_RETRY_ATTEMPTS) {
        const waitMs = FETCH_RETRY_DELAY_MS * attempt;
        console.warn(
          `SEO smoke retry ${attempt}/${FETCH_RETRY_ATTEMPTS - 1} for ${path}: status ${res.status}, waiting ${waitMs}ms`,
        );
        await sleep(waitMs);
        continue;
      }

      throw lastError;
    } catch (error) {
      if (attempt < FETCH_RETRY_ATTEMPTS && isTransientFetchError(error)) {
        const waitMs = FETCH_RETRY_DELAY_MS * attempt;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `SEO smoke retry ${attempt}/${FETCH_RETRY_ATTEMPTS - 1} for ${path}: ${message}, waiting ${waitMs}ms`,
        );
        await sleep(waitMs);
        continue;
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(`${path}: request failed (${String(error)})`, { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error(`${path}: request failed after ${FETCH_RETRY_ATTEMPTS} attempts`);
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
  const res = await fetchWithRetry(path);
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
        await fetchWithRetry(path);
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

  if (check.mustNotContain) {
    for (const needle of check.mustNotContain) {
      ensure(!html.includes(needle), `${check.path}: unexpected HTML content "${needle}"`);
    }
  }

  console.log(`SEO smoke passed: ${check.path}`);
}

async function runMissingDocs404Check() {
  await fetchWithRetry(MISSING_DOCS_SLUG, 404);
  console.log(`SEO smoke passed: docs missing slug returns 404`);
}

async function runSkillsSitemapChecks(): Promise<string[]> {
  const sitemapIndexXml = await fetchText(withCacheBust('/sitemap.xml'));
  const sitemapLocs = parseXmlLocs(sitemapIndexXml);
  const skillSitemapLocs = sitemapLocs.filter((loc) => /\/sitemap-skills-\d+\.xml$/.test(new URL(loc).pathname));
  ensure(skillSitemapLocs.length > 0, 'sitemap index must include at least one /sitemap-skills-{n}.xml');

  const allSkillLocs: string[] = [];
  const allSkillPaths: string[] = [];
  for (const sitemapLoc of skillSitemapLocs) {
    const localPath = toLocalPath(sitemapLoc);
    const xml = await fetchText(withCacheBust(localPath));
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
    const segments = parsed.pathname.split('/').filter(Boolean);
    const repoSegment = segments[segments.length - 1] || '';
    ensure(!SKILL_FILE_EXT_REGEX.test(repoSegment), `skills sitemap loc must not use file-like repo slug: ${loc}`);
    allSkillPaths.push(`${parsed.pathname}${parsed.search}`);
  }

  console.log(`SEO smoke passed: skills sitemap dedupe + URL shape (${allSkillLocs.length} URLs)`);
  return allSkillPaths;
}

async function runInvalidSubSkillRedirectCheck(skillPaths: string[]) {
  ensure(skillPaths.length > 0, 'skills sitemap must contain at least one skill URL');

  const parentPath = skillPaths[0]!;
  const fakeSubSkillPath = `${parentPath}/__seo_smoke_invalid_sub_skill_guard__`;
  const redirectResponse = await fetchRedirectWithRetry(withCacheBust(fakeSubSkillPath), 301);
  const location = redirectResponse.headers.get('location') || '';

  ensure(
    location === parentPath,
    `${fakeSubSkillPath}: expected redirect location "${parentPath}", got "${location || 'missing'}"`,
  );
  console.log(`SEO smoke passed: invalid sub-skill redirects to parent (${fakeSubSkillPath} -> ${parentPath})`);
}

async function runBlogSitemapChecks() {
  const blogXml = await fetchText(withCacheBust('/sitemap-blog.xml'));
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
  const skillPaths = await runSkillsSitemapChecks();
  await runInvalidSubSkillRedirectCheck(skillPaths);
  await runBlogSitemapChecks();

  console.log(`SEO smoke completed successfully against ${baseUrl}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
