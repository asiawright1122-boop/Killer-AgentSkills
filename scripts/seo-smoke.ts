#!/usr/bin/env npx tsx

type PageCheck = {
  path: string;
  titleIncludes?: string;
  descriptionIncludes?: string;
  canonical: string;
  expectNoindex?: boolean;
  expectJsonLd?: boolean;
};

const baseUrl = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/+$/, '');

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
    canonical: 'https://killer-skills.com/en/skills?q=workflow%20automation',
    expectNoindex: true,
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

async function fetchHtml(path: string): Promise<string> {
  const res = await fetch(`${baseUrl}${path}`);
  ensure(res.ok, `${path}: expected 200, got ${res.status}`);
  return res.text();
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

async function main() {
  for (const check of checks) {
    await runCheck(check);
  }

  console.log(`SEO smoke completed successfully against ${baseUrl}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
