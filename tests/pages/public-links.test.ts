import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveSkillDetailLocale } from '../../src/lib/skill-locale-link';
import en from '../../src/messages/en.json';
import zh from '../../src/messages/zh.json';

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

const readPageSource = (relativePath: string) => {
  const normalizedRelativePath = relativePath.startsWith('./')
    ? `src/pages/${relativePath.slice(2)}`
    : relativePath.startsWith('../')
      ? `src/${relativePath.slice(3)}`
      : relativePath;

  return readFileSync(new URL(`../../${normalizedRelativePath}`, import.meta.url), 'utf8');
};
const readRepoSource = (relativePath: string) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
const readLocaleMessages = (locale: string) =>
  JSON.parse(readFileSync(new URL(`../../src/messages/${locale}.json`, import.meta.url), 'utf8')) as Record<
    string,
    unknown
  >;
const allLocaleMessages = ['ar', 'de', 'en', 'es', 'fr', 'ja', 'ko', 'pt', 'ru', 'zh'].map((locale) => ({
  locale,
  messages: readLocaleMessages(locale),
}));

const resolveMessageKey = (messages: Record<string, unknown>, key: string): unknown =>
  key.split('.').reduce<unknown>((value, segment) => {
    if (value && typeof value === 'object' && segment in (value as Record<string, unknown>)) {
      return (value as Record<string, unknown>)[segment];
    }
    return undefined;
  }, messages);

const extractTranslationKeys = (source: string): string[] => {
  const keys = new Set<string>();
  const translationKeyPattern = /translateOr\([^,]+,\s*'([^']+)'|\btr\('([^']+)'\)|\bt\('([^']+)'\)/g;

  for (const match of source.matchAll(translationKeyPattern)) {
    const key = match[1] || match[2] || match[3];
    if (key) {
      keys.add(key);
    }
  }

  return [...keys];
};

const SOURCE_FILE_EXTENSIONS = new Set(['.md', '.astro', '.ts', '.tsx']);

const collectRepoFiles = (relativeDir: string): string[] => {
  const absoluteDir = resolve(REPO_ROOT, relativeDir);
  const results: string[] = [];

  const walk = (currentDir: string) => {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = resolve(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (!SOURCE_FILE_EXTENSIONS.has(extname(entry.name))) continue;
      results.push(absolutePath.slice(REPO_ROOT.length + 1));
    }
  };

  walk(absoluteDir);
  return results.sort();
};

const collectRepoFilesByExtensions = (relativeDir: string, extensions: Set<string>): string[] => {
  const absoluteDir = resolve(REPO_ROOT, relativeDir);
  const results: string[] = [];

  const walk = (currentDir: string) => {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = resolve(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (!extensions.has(extname(entry.name))) continue;
      results.push(absolutePath.slice(REPO_ROOT.length + 1));
    }
  };

  walk(absoluteDir);
  return results.sort();
};

const PUBLIC_COPY_BOUNDARY_EXTENSIONS = new Set(['.astro', '.json', '.ts']);
const blockedPhrase = (...parts: string[]) => parts.join('');
const blockedRegex = (parts: string[], flags = 'i') => new RegExp(parts.join(''), flags);
const PUBLIC_COPY_BOUNDARY_RULES = [
  { label: 'operator handoff', pattern: /\boperator handoff\b/i },
  { label: 'operator checkpoint', pattern: /\boperator checkpoint\b/i },
  { label: 'operator clarity', pattern: /\boperator clarity\b/i },
  { label: 'operator guardrails', pattern: /\boperator guardrails?\b/i },
  { label: 'trusted starter collection', pattern: /\btrusted starter collection\b/i },
  { label: 'editorial filter', pattern: /\beditorial filter\b/i },
  { label: 'sanity-check', pattern: /\bsanity-check\b/i },
  { label: 'workflow intent', pattern: /\bworkflow intent\b/i },
  { label: 'step-connector phrasing', pattern: blockedRegex(['\\bnext', '-step\\b']) },
  { label: 'cli proof phrasing', pattern: blockedRegex(['\\bCLI ', 'validation\\b']) },
  { label: 'workflow launch phrasing', pattern: blockedRegex(['\\bworkflow ', 'rollout\\b']) },
  { label: 'reference limitation phrasing', pattern: blockedRegex(['\\breference', '-only\\b']) },
  { label: 'review policy phrasing', pattern: blockedRegex(['\\breview ', 'guardrails\\b']) },
  { label: 'proof phrasing', pattern: blockedRegex(['\\bvalidated\\b']) },
  { label: 'choice-page phrasing', pattern: blockedRegex(['\\bbetter decision ', 'page\\b']) },
  { label: 'source-evidence phrasing', pattern: blockedRegex(['\\bsupporting ', 'evidence\\b']) },
  { label: 'install-bridge phrasing', pattern: blockedRegex(['\\bUse installation as the ', 'bridge\\b']) },
  { label: 'routing-table phrasing', pattern: blockedRegex(['\\bmust route ', 'discovery\\b']) },
  { label: 'root-hub phrasing', pattern: blockedRegex(['\\bRoot ', 'Hub\\b']) },
  { label: 'trust-score phrasing', pattern: blockedRegex(['\\bhigh', '-trust\\b']) },
  { label: 'long-tail phrasing', pattern: blockedRegex(['\\brandom ', 'long-tail\\b']) },
  { label: 'evaluation-to-adoption phrasing', pattern: blockedRegex(['\\bevaluation into ', 'setup\\b']) },
  { label: 'step-label phrasing', pattern: blockedRegex(['\\bNext ', 'Steps\\b']) },
  { label: 'installation-hub phrasing', pattern: blockedRegex(['\\binstallation ', 'hub\\b']) },
  { label: 'random-repo phrasing', pattern: blockedRegex(['\\brandom .*', 'repos\\b']) },
  { label: 'homepage-instruction phrasing', pattern: blockedRegex(['\\bhomepage should move ', 'users\\b']) },
  { label: 'user-routing phrasing', pattern: blockedRegex(['\\bWhen users already ', 'know\\b']) },
  { label: 'curated-for phrasing', pattern: /\bcurated for\b/i },
  { label: 'send-users phrasing', pattern: blockedRegex(['\\bSend ', 'users\\b']) },
  { label: 'route-users phrasing', pattern: blockedRegex(['\\bRoute ', 'users\\b']) },
  { label: 'entry-should phrasing', pattern: blockedRegex(['\\bEach entry ', 'should\\b']) },
  { label: 'keyword-traffic phrasing', pattern: blockedRegex(['\\btraffic ', 'capture\\b']) },
  { label: 'public-surface phrasing', pattern: blockedRegex(['\\bMore Useful ', 'Surfaces\\b']) },
  { label: 'authority-collection phrasing', pattern: blockedRegex(['\\bRelated Authority ', 'Collections\\b']) },
  { label: 'handoff', pattern: /\bhandoffs?\b/i },
  { label: 'high-intent', pattern: /\bhigh-intent\b/i },
  { label: '收口', pattern: /收口/ },
  { label: '交叉核对', pattern: /交叉核对/ },
  { label: '已验证路径', pattern: /已验证路径/ },
  { label: '标准化之前', pattern: /标准化之前/ },
  { label: '落地路径', pattern: /落地路径/ },
  { label: '承接', pattern: /承接/ },
  { label: '高意图', pattern: /高意图/ },
  { label: '高意図', pattern: /高意図/ },
  { label: '고의도', pattern: /고의도/ },
  { label: '决策入口', pattern: /决策入口/ },
  { label: '发现流量', pattern: /发现流量/ },
  { label: '精选参考', pattern: /精选参考/ },
  { label: '验证清单', pattern: /验证清单/ },
  { label: '关键验证步骤', pattern: /关键验证步骤/ },
  { label: '把用户送进', pattern: /把用户送进/ },
  { label: 'collection step label', pattern: /\bStep\s+(?:\d+\s*:|\$\{)/ },
  { label: 'collection path label', pattern: /\b(?:Primary\s+)?Path\s+\d+\b/ },
  { label: 'install checklist', pattern: /\binstall\s+checklist\b/i },
  { label: '团队适配', pattern: /团队适配/ },
  { label: '安装清单', pattern: /安装清单/ },
  { label: '检查点', pattern: /检查点/ },
];
const PUBLIC_COPY_BOUNDARY_TARGETS = [
  'src/pages/[locale]/index.astro',
  'src/pages/[locale]/collections',
  'src/pages/[locale]/solutions',
  'src/pages/[locale]/docs',
  'src/pages/[locale]/skills',
  'src/content/collections',
  'src/messages',
  'src/lib/authority-surface-public-data.ts',
];

const collectPublicCopyBoundaryFiles = (): string[] => {
  const files = new Set<string>();

  for (const target of PUBLIC_COPY_BOUNDARY_TARGETS) {
    const absoluteTarget = resolve(REPO_ROOT, target);
    if (statSync(absoluteTarget).isDirectory()) {
      for (const relativePath of collectRepoFilesByExtensions(target, PUBLIC_COPY_BOUNDARY_EXTENSIONS)) {
        files.add(relativePath);
      }
    } else {
      files.add(target);
    }
  }

  return [...files].sort();
};

const collectStringLeafValues = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectStringLeafValues(item));
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap((item) => collectStringLeafValues(item));
  }

  return [];
};

const SITE_URL_TRAILING_SLASH_PATTERN = /https:\/\/killer-skills\.com\/[^\s)"'`?#]+\/(?=[\s)"'`]|$)/g;
const SITE_URL_QUERY_PATTERN = /https:\/\/killer-skills\.com\/[^\s)"'`]*\?[^\s)"'`]*/g;
const HARDCODED_SKILL_LINK_PATTERN =
  /(?:https:\/\/killer-skills\.com)?\/(ar|de|en|es|fr|ja|ko|pt|ru|zh)\/skills\/([^/\s)"'`]+)\/([^\s)"'`]+)/g;

describe('public links and navigation copy', () => {
  it('keeps smoke-scope public surfaces on explicit translation fallbacks', () => {
    const files = [
      '../components/Header.astro',
      '../components/Footer.astro',
      '../components/Pagination.astro',
      '../components/SkillCard.astro',
      '../layouts/Layout.astro',
      '../pages/[locale]/index.astro',
      '../pages/[locale]/skills/index.astro',
      '../pages/[locale]/skills/[owner]/[...repo].astro',
      '../pages/[locale]/blog/index.astro',
      '../pages/[locale]/blog/category/[category].astro',
      '../pages/[locale]/blog/[...slug].astro',
      '../pages/[locale]/docs/[...slug].astro',
      '../pages/[locale]/solutions/[topic].astro',
    ];
    const leakedFallbackPattern = /(?<![a-zA-Z])t\(['"`][^'"`]+['"`]\)\s*\|\||t\s*\?\s*t\(['"`][^'"`]+['"`]/;

    for (const file of files) {
      expect(readPageSource(file)).not.toMatch(leakedFallbackPattern);
    }
  });

  it('keeps shared metadata and breadcrumb builders wired into public shells', () => {
    const layoutSource = readPageSource('../layouts/Layout.astro');
    const collectionsIndexSource = readPageSource('../pages/[locale]/collections/index.astro');
    const collectionsDetailSource = readPageSource('../pages/[locale]/collections/[...slug].astro');

    expect(layoutSource).toContain('buildPageMetadata');
    expect(collectionsIndexSource).toContain('buildBreadcrumbTrail');
    expect(collectionsDetailSource).toContain('buildBreadcrumbTrail');
  });

  it('keeps community navigation wired to a live community page', () => {
    expect(en.Footer.community).toBe('Community');
    expect(zh.Footer.community).toBe('社区');
  });

  it('keeps homepage seo intro and header action labels localized in shipped message catalogs', () => {
    const headerSource = readPageSource('../components/Header.astro');

    expect(headerSource).toContain("submitSkill: tr('Navigation.submitSkill', 'Submit Skill')");
    expect(headerSource).toContain("search: tr('Common.search', 'Search')");
    expect(en.Home.seoIntro).toContain('open-source directory');
    expect(zh.Home.seoIntro).toContain('开源目录');
  });

  it('keeps touched public shell and collections pages on explicit i18n and shared builders', () => {
    const headerSource = readPageSource('../components/Header.astro');
    const footerSource = readPageSource('../components/Footer.astro');
    const skillCardSource = readPageSource('../components/SkillCard.astro');
    const layoutSource = readPageSource('../layouts/Layout.astro');
    const homeSource = readPageSource('./[locale]/index.astro');
    const collectionsIndexSource = readPageSource('./[locale]/collections/index.astro');
    const collectionDetailSource = readPageSource('./[locale]/collections/[...slug].astro');

    expect(headerSource).not.toMatch(/t\('[^']+'\)\s*\|\|/);
    expect(footerSource).not.toMatch(/t\('[^']+'\)\s*\|\|/);
    expect(skillCardSource).not.toMatch(/t\s*\?\s*t\('[^']+'/);
    expect(homeSource).not.toMatch(/t\('[^']+'\)\s*\|\|/);

    expect(headerSource).toContain('translateOr(');
    expect(footerSource).toContain('translateOr(');
    expect(skillCardSource).toContain('translateOr(');
    expect(homeSource).toContain('translateOr(');
    expect(layoutSource).toContain('buildPageMetadata(');
    expect(collectionsIndexSource).toContain('buildBreadcrumbTrail(');
    expect(collectionDetailSource).toContain('buildBreadcrumbTrail(');

    expect(collectionsIndexSource).not.toContain("'@type': 'BreadcrumbList'");
    expect(collectionDetailSource).not.toContain("'@type': 'BreadcrumbList'");
  });

  it('keeps skills listing pagination and ItemList URLs on canonical governed routes', () => {
    const skillsIndexSource = readPageSource('../pages/[locale]/skills/index.astro');
    const paginationSource = readPageSource('../components/Pagination.astro');
    const skillsSidebarSource = readPageSource('../components/SkillsSidebar.astro');

    expect(skillsIndexSource).toContain('...(topicParam && { topic: topicParam })');
    expect(skillsIndexSource).toContain('const buildSkillItemUrl = (skill: UnifiedSkill) => {');
    expect(skillsIndexSource).toContain('const routePath = getSkillRoutePath(skill) || skill.repo;');
    expect(skillsIndexSource).toContain(
      'const detailLocale = resolveSkillDetailLocale(skill.owner, routePath, locale);',
    );
    expect(skillsIndexSource).toContain(
      'return `https://killer-skills.com${buildLocalizedSkillPath(detailLocale, skill.owner, routePath)}`;',
    );
    expect(skillsIndexSource).toContain('url: buildSkillItemUrl(s),');
    expect(paginationSource).toContain('if (p > 1) {');
    expect(paginationSource).toContain("params.delete('page');");
    expect(skillsSidebarSource).toContain('href={`/${locale}/skills?topic=${fw.id}`}');
    expect(skillsSidebarSource).not.toContain('href={`/${locale}/skills?tag=${fw.id}`}');
  });

  it('keeps parameterized skills listing pages on bounded queries for crawl stability', () => {
    const skillsIndexSource = readPageSource('../pages/[locale]/skills/index.astro');
    const layoutSource = readPageSource('../layouts/Layout.astro');

    expect(skillsIndexSource).toContain('FILTERED_SKILL_SAMPLE_LIMIT');
    expect(skillsIndexSource).toContain('getLightweightSkillsTop(env, FILTERED_SKILL_SAMPLE_LIMIT)');
    expect(skillsIndexSource).toContain('shouldLoadFilteredListingData');
    expect(skillsIndexSource).toContain("const robotsContent = hasListingParams ? 'noindex, follow' : undefined;");
    expect(skillsIndexSource).toContain("Astro.response.headers.set('X-Robots-Tag', robotsContent);");
    expect(skillsIndexSource).toContain('robots={robotsContent}');
    expect(layoutSource).toContain('<meta name="robots" content={robotsContent} />');
    expect(skillsIndexSource).not.toContain('getLightweightSkills(env)');
    expect(skillsIndexSource).not.toContain('shouldLoadFullListingData');
  });

  it('keeps canonicalized noindex pages followable across robots headers and meta tags', () => {
    const collectionDetailSource = readPageSource('../pages/[locale]/collections/[...slug].astro');
    const solutionIndexSource = readPageSource('../pages/[locale]/solutions/index.astro');
    const solutionDetailSource = readPageSource('../pages/[locale]/solutions/[topic].astro');
    const skillDetailSource = readPageSource('../pages/[locale]/skills/[owner]/[...repo].astro');

    for (const source of [collectionDetailSource, solutionIndexSource, solutionDetailSource]) {
      expect(source).toContain("const robotsContent = isIndexableLocale ? undefined : 'noindex, follow';");
      expect(source).toContain("Astro.response.headers.set('X-Robots-Tag', robotsContent);");
      expect(source).toContain('robots={robotsContent}');
    }

    expect(skillDetailSource).toContain("const robotsContent = layoutNoindex ? 'noindex, follow' : undefined;");
    expect(skillDetailSource).toContain("Astro.response.headers.set('X-Robots-Tag', robotsContent);");
    expect(skillDetailSource).toContain('robots={robotsContent}');
  });

  it('keeps personal state pages explicitly noindex across robots headers and meta tags', () => {
    const favoritesSource = readPageSource('../pages/[locale]/favorites/index.astro');
    const historySource = readPageSource('../pages/[locale]/history/index.astro');
    const middlewareSource = readPageSource('../middleware.ts');

    for (const source of [favoritesSource, historySource]) {
      expect(source).toContain("const robotsContent = 'noindex, nofollow';");
      expect(source).toContain("Astro.response.headers.set('X-Robots-Tag', robotsContent);");
      expect(source).toContain('robots={robotsContent}');
    }

    expect(middlewareSource).toContain(
      'const isPersonalStatePath = /^\\/[a-z]{2}\\/(?:favorites|history)\\/?$/.test(pathname);',
    );
    expect(middlewareSource).toContain('else if (isPersonalStatePath)');
  });

  it('keeps the static 404 shell noindex in HTML metadata', () => {
    const notFoundSource = readPageSource('../pages/404.astro');

    expect(notFoundSource).toContain("const robotsContent = 'noindex, nofollow';");
    expect(notFoundSource).toContain('noindex={true}');
    expect(notFoundSource).toContain('robots={robotsContent}');
  });

  it('keeps blog intent links on indexable solution and docs paths instead of fixed search-result URLs', () => {
    const blogSeoIntentSource = readPageSource('../lib/blog-seo-intent.ts');

    expect(blogSeoIntentSource).toContain("href: buildSolutionPath(locale, 'document-automation'),");
    expect(blogSeoIntentSource).toContain("href: buildSolutionPath(locale, 'agent-workflows'),");
    expect(blogSeoIntentSource).toContain("href: buildSolutionPath(locale, 'process-automation'),");
    expect(blogSeoIntentSource).toContain("href: buildSolutionPath(locale, 'workflow-automation'),");
    expect(blogSeoIntentSource).not.toContain('/skills?q=document automation');
    expect(blogSeoIntentSource).not.toContain('/skills?q=skills for developer workflows');
    expect(blogSeoIntentSource).not.toContain('/skills?q=process automation');
    expect(blogSeoIntentSource).not.toContain('/skills?q=workflow automation');
  });

  it('keeps sitemap-listed blog routes as SSR canonical pages instead of static noindex redirect shells', () => {
    const blogDetailSource = readPageSource('../pages/[locale]/blog/[...slug].astro');
    const blogCategorySource = readPageSource('../pages/[locale]/blog/category/[category].astro');
    const blogSitemapSource = readPageSource('./sitemap-blog.xml.ts');

    expect(blogDetailSource).toContain('export const prerender = false;');
    expect(blogDetailSource).not.toContain('getStaticPaths');
    expect(blogDetailSource).toContain('id === `${locale}/${slug}` && !data.draft');
    expect(blogCategorySource).toContain('export const prerender = false;');
    expect(blogCategorySource).not.toContain('getStaticPaths');
    expect(blogSitemapSource).toContain('`${SITE}/${locale}/blog/${slug}`');
    expect(blogSitemapSource).not.toContain('`${SITE}/${locale}/blog/${slug}.html`');
  });

  it('keeps public links to internal skill search-result pages marked nofollow', () => {
    const homeSource = readPageSource('./[locale]/index.astro');
    const skillsIndexSource = readPageSource('./[locale]/skills/index.astro');
    const skillDetailSource = readPageSource('./[locale]/skills/[owner]/[...repo].astro');

    expect(homeSource).toContain('href={`/${locale}/skills?q=${encodeURIComponent(tag)}`}');
    expect(homeSource).toContain('rel="nofollow"');
    expect(skillsIndexSource).toContain('href={`/${locale}/skills?q=${encodeURIComponent(tag)}`}');
    expect(skillsIndexSource).toContain('rel="nofollow"');
    expect(skillDetailSource).toContain('href={`/${locale}/skills?q=${encodeURIComponent(keyword)}`}');
    expect(skillDetailSource).toContain('rel="nofollow"');
  });

  it('keeps the representative skill detail page on shared breadcrumb and metadata contracts', () => {
    const skillDetailSource = readPageSource('./[locale]/skills/[owner]/[...repo].astro');

    expect(skillDetailSource).toContain('buildBreadcrumbTrail(');
    expect(skillDetailSource).toContain('activeBreadcrumb.jsonLd');
    expect(skillDetailSource).toContain('getSkillSeoLocaleGovernance(');
    expect(skillDetailSource).toContain('buildSkillIndexabilityAssessment(');
    expect(skillDetailSource).toContain('availableLocales={skillAvailableLocales}');
    expect(skillDetailSource).toContain('xDefaultLocale={skillXDefaultLocale}');
    expect(skillDetailSource).toContain('sourceEvidenceTitle');
    expect(skillDetailSource).toContain('customCanonical={canonicalSkillUrl}');
    expect(skillDetailSource).toContain('homepage: canonicalSkillUrl,');
    expect(skillDetailSource).not.toContain('const breadcrumbSchema = {');
    expect(skillDetailSource).not.toContain("metaDescription || t('Metadata.description')");
    expect(skillDetailSource).not.toContain("description || t('Skills.noResults')");
  });

  it('keeps touched public translation keys defined across all shipped locales', () => {
    const touchedSources = [
      readPageSource('../components/Header.astro'),
      readPageSource('../components/Footer.astro'),
      readPageSource('../layouts/Layout.astro'),
      readPageSource('./[locale]/index.astro'),
      readPageSource('./[locale]/collections/index.astro'),
      readPageSource('./[locale]/collections/[...slug].astro'),
    ];
    const keys = new Set(touchedSources.flatMap((source) => extractTranslationKeys(source)));

    for (const { locale, messages } of allLocaleMessages) {
      for (const key of keys) {
        const value = resolveMessageKey(messages, key);
        expect(typeof value, `${locale} is missing translation key ${key}`).toBe('string');
        expect(String(value).length, `${locale} has empty translation for ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps homepage positioned as a skills directory, not a workflow-query hub', () => {
    const zhHomeSource = readPageSource('../pages/[locale]/index.astro');

    expect(zhHomeSource).not.toContain('高意图自动化入口');
    expect(zhHomeSource).not.toContain('High-Intent Workflow Searches');
    expect(zhHomeSource).not.toContain('What automation scenarios does Killer-Skills support?');
    expect(zhHomeSource).not.toContain('Killer-Skills 适合哪些自动化场景？');
    expect(zhHomeSource).toContain("'Home.seoTitle'");
    expect(zhHomeSource).toContain("'Home.seoDescription'");
    // Verify the i18n values themselves carry the correct positioning
    expect(zh.Home.seoTitle).toContain('AI Agent Skills 开放目录');
    expect(zh.Home.seoDescription).toContain('开放 AI Agent Skills 目录');
  });

  it('keeps homepage locale copy focused on directory and installation entry', () => {
    expect(en.Home.heroBadge).toBe('The open directory and install entry for AI Agent Skills');
    expect(en.Home.heroDesc2).toBe(
      'Install reusable skills in Claude Code, Cursor, and Windsurf for coding, research, and creation.',
    );
    expect(en.Home.featuresSubtitle).toBe(
      'Browse reusable AI agent skills and install them in the right native format for your IDE.',
    );
    expect(en.Home.footerDesc).toBe(
      'Open-source directory and installation entry point for AI agent skills. Built for real developer work.',
    );

    expect(zh.Home.heroBadge).toBe('AI Agent Skills 的开放目录与安装入口');
    expect(zh.Home.heroDesc2).toBe('在 Claude Code、Cursor 和 Windsurf 中安装可复用技能，用于编程、研究与创作。');
    expect(zh.Home.featuresSubtitle).toBe('浏览可复用的 AI Agent 技能，并以 IDE 原生格式完成安装。');
    expect(zh.Home.footerDesc).toBe('面向 AI Agent 技能的开源目录与安装入口。为真实开发工作而生。');
  });

  it('keeps homepage FAQ focused on skills, install flow, and supported IDEs', () => {
    const homeSource = readPageSource('../pages/[locale]/index.astro');

    expect(homeSource).toContain("t('Home.faq3Q')");
    expect(homeSource).toContain("t('Home.faq2Q')");
    expect(homeSource).not.toContain('Why do these skills fit IDE workflows?');
    expect(homeSource).not.toContain('What if a workflow also needs external tools?');
    expect(homeSource).not.toContain('这些技能为什么适合放进 IDE？');
    expect(homeSource).not.toContain('如果任务还需要外部工具怎么办？');
  });

  it('keeps authority-surface inventory wired into the main recovery hubs', () => {
    const homeSource = readPageSource('../pages/[locale]/index.astro');
    const skillsSource = readPageSource('../pages/[locale]/skills/index.astro');
    const collectionsIndexSource = readPageSource('../pages/[locale]/collections/index.astro');
    const collectionsDetailSource = readPageSource('../pages/[locale]/collections/[...slug].astro');
    const solutionsSource = readPageSource('../pages/[locale]/solutions/index.astro');

    expect(homeSource).toContain('getAuthoritySurfaceEntries(');
    expect(homeSource).toContain("'collections-hub'");
    expect(homeSource).toContain("'collection-official-trusted-tools'");
    expect(homeSource).toContain("'docs-installation'");

    expect(skillsSource).toContain('getAuthoritySurfaceEntries(');
    expect(skillsSource).toContain("'collections-hub'");
    expect(skillsSource).toContain("'solution-agent-workflows'");

    expect(collectionsIndexSource).not.toContain('getAuthorityStrategy(');
    expect(collectionsIndexSource).toContain("'collection-official-trusted-tools'");
    expect(collectionsIndexSource).toContain("'skills-directory'");

    expect(collectionsDetailSource).toContain('getCollectionRecoveryPathEntries(');
    expect(collectionsDetailSource).toContain('getRelatedAuthorityCollectionEntries(');
    expect(collectionsDetailSource).toContain('featuredCollectionRecoveryPaths');
    expect(collectionsDetailSource).toContain('Recommended Pages');

    expect(solutionsSource).toContain('getAuthoritySurfaceEntries(');
    expect(solutionsSource).toContain("'collections-hub'");
    expect(solutionsSource).toContain("'blog-ide-comparison'");
  });

  it('does not render internal authority rationale fields on public pages', () => {
    const pageSources = [
      readPageSource('../pages/[locale]/index.astro'),
      readPageSource('../pages/[locale]/collections/index.astro'),
      readPageSource('../pages/[locale]/collections/[...slug].astro'),
      readPageSource('../pages/[locale]/solutions/index.astro'),
      readPageSource('../pages/[locale]/solutions/[topic].astro'),
    ];

    for (const source of pageSources) {
      expect(source).not.toContain('surface.rationale');
    }
  });

  it('does not ship internal authority strategy copy into public authority-surface data', () => {
    const authoritySurfaceSource = readPageSource('../lib/authority-surface-public-data.ts');
    const leakedPhrases = [
      ['自然流量恢复', '必', '须依赖更少、更强、带有一手判断的入口页'].join(''),
      '精选 collections 比全量 skill 列表拥有更清晰的主题边界',
      '更稳定的 canonical 信号',
      '这是工作流优先的合集，能解释相关 skills 为什么要放在一起',
      '这是平台型合集，面向产品生态里最清晰的需求簇之一',
      'first-party framing',
      'safer canonical signals',
      'mirror-site posture',
    ];

    for (const phrase of leakedPhrases) {
      expect(authoritySurfaceSource).not.toContain(phrase);
    }
  });

  it('keeps high-visibility public copy free of internal recovery jargon', () => {
    const auditedSources = [
      readPageSource('../pages/[locale]/collections/[...slug].astro'),
      readPageSource('../pages/[locale]/docs/[...slug].astro'),
      readPageSource('../pages/[locale]/skills/[owner]/[...repo].astro'),
      readRepoSource('src/content/collections/top-automation-mcp-servers.json'),
      readRepoSource('src/content/collections/top-cli-mcp-servers.json'),
      readRepoSource('src/content/collections/top-community-skills.json'),
    ].join('\n');

    const blockedPhrases = [
      'recovery surface',
      'recovery-focused authority queue',
      'authority queue',
      'first-party judgment surface',
      'first-party trust signals',
      'operators and crawlers alike',
      '恢复期 authority 队列',
      '恢复期承接页',
      '更适合作为恢复入口',
      'organic recovery',
    ];

    for (const phrase of blockedPhrases) {
      expect(auditedSources).not.toContain(phrase);
    }
  });

  it('keeps reusable public copy-boundary guardrails active across public trust surfaces', () => {
    const matches: string[] = [];

    for (const relativePath of collectPublicCopyBoundaryFiles()) {
      const source = readRepoSource(relativePath);

      for (const rule of PUBLIC_COPY_BOUNDARY_RULES) {
        if (rule.pattern.test(source)) {
          matches.push(`${relativePath}: ${rule.label}`);
        }
      }
    }

    expect(matches).toEqual([]);
  });

  it('keeps collection source copy free of internal editorial and chain-of-thought style phrasing', () => {
    const collectionFiles = collectRepoFilesByExtensions('src/content/collections', new Set(['.json']));
    const blockedPatterns = [
      /\bthis page should narrow the shortlist\b/i,
      /\bnext click\b/i,
      blockedRegex(['\\binstallation docs, CLI ', 'validation\\b']),
      /\binstallation-focused\b/i,
      /\binstallation-first\b/i,
      /\bvalidation checklist\b/i,
      /\brepeatable rollout\b/i,
      /\bcuration review\b/i,
      /\bcurated for\b/i,
      /\btraffic capture\b/i,
      /\bRoute users\b/i,
      /\bSend users\b/i,
      /\bEach entry should\b/i,
      /\bofficial trusted collection\b/i,
      /\bfor developers for\b/i,
      /\.\. Compare setup quality\b/i,
      /Killer-Skills\.\./,
      /documentação de instalação/,
      /документации по установке/,
      /CLI-проверке/,
      /caminhos de rollout/,
      /不应该/,
      /复核/,
      /重新定位/,
      /安装文档、CLI 验证/,
      /下一次点击/,
      /再确认/,
      /标准化/,
      /团队后续使用步骤/,
      /团队评估路径/,
      /回到官方可信合集/,
      /编辑审查/,
      /编辑部/,
      /团队推广给团队/,
      /发现流量/,
      /精选参考/,
      /把用户送进/,
      /保留或新增条目前，会验证/,
      /推广前快速验证/,
      /推广前完成验证/,
      /验证清单/,
      /关键验证步骤/,
      /\bStep\s+\d+\s*:/,
      /\b(?:Primary\s+)?Path\s+\d+\b/,
      /\binstall\s+checklist\b/i,
      /团队适配/,
      /比较\s+/,
      /安装清单/,
      /检查点/,
    ];
    const matches: string[] = [];

    for (const relativePath of collectionFiles) {
      const content = JSON.parse(readRepoSource(relativePath)) as unknown;
      const stringValues = collectStringLeafValues(content);

      for (const value of stringValues) {
        for (const pattern of blockedPatterns) {
          if (pattern.test(value)) {
            matches.push(`${relativePath}: ${pattern}`);
          }
        }
      }
    }

    expect(matches).toEqual([]);
  });

  it('keeps blog source copy free of internal reasoning and chain-of-thought phrasing', () => {
    const blogFiles = collectRepoFilesByExtensions('src/content/blog', new Set(['.md']));
    const blockedPatterns = [
      /\bchain[- ]?of[- ]?thought\b/i,
      /\bthinking process\b/i,
      /\binternal strategy\b/i,
      /\binternal rationale\b/i,
      /\brecovery surface\b/i,
      /\btraffic capture\b/i,
      /\bcapture demand\b/i,
    ];
    const matches: string[] = [];

    for (const relativePath of blogFiles) {
      const source = readRepoSource(relativePath);
      for (const pattern of blockedPatterns) {
        if (pattern.test(source)) {
          matches.push(`${relativePath}: ${pattern}`);
        }
      }
    }

    expect(matches).toEqual([]);
  });

  it('keeps collection SEO titles readable and free of hard-truncated endings', () => {
    const collectionFiles = collectRepoFilesByExtensions('src/content/collections', new Set(['.json']));
    const locales = ['ar', 'de', 'en', 'es', 'fr', 'ja', 'ko', 'pt', 'ru', 'zh'];
    const badTitleEndingPattern = /(?:\s\||-\s*$|\bfor|\bpara|\bpour|\bfür|\bde|\bof|\bwith|\band|\bor)$/i;
    const matches: string[] = [];

    for (const relativePath of collectionFiles) {
      const content = JSON.parse(readRepoSource(relativePath)) as { seoTitle?: Record<string, string> };

      for (const locale of locales) {
        const title = content.seoTitle?.[locale];
        if (!title) continue;
        const titleLength = [...title].length;

        if (titleLength < 20 || titleLength > 72 || badTitleEndingPattern.test(title)) {
          matches.push(`${relativePath} ${locale}: ${title}`);
        }
      }
    }

    expect(matches).toEqual([]);
  });

  it('keeps collection titles and descriptions written for people, not metadata templates', () => {
    const collectionFiles = collectRepoFilesByExtensions('src/content/collections', new Set(['.json']));
    const locales = ['ar', 'de', 'en', 'es', 'fr', 'ja', 'ko', 'pt', 'ru', 'zh'];
    const matches: string[] = [];

    for (const relativePath of collectionFiles) {
      const content = JSON.parse(readRepoSource(relativePath)) as {
        title?: Record<string, string>;
        description?: Record<string, string>;
        seoDescription?: Record<string, string>;
      };

      for (const locale of locales) {
        const title = content.title?.[locale] || '';
        const description = content.description?.[locale] || '';
        const seoDescription = content.seoDescription?.[locale] || '';

        if (/\|\s*(AI Agent Skills|Killer-Skills)\b/i.test(title)) {
          matches.push(`${relativePath} ${locale} visible title has SEO suffix`);
        }

        if (/Installable AI agent skills for/i.test(description) || /聚焦\s+开发者工作流自动化/.test(description)) {
          matches.push(`${relativePath} ${locale} description uses generated template copy`);
        }

        if (
          /\.?\s*Killer-Skills\.?$/i.test(seoDescription) ||
          /Installable AI agent skills for/i.test(seoDescription) ||
          /聚焦\s+开发者工作流自动化/.test(seoDescription) ||
          !/[.!?。]$/.test(seoDescription)
        ) {
          matches.push(`${relativePath} ${locale} seoDescription is low-quality`);
        }
      }
    }

    expect(matches).toEqual([]);
  });

  it('keeps homepage quick-start copy free of internal strategy phrasing', () => {
    const homeSource = readPageSource('../pages/[locale]/index.astro');
    const blockedPhrases = [
      'Trusted Entry Paths',
      '可信入口路径',
      'Start From Curated Paths, Not Raw Directory Browsing',
      '先从精选入口开始，而不是直接跳进原始目录',
      'Start With a Trusted Anchor',
      '先选可信起点',
      'Use the Scenario to Narrow the Choice',
      '按场景收口决策',
      'Turn Discovery Into Installation',
      '把发现推进成可执行安装',
      'repo comparison loop',
      'trusted starter collection',
    ];

    for (const phrase of blockedPhrases) {
      expect(homeSource).not.toContain(phrase);
    }
  });

  it('keeps the top authority collections and install docs on explicit proof-and-bridge layers', () => {
    const officialCollectionSource = readPageSource('../content/collections/top-official-mcp-servers.json');
    const workflowCollectionSource = readPageSource('../content/collections/top-workflow-mcp-servers.json');
    const collectionDetailSource = readPageSource('./[locale]/collections/[...slug].astro');
    const docsSource = readPageSource('./[locale]/docs/[...slug].astro');

    expect(officialCollectionSource).toContain('"editorial"');
    expect(officialCollectionSource).toContain('"trustSignals"');
    expect(officialCollectionSource).toContain('"reviewedAt"');
    expect(officialCollectionSource).toContain('/{locale}/docs/installation');

    expect(workflowCollectionSource).toContain('"groupingLogic"');
    expect(workflowCollectionSource).toContain('"executionExamples"');
    expect(workflowCollectionSource).toContain('"nextSteps"');

    expect(collectionDetailSource).toContain('editorialDecisionTracks');
    expect(collectionDetailSource).toContain('editorialExecutionExamples');
    expect(collectionDetailSource).toContain('editorialNextSteps');
    expect(collectionDetailSource).toContain('primaryEditorialNextStep');
    expect(collectionDetailSource).toContain('supportingEditorialNextSteps');
    expect(collectionDetailSource).toContain('Related Collections');

    expect(docsSource).toContain('installBridgeCards');
    expect(docsSource).toContain('installValidationSteps');
    expect(docsSource).toContain('getAuthoritySurfaceEntries(');
  });

  it('keeps evergreen blog counts aligned with current public totals', () => {
    const locales = ['ar', 'de', 'en', 'es', 'fr', 'ja', 'ko', 'pt', 'ru', 'zh'];
    const slugs = [
      'announcing-killer-skills',
      'best-ai-agent-skills-2026',
      'introducing-openclaw-autonomous-ai-agent',
      'official-ai-agent-skills-guide',
      'what-are-ai-agent-skills',
    ];
    const staleCountPatterns = [
      /15\+/,
      /over 15/i,
      /mehr als 15/i,
      /über 15/i,
      /más de 15/i,
      /plus de 15/i,
      /mais de 15/i,
      /15 多个/,
      /15以上/,
      /15개 이상의/,
      /более чем 15/i,
      /أكثر من 15/,
      /1,000/,
      /1\.000/,
      /1 000/,
      /1000/,
    ];

    for (const locale of locales) {
      for (const slug of slugs) {
        const source = readPageSource(`../content/blog/${locale}/${slug}.md`);

        for (const pattern of staleCountPatterns) {
          expect(source).not.toMatch(pattern);
        }
      }
    }
  });

  it('keeps template-generated MCP blog boilerplate out of public articles', () => {
    const slugs = [
      'claude-code-vs-cursor-mcp-comparison',
      'deploy-mcp-server-to-cloudflare-workers',
      'langchain-vs-mcp-ai-integration',
      'mcp-authentication-guide-secure-setup',
      'mcp-server-not-working-troubleshooting-guide',
      'mcp-server-security-best-practices',
      'mcp-vs-rest-api-comparison',
      'testing-mcp-servers-comprehensive-guide',
    ];
    const stalePatterns = [
      'This guide will walk you through everything you need to know.',
      'Start by exploring our collection of MCP servers and follow our installation guides.',
      'Yes, when properly configured with authentication and security best practices, MCP servers are suitable for production environments.',
      "Let's begin by understanding the fundamentals.",
      '**First Step**: Install the required dependencies',
      '**Issue 1**: Connection timeout',
      'By following this guide, you should now have a solid understanding of',
      '## Introduction',
      '## Prerequisites',
      'Before getting started, make sure you have:',
      '### What is MCP?',
      '### How do I get started with MCP?',
      '### Is MCP secure for production use?',
      '*Have questions? Join our community on Discord or check out our documentation for more resources.*',
      'MCP (Model Context Protocol) is an open protocol that enables AI applications to connect to external data sources and tools securely.',
      'Step-by-step tutorial on deploying your MCP server to Cloudflare Workers. Save costs, improve latency, and scale automatically with edge computing.',
      'A comprehensive comparison between Model Context Protocol (MCP) and traditional REST APIs. Learn when to use MCP servers vs REST endpoints for your AI agent applications.',
      'Learn how to properly configure authentication for your MCP servers. This guide covers API keys, OAuth, token-based auth, and best practices for securing your AI agent integrations.',
      'Having issues with your MCP server? This comprehensive troubleshooting guide covers common errors, connection problems, and step-by-step solutions to get your Model Context Protocol server working again.',
      'Learn various testing strategies for MCP servers including unit tests, integration tests, mocking, and CI/CD automation. Build reliable AI agent integrations.',
    ];

    for (const slug of slugs) {
      const source = readPageSource(`../content/blog/en/${slug}.md`);

      for (const pattern of stalePatterns) {
        expect(source).not.toContain(pattern);
      }
    }
  });

  it('keeps chinese MCP blog translations free of machine-generated boilerplate', () => {
    const slugs = [
      'claude-code-vs-cursor-mcp-comparison',
      'deploy-mcp-server-to-cloudflare-workers',
      'langchain-vs-mcp-ai-integration',
      'mcp-authentication-guide-secure-setup',
      'mcp-server-not-working-troubleshooting-guide',
      'mcp-server-security-best-practices',
      'mcp-vs-rest-api-comparison',
      'testing-mcp-servers-comprehensive-guide',
      'how-to-build-mcp-servers-with-agent-skills',
    ];
    const stalePatterns = [
      '本指南将指导您了解所需的所有知识。',
      '本指南将带您了解您需要知道的一切。',
      '本指南将带您了解所有需要知道的内容。',
      '本指南将指导您完成所需的所有步骤。',
      '让我们从理解基础开始。',
      '让我们从理解基础知识开始。',
      '让我们从了解基础开始。',
      '首先，探索我们的 MCP 服务器集合，并按照我们的安装指南进行操作。',
      '首先探索我们的 MCP 服务器集合并按照我们的安装指南操作。',
      '当正确配置了身份验证和安全最佳实践时，MCP 服务器适合生产环境。',
      '当根据身份验证和最佳安全实践正确配置时，MCP 服务器适用于生产环境。',
      '### 步骤指南',
      '### 分步指南',
      '### 常见问题和解决方案',
      '### 常见问题与解决方案',
      '## FAQ',
      '## 常见问题',
      '### 什么是MCP？',
      '### 什么是 MCP？',
      '### 如何开始使用MCP？',
      '### 如何开始使用 MCP？',
      '### MCP是否适合生产环境？',
      '### MCP 是否适合生产环境？',
      '* 有问题？加入我们的Discord社区或查看我们的文档以获取更多资源。',
      '* 有问题？加入我们的 Discord 社区或查看我们的文档以获取更多资源。',
      '*有疑问？请加入我们的 Discord 社区或查看我们的文档以获取更多资源。',
    ];

    for (const slug of slugs) {
      const source = readPageSource(`../content/blog/zh/${slug}.md`);

      for (const pattern of stalePatterns) {
        expect(source).not.toContain(pattern);
      }
    }
  });

  it('keeps major non-english MCP blog translations free of machine-generated boilerplate', () => {
    const localePatterns = [
      {
        locale: 'de',
        patterns: [
          'Dieser Leitfaden führt Sie durch alles, was Sie wissen müssen.',
          'Diese Anleitung führt Sie durch alles, was Sie wissen müssen.',
          'Lassen Sie uns mit dem Verständnis der Grundlagen beginnen.',
          'Beginnen Sie damit, unsere Sammlung von MCP-Servern zu erkunden und folgen Sie unseren Installationsanleitungen.',
          'Ja, wenn MCP-Server richtig konfiguriert sind',
          '## Einführung',
          '### Schritt-für-Schritt-Anleitung',
          '### Häufige Probleme und Lösungen',
          '## FAQ',
          '### Was ist MCP?',
          '### Wie komme ich mit MCP los?',
          '### Ist MCP für den Produktiveinsatz sicher?',
          '*Haben Sie Fragen? Treten Sie unserer Community auf Discord bei oder überprüfen Sie unsere Dokumentation',
        ],
      },
      {
        locale: 'es',
        patterns: [
          'Esta guía te guiará a través de todo lo que necesitas saber.',
          'Esta guía te llevará a través de todo lo que necesitas saber.',
          'Esta guía lo llevará a través de todo lo que necesita saber.',
          'En esta guía, aprenderá todo lo que necesita saber sobre la construcción de servidores MCP',
          '## Introducción: Crea tu primer servidor MCP',
          '### Paso 1: Instala la habilidad',
          '### Paso 2: Elige tu pila',
          '### Paso 3: Define tus herramientas',
          '### Paso 4: Implementa las mejores prácticas',
          'Comencemos por entender los conceptos básicos.',
          'Comience explorando nuestra colección de servidores MCP y siga nuestras guías de instalación.',
          'Sí, cuando se configura correctamente con autenticación',
          '## Introducción',
          '## Requisitos previos',
          'Antes de empezar, asegúrate de tener:',
          '- Comprensión básica de agentes de inteligencia artificial y LLMs',
          '- Conocimiento básico de agentes de inteligencia artificial y LLMs',
          '- Node.js o Python instalado en tu máquina',
          '- Acceso a tu editor de código preferido',
          '### Guía Paso a Paso',
          '### Problemas Comunes y Soluciones',
          '## Preguntas frecuentes',
          '### ¿Qué es MCP?',
          '### ¿Cómo comienzo con MCP?',
          '### ¿Cómo empezar con MCP?',
          '### ¿Es MCP seguro para uso en producción?',
          '* ¿Tiene preguntas? Únete a nuestra comunidad en Discord o consulta nuestra documentación',
          '* ¿Tienes preguntas? Únete a nuestra comunidad en Discord o consulta nuestra documentación',
        ],
      },
      {
        locale: 'ja',
        patterns: [
          'このガイドでは、必要なすべてのことを説明します。',
          'このガイドでは、MCPサーバーの構築方法について、プロトコルを理解することから最初のサーバーのデプロイまで、必要なすべてのことを学習します。',
          '## Why Use the mcp-builder Skill?',
          '## Getting Started: Build Your First MCP Server',
          '### Step 1: Install the Skill',
          '### Step 2: Choose Your Stack',
          '### Step 3: Define Your Tools',
          '### Step 4: Implement Best Practices',
          'The skill will be added to your `.claude/skills/` directory and automatically activated when Claude detects MCP server development tasks.',
          'The mcp-builder skill supports two primary stacks:',
          '基本を理解することから始めましょう。',
          'MCPサーバーのコレクションを調べ',
          'MCPサーバーは本番環境に適しています。',
          'Before getting started, make sure you have:',
          '### ステップバイステップガイド',
          '### 共通の問題と解決策',
          '## FAQ',
          '### MCPとは何か？',
          '### MCPを始めるにはどうすれば',
          '### MCPは本番環境',
          '*質問がある場合は',
          '* 質問がある場合は',
        ],
      },
      {
        locale: 'ru',
        patterns: [
          'Этот гид проведет вас через все, что вам нужно знать.',
          'Давайте начнем с понимания основ.',
          'Начните с изучения нашей коллекции серверов MCP',
          'серверы MCP подходят для производственных сред',
          '### Пошаговое Руководство',
          '### Распространенные Проблемы и Решения',
          '## FAQ',
          '### Что такое MCP?',
          '### Как начать',
          '### Подходит ли MCP для производственного использования?',
          '* У вас есть вопросы? Присоединяйтесь к нашему сообществу в Discord',
        ],
      },
      {
        locale: 'fr',
        patterns: [
          'Cette guide',
          'Ce guide vous guidera à travers tout ce que vous devez savoir.',
          '## Introduction',
          '## Prérequis',
          '### Guide étape par étape',
          '### Problèmes courants et solutions',
          '## FAQ',
          "### Qu'est-ce que MCP ?",
          '### Comment démarrer avec MCP',
          '### MCP est-il sécurisé pour une utilisation en production ?',
        ],
      },
      {
        locale: 'pt',
        patterns: [
          'Neste guia, você aprenderá tudo o que precisa saber sobre a construção de servidores MCP',
          '## Introdução: Construa Seu Primeiro Servidor MCP',
          '### Etapa 1: Instalar a Habilidade',
          '### Etapa 2: Escolha Sua Pilha',
          '### Etapa 3: Definir Ferramentas',
          '### Etapa 4: Implementar Melhores Práticas',
          '### O que é MCP?',
          '### O MCP é seguro para uso em produção?',
          '## FAQ',
        ],
      },
      {
        locale: 'ko',
        patterns: [
          '이 가이드에서는 MCP 서버 구축에 필요한 모든 것을 배울 수 있습니다.',
          '## MCP-빌더 スキルの 사용 이유',
          '## 시작하기: 첫 번째 MCP 서버 구축',
          '### 1단계: 스킬 설치',
          '### 2단계: 스택 선택',
          '### 3단계: 도구 정의',
          '### 4단계: 모범 사례 구현',
          '정적 타이핑은 런타임 전에 오류를 捕获합니다',
          '### 단계별 가이드',
          '## FAQ',
          '### MCP란 무엇인가요?',
          '### MCP를 시작하려면 어떻게 해야 하나요?',
          '### MCP는 프로덕션 사용에 안전한가요?',
          '이 가이드는 필요한 모든 것을 안내합니다',
          '기본 사항부터 이해해 봅시다',
          '시작하기 전에 다음을 준비하세요',
        ],
      },
      {
        locale: 'ar',
        patterns: [
          'في هذا الدليل، ستتعلم كل ما تحتاج إلى معرفته حول بناء خوادم MCP',
          '# Install the mcp-builder skill with one command',
          'هنا lý لماذا يهم MCP:',
          'xử lý الأخطاء',
          'ينشئ автоматически مجموعات اختبار لخادم MCP',
          '## البدء: إنشاء خادم MCP الأول',
          '### الخطوة 1: تثبيت المهارة',
          '### الخطوة 2: اختيار المكدس',
          '### الخطوة 3: تعريف أدواتك',
          '### الخطوة 4: تنفيذ أفضل الممارسات',
          'قبل البدء، تأكد من أن لديك:',
          '### دليل خطوة بخطوة',
          '## الأسئلة الشائعة',
          '### ما هو MCP?',
          '### كيف أبدأ باستخدام MCP?',
          '### هل MCP آمن للاستخدام في الإنتاج?',
          'سيرشدك هذا الدليل',
          'لنبدأ بفهم الأساسيات',
        ],
      },
    ];
    const slugs = [
      'claude-code-vs-cursor-mcp-comparison',
      'deploy-mcp-server-to-cloudflare-workers',
      'langchain-vs-mcp-ai-integration',
      'mcp-authentication-guide-secure-setup',
      'mcp-server-not-working-troubleshooting-guide',
      'mcp-server-security-best-practices',
      'mcp-vs-rest-api-comparison',
      'testing-mcp-servers-comprehensive-guide',
    ];

    for (const { locale, patterns } of localePatterns) {
      for (const slug of slugs) {
        const source = readPageSource(`../content/blog/${locale}/${slug}.md`);

        for (const pattern of patterns) {
          expect(source).not.toContain(pattern);
        }
      }
    }
  });

  it('keeps top-10 MCP integrations articles free of placeholder install commands', () => {
    const locales = ['ar', 'de', 'en', 'es', 'fr', 'ja', 'ko', 'pt', 'ru', 'zh'];
    const placeholderCommandPattern = /npx killer-skills add <[^>\n]+>(?:\/<[^>\n]+>)?/;

    for (const locale of locales) {
      const source = readPageSource(`../content/blog/${locale}/top-10-mcp-servers-2026.md`);
      expect(source).not.toMatch(placeholderCommandPattern);
    }
  });

  it('keeps the how-to-build MCP server article free of cross-locale template scaffolding', () => {
    const localePatterns = [
      {
        locale: 'en',
        patterns: [
          "In this guide, you'll learn everything you need to know about building MCP servers",
          '## Getting Started: Build Your First MCP Server',
          '### Step 1: Install the Skill',
          '### Step 2: Choose Your Stack',
          '### Step 3: Define Your Tools',
          '### Step 4: Implement Best Practices',
        ],
      },
      {
        locale: 'zh',
        patterns: [
          '在本指南中，您将学习关于构建 MCP 服务器所需的所有知识',
          '### 步骤 1：安装技能',
          '### 步骤 2：选择技术栈',
          '### 步骤 3：定义你的工具',
          '### 步骤 4：实施最佳实践',
        ],
      },
      {
        locale: 'de',
        patterns: [
          'In diesem Leitfaden erfahren Sie alles, was Sie wissen müssen, um MCP-Server zu erstellen',
          '### Schritt 1: Installieren Sie die Fähigkeit',
          '### Schritt 2: Wählen Sie Ihren Stack',
          '### Schritt 3: Definieren Sie Ihre Tools',
          '### Schritt 4: Implementieren Sie Best Practices',
          'Browse die offiziellen Skills',
        ],
      },
      {
        locale: 'es',
        patterns: [
          'En esta guía, aprenderá todo lo que necesita saber sobre la construcción de servidores MCP',
          '### Paso 1: Instala la habilidad',
          '### Paso 2: Elige tu pila',
          '### Paso 3: Define tus herramientas',
          '### Paso 4: Implementa las mejores prácticas',
        ],
      },
      {
        locale: 'fr',
        patterns: [
          'Dans ce guide, vous apprendrez tout ce que vous devez savoir sur la construction de serveurs MCP',
          '### Étape 1 : Installer la Compétence',
          '### Étape 2 : Choisissez Votre Stack',
          '### Étape 3 : Définissez Vos Outils',
          '### Étape 4 : Implémentez les Meilleures Pratiques',
          "Une prise en charge de haute qualité de l'SDK officiel de l'équipe MCP",
          "à propos d'écrire plus de code",
          'annuaire des skills Killer-Skills',
        ],
      },
      {
        locale: 'ja',
        patterns: [
          'このガイドでは、MCPサーバーの構築方法について、プロトコルを理解することから最初のサーバーのデプロイまで、必要なすべてのことを学習します。',
          '## Why Use the mcp-builder Skill?',
          '## Getting Started: Build Your First MCP Server',
          '### Step 1: Install the Skill',
          '### Step 2: Choose Your Stack',
          '### Step 3: Define Your Tools',
          '### Step 4: Implement Best Practices',
          'The skill will be added to your `.claude/skills/` directory and automatically activated when Claude detects MCP server development tasks.',
          'The mcp-builder skill supports two primary stacks:',
          'The **mcp-builder** スキルは、',
          '## キーデザインプリンシプル for MCPサーバー',
          'ペジネーション',
        ],
      },
      {
        locale: 'ko',
        patterns: [
          '이 가이드에서는 MCP 서버 구축에 필요한 모든 것을 배울 수 있습니다.',
          '## MCP-빌더 スキルの 사용 이유',
          '## 시작하기: 첫 번째 MCP 서버 구축',
          '### 1단계: 스킬 설치',
          '### 2단계: 스택 선택',
          '### 3단계: 도구 정의',
          '### 4단계: 모범 사례 구현',
          '정적 타이핑은 런타임 전에 오류를 捕获합니다',
        ],
      },
      {
        locale: 'pt',
        patterns: [
          'Neste guia, você aprenderá tudo o que precisa saber sobre a construção de servidores MCP',
          '### Etapa 1: Instalar a Habilidade',
          '### Etapa 2: Escolha Sua Pilha',
          '### Etapa 3: Definir Ferramentas',
          '### Etapa 4: Implementar Melhores Práticas',
        ],
      },
      {
        locale: 'ru',
        patterns: [
          'В этом руководстве вы узнаете всё, что вам нужно знать о создании серверов MCP',
          '### Шаг 1: Установка навыка',
          '### Шаг 2: Выбор стека',
          '### Шаг 3: Определение инструментов',
          '### Шаг 4: Реализация лучших практик',
          'для消费а агентами ИИ',
          'шаблоны.paginaciонных шаблонов',
          'поля, которые агенты benötigt',
          'Claude xửляет сложность',
          '# Install the mcp-builder skill with one command',
        ],
      },
      {
        locale: 'ar',
        patterns: [
          'في هذا الدليل، ستتعلم كل ما تحتاج إلى معرفته حول بناء خوادم MCP',
          '# Install the mcp-builder skill with one command',
          'هنا lý لماذا يهم MCP:',
          'xử lý الأخطاء',
          'ينشئ автоматически مجموعات اختبار لخادم MCP',
          '### الخطوة 1: تثبيت المهارة',
          '### الخطوة 2: اختيار المكدس',
          '### الخطوة 3: تعريف أدواتك',
          '### الخطوة 4: تنفيذ أفضل الممارسات',
        ],
      },
    ];

    for (const { locale, patterns } of localePatterns) {
      const source = readPageSource(`../content/blog/${locale}/how-to-build-mcp-servers-with-agent-skills.md`);

      for (const pattern of patterns) {
        expect(source).not.toContain(pattern);
      }
    }
  });

  it('points public GitHub references at the Killer-Skills repository', () => {
    const communitySource = readPageSource('./[locale]/community/index.astro');
    const privacySource = readPageSource('./[locale]/privacy/index.astro');
    const termsSource = readPageSource('./[locale]/terms/index.astro');
    const cookiesSource = readPageSource('./[locale]/cookies/index.astro');
    const homeSource = readPageSource('./[locale]/index.astro');

    expect(communitySource).toContain('asiawright1122-boop/Killer-AgentSkills');
    expect(communitySource).not.toContain('github.com/anthropics/skills');
    expect(privacySource).toContain('asiawright1122-boop/Killer-AgentSkills/issues');
    expect(termsSource).toContain('asiawright1122-boop/Killer-AgentSkills/issues');
    expect(cookiesSource).toContain('asiawright1122-boop/Killer-AgentSkills/issues');
    expect(homeSource).toContain('asiawright1122-boop/Killer-AgentSkills');
  });

  it('keeps skill detail source free of hardcoded MCP server SEO copy', () => {
    const skillDetailSource = readPageSource('./[locale]/skills/[owner]/[...repo].astro');

    expect(skillDetailSource).toContain("typedLocale === 'zh'");
    expect(skillDetailSource).not.toContain("'MCP server'");
    expect(skillDetailSource).not.toContain("'mcp server'");
    expect(skillDetailSource).not.toContain('MCP Server by');
  });

  it('keeps skill detail source free of internal review-flow and rollout phrasing', () => {
    const skillDetailSource = readPageSource('./[locale]/skills/[owner]/[...repo].astro');

    expect(skillDetailSource).not.toContain(blockedPhrase('Review', ' & Install'));
    expect(skillDetailSource).not.toContain(blockedPhrase('before ', 'rollout'));
    expect(skillDetailSource).not.toContain('tradeoffs');
    expect(skillDetailSource).not.toContain(blockedPhrase('Reviewed ', 'Landing Page'));
    expect(skillDetailSource).not.toContain(blockedPhrase('Reference', '-Only Page'));
    expect(skillDetailSource).not.toContain(blockedPhrase('Trusted ', 'Recheck'));
    expect(skillDetailSource).not.toContain('Cross-Check Against Trusted Picks');
    expect(skillDetailSource).not.toContain('Move To Workflow Collections For Team Rollout');
    expect(skillDetailSource).not.toContain('After The Review');
    expect(skillDetailSource).not.toContain(
      blockedPhrase('Decision ', 'support comes first. Repository text comes second.'),
    );
    expect(skillDetailSource).not.toContain('SEO_TITLE_VARIANT');
  });

  it('keeps high-priority collections free of mcp-first canonical slugs and titles', () => {
    const mcpUtilitiesSource = readPageSource('../content/collections/top-mcp-mcp-servers.json');
    const mcpFrameworksSource = readPageSource('../content/collections/top-mcp-server-mcp-servers.json');
    const mcp2026Source = readPageSource('../content/collections/top-mcp-servers-2026.json');
    const communityToolsSource = readPageSource('../content/collections/top-community-mcp-servers.json');

    expect(mcpUtilitiesSource).toContain('top-ai-agent-workflow-skills-integrations-utilities');
    expect(mcpUtilitiesSource).not.toContain('Top MCP Tools, Integrations, and Workflow Utilities');
    expect(mcpFrameworksSource).toContain('top-ai-agent-integration-frameworks-bridges-infra-tooling');
    expect(mcpFrameworksSource).not.toContain('Top MCP Server Frameworks, Bridges, and Infra Tooling');
    expect(mcp2026Source).toContain('top-ai-agent-workflow-skills-integrations-2026');
    expect(mcp2026Source).not.toContain('Top MCP Tools for AI Agent Workflows');
    expect(communityToolsSource).toContain('Community Skills & AI Utilities');
    expect(communityToolsSource).toContain('top-community-skills-ai-utilities');
    expect(communityToolsSource).not.toContain('Top Community MCP Tools and AI Utilities');
    expect(communityToolsSource).not.toContain('top-community-mcp-tools-ai-utilities');
    expect(communityToolsSource).not.toContain('community MCP tools');
    const aiAgentsSource = readPageSource('../content/collections/top-ai-agents-mcp-servers.json');
    const agenticAiSource = readPageSource('../content/collections/top-agentic-ai-mcp-servers.json');
    expect(aiAgentsSource).toContain('top-agentic-ai-platforms-orchestration-tools');
    expect(aiAgentsSource).toContain('top-ai-agent-platforms-orchestration-tools');
    expect(agenticAiSource).toContain('top-agentic-ai-platforms-orchestration-tools');
    expect(mcpFrameworksSource).not.toContain('protocol bridges');
    expect(mcpFrameworksSource).not.toContain('protocol compatibility');
  });

  it('keeps public collection links wired to canonical collection slugs', () => {
    const collectionsIndexSource = readPageSource('./[locale]/collections/index.astro');
    const collectionsSitemapSource = readPageSource('./sitemap-collections.xml.ts');
    const homeSource = readPageSource('./[locale]/index.astro');

    expect(collectionsIndexSource).toContain('getCanonicalCollections(');
    expect(collectionsIndexSource).toContain('getCollectionCanonicalSlug(col)');
    expect(collectionsIndexSource).toContain(
      'url: `https://killer-skills.com/${locale}/collections/${getCollectionCanonicalSlug(col)}`',
    );
    expect(collectionsIndexSource).toContain('const cleanSlug = getCollectionCanonicalSlug(col);');
    expect(collectionsIndexSource).not.toContain("col.id.replace(/\\.json$/, '')");

    expect(collectionsSitemapSource).toContain('getCanonicalCollections(');
    expect(collectionsSitemapSource).toContain('const canonicalSlug = getCollectionCanonicalSlug(col);');
    expect(collectionsSitemapSource).toContain('const pagePath = `/collections/${canonicalSlug}`;');
    expect(collectionsSitemapSource).not.toContain("const cleanSlug = col.id.replace(/\\.json$/, '')");

    expect(homeSource).toContain('const cleanSlug = getCollectionCanonicalSlug(col);');
    expect(homeSource).toContain('href={`/${locale}/collections/${cleanSlug}`}');
    expect(homeSource).not.toContain("col.id.replace(/\\.json$/, '')");

    const skillRelatedSource = readPageSource('../components/SkillRelated.astro');
    expect(skillRelatedSource).toContain('const cleanSlug = getCollectionCanonicalSlug(col);');
    expect(skillRelatedSource).toContain('href={`/${locale}/collections/${cleanSlug}`}');
    expect(skillRelatedSource).not.toContain("col.id.replace(/\\.json$/, '')");
  });

  it('keeps noindex solution locale variants out of the static sitemap', () => {
    const staticSitemapSource = readPageSource('./sitemap-static.xml.ts');

    expect(staticSitemapSource).toContain('getSolutionSeoEligibleLocales');
    expect(staticSitemapSource).toContain('getPreferredCanonicalLocale(page.locales)');
    expect(staticSitemapSource).toContain('buildHreflangLinks(page.path, [canonicalLocale])');
    expect(staticSitemapSource).not.toContain('...SOLUTION_INTENT_SLUGS.map((slug) => `/solutions/${slug}`)');
  });

  it('keeps robots.txt aligned with crawlable noindex and 410 cleanup signals', async () => {
    const mod = await import('../../src/pages/robots.txt');
    const response = await mod.GET({} as any);
    const body = await response.text();

    expect(body).toContain('Sitemap: https://killer-skills.com/sitemap.xml');
    expect(body).toContain('Search result/listing parameter pages are controlled by noindex headers/meta.');
    expect(body).toContain('Favorites and history pages are also crawlable so engines can observe page-level noindex.');
    expect(body).toContain('Invalid source-file and deep skill paths are allowed to crawl');
    expect(body).not.toContain('Disallow: /favorites');
    expect(body).not.toContain('Disallow: /history');
    expect(body).not.toContain('Disallow: /*/favorites');
    expect(body).not.toContain('Disallow: /*/history');
    expect(body).not.toContain('Disallow: *.md');
    expect(body).not.toContain('Disallow: /*?tag=');
    expect(body).not.toContain('Disallow: /*/skills/*/*/*/*/');
    expect(body).not.toContain('Host:');
    expect(body).not.toContain('LLMs-Txt:');
  });

  it('keeps solution detail pages on bounded skill queries for crawl stability', () => {
    const solutionDetailSource = readPageSource('../pages/[locale]/solutions/[topic].astro');

    expect(solutionDetailSource).toContain('SOLUTION_SKILL_SAMPLE_LIMIT');
    expect(solutionDetailSource).toContain('getLightweightSkillsTop(env, SOLUTION_SKILL_SAMPLE_LIMIT)');
    expect(solutionDetailSource).toContain('getLightweightSkillsByRefs(env, solutionExactSkillRefs)');
    expect(solutionDetailSource).not.toContain('getLightweightSkills(env)');
    expect(solutionDetailSource).not.toContain('isCrawlerRequest');
  });

  it('keeps collection pages on long-lived edge cache headers for crawl stability', () => {
    const collectionsIndexSource = readPageSource('../pages/[locale]/collections/index.astro');
    const collectionsDetailSource = readPageSource('../pages/[locale]/collections/[...slug].astro');
    const stableCacheHeader = "'Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400'";

    expect(collectionsIndexSource).toContain(stableCacheHeader);
    expect(collectionsDetailSource).toContain(stableCacheHeader);
  });

  it('renders only canonical solution URLs in the static sitemap XML', async () => {
    const { GET } = await import('../../src/pages/sitemap-static.xml');
    const response = await GET({} as Parameters<typeof GET>[0]);
    const xml = await response.text();
    const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]);
    const solutionLocs = locs.filter((loc) => /\/solutions(?:\/|$)/.test(new URL(loc).pathname));

    expect(solutionLocs).toEqual([
      'https://killer-skills.com/en/solutions',
      'https://killer-skills.com/en/solutions/workflow-automation',
      'https://killer-skills.com/en/solutions/process-automation',
      'https://killer-skills.com/en/solutions/document-automation',
      'https://killer-skills.com/en/solutions/browser-automation',
      'https://killer-skills.com/en/solutions/data-extraction',
      'https://killer-skills.com/en/solutions/agent-workflows',
    ]);
    expect(new Set(solutionLocs).size).toBe(solutionLocs.length);
  });

  it('keeps search-driven skill navigation wired to canonical skill href builders', () => {
    const commandBarSource = readPageSource('../components/CommandBar.tsx');
    const commandPaletteSource = readPageSource('../islands/CommandPalette.tsx');
    const searchBarSource = readPageSource('../islands/SearchBar.tsx');
    const favoritesManagerSource = readPageSource('../islands/FavoritesManager.tsx');
    const historyManagerSource = readPageSource('../islands/HistoryManager.tsx');

    expect(commandBarSource).toContain('window.location.href = result.href;');
    expect(commandBarSource).not.toContain(
      'window.location.href = `/${locale}/skills/${result.owner}/${result.repo}`;',
    );

    expect(commandPaletteSource).toContain('url: result.href,');
    expect(commandPaletteSource).not.toContain('url: `/${locale}/skills/${result.owner}/${result.repo}`,');

    expect(searchBarSource).toContain('href={r.href}');
    expect(searchBarSource).toContain('locale=${encodeURIComponent(locale)}');
    expect(searchBarSource).not.toContain('href={`/${locale}/skills/${r.owner}/${r.repo}`}');

    expect(favoritesManagerSource).toContain('buildLocalizedSkillPath(locale, owner, skill.routePath || repo)');
    expect(favoritesManagerSource).not.toContain('const detailUrl = `/${locale}/skills/${owner}/${repo}`;');

    expect(historyManagerSource).toContain('buildLocalizedSkillPath(locale, owner, item.routePath || repo)');
    expect(historyManagerSource).not.toContain('const detailUrl = `/${locale}/skills/${owner}/${repo}`;');
  });

  it('keeps the default skills landing heading aligned with installable skills framing', () => {
    const skillsIndexSource = readPageSource('./[locale]/skills/index.astro');

    // Title now comes from message files and matches the seoTitle key
    expect(skillsIndexSource).toContain("'Marketplace.seoTitle'");
    expect(skillsIndexSource).not.toContain("'AI Agent 技能目录'");
    expect(skillsIndexSource).not.toContain(": t('Common.explore')");
  });

  it('keeps Discord and X links consistent across public entry points', () => {
    const communitySource = readPageSource('./[locale]/community/index.astro');
    const footerSource = readPageSource('../components/Footer.astro');
    const homeSource = readPageSource('./[locale]/index.astro');
    const llmsFullSource = readPageSource('./llms-full.txt.ts');

    expect(communitySource).toContain('https://discord.com/invite/killer-skills');
    expect(homeSource).toContain('https://discord.com/invite/killer-skills');
    expect(llmsFullSource).toContain('https://discord.com/invite/killer-skills');

    expect(communitySource).toContain('https://x.com/killerskills');
    expect(footerSource).toContain('https://x.com/killerskills');
    expect(homeSource).toContain('https://x.com/killerskills');
    expect(llmsFullSource).toContain('https://x.com/killerskills');
  });

  it('keeps docs default content aligned with skills-first onboarding', () => {
    const docsSource = readPageSource('./[locale]/docs/[...slug].astro');

    expect(docsSource).toContain(
      'Welcome to the Killer-Skills docs. Learn how to install AI agent skills, configure your IDE, and bring reusable workflows into daily development.',
    );
    expect(zh.Docs.welcomeText).toContain(
      '欢迎来到 Killer-Skills 文档。这里会带你安装 AI Agent 技能、配置 IDE，并把可复用工作流带进日常开发。',
    );
    expect(docsSource).toContain('Start with Your First Skill');
    expect(zh.Docs.startFirstSkill).toContain('从第一个技能开始');
    expect(docsSource).toContain('npx killer-skills add owner/repo');
    expect(docsSource).not.toContain('build your own AI skills in minutes');
    expect(docsSource).not.toContain('npx killer-skills init my-new-skill');
  });

  it('keeps english and chinese integration cards free of generic tool-review copy', () => {
    expect(en.Integrations.cards.cursor.desc).toBe('Use reusable AI agent skills directly inside Cursor.');
    expect(en.Integrations.cards.windsurf.desc).toBe('Use reusable AI agent skills directly inside Windsurf.');
    expect(en.Integrations.cards.claude.desc).toBe('Use reusable AI agent skills directly inside Claude Code.');
    expect(en.Integrations.cards.goose.desc).toBe('Use reusable AI agent skills directly inside Goose.');

    expect(zh.Integrations.cards.cursor.desc).toBe('在 Cursor 里直接使用可复用 AI Agent 技能。');
    expect(zh.Integrations.cards.windsurf.desc).toBe('在 Windsurf 里直接使用可复用 AI Agent 技能。');
    expect(zh.Integrations.cards.claude.desc).toBe('在 Claude Code 里直接使用可复用 AI Agent 技能。');
    expect(zh.Integrations.cards.goose.desc).toBe('在 Goose 里直接使用可复用 AI Agent 技能。');
  });

  it('keeps high-priority ai-agent blog posts free of placeholder install commands', () => {
    const locales = ['ar', 'de', 'en', 'es', 'fr', 'ja', 'ko', 'pt', 'ru', 'zh'];
    const slugs = ['official-ai-agent-skills-guide', 'best-ai-agent-skills-2026', 'how-to-install-ai-agent-skills'];
    const placeholderInstallCommandPattern = /npx killer-skills add <[^>\n]+>/;

    for (const locale of locales) {
      for (const slug of slugs) {
        const source = readPageSource(`../content/blog/${locale}/${slug}.md`);
        expect(source).not.toMatch(placeholderInstallCommandPattern);
      }
    }
  });

  it('keeps high-priority ai-agent blog posts free of template pollution and wrong-locale links', () => {
    const enBestSkillsSource = readPageSource('../content/blog/en/best-ai-agent-skills-2026.md');
    const zhBestSkillsSource = readPageSource('../content/blog/zh/best-ai-agent-skills-2026.md');
    const deBestSkillsSource = readPageSource('../content/blog/de/best-ai-agent-skills-2026.md');
    const frBestSkillsSource = readPageSource('../content/blog/fr/best-ai-agent-skills-2026.md');
    const esBestSkillsSource = readPageSource('../content/blog/es/best-ai-agent-skills-2026.md');
    const jaBestSkillsSource = readPageSource('../content/blog/ja/best-ai-agent-skills-2026.md');
    const koBestSkillsSource = readPageSource('../content/blog/ko/best-ai-agent-skills-2026.md');
    const ptBestSkillsSource = readPageSource('../content/blog/pt/best-ai-agent-skills-2026.md');
    const ruBestSkillsSource = readPageSource('../content/blog/ru/best-ai-agent-skills-2026.md');
    const arBestSkillsSource = readPageSource('../content/blog/ar/best-ai-agent-skills-2026.md');
    const zhIntroOpenClawSource = readPageSource('../content/blog/zh/introducing-openclaw-autonomous-ai-agent.md');
    const arHowToInstallSource = readPageSource('../content/blog/ar/how-to-install-ai-agent-skills.md');
    const frHowToInstallSource = readPageSource('../content/blog/fr/how-to-install-ai-agent-skills.md');
    const esHowToInstallSource = readPageSource('../content/blog/es/how-to-install-ai-agent-skills.md');
    const deHowToInstallSource = readPageSource('../content/blog/de/how-to-install-ai-agent-skills.md');
    const zhHowToInstallSource = readPageSource('../content/blog/zh/how-to-install-ai-agent-skills.md');
    const ruHowToInstallSource = readPageSource('../content/blog/ru/how-to-install-ai-agent-skills.md');
    const koHowToInstallSource = readPageSource('../content/blog/ko/how-to-install-ai-agent-skills.md');
    const jaHowToInstallSource = readPageSource('../content/blog/ja/how-to-install-ai-agent-skills.md');
    const ptHowToInstallSource = readPageSource('../content/blog/pt/how-to-install-ai-agent-skills.md');
    const zhWhatAreSkillsSource = readPageSource('../content/blog/zh/what-are-ai-agent-skills.md');
    const deWhatAreSkillsSource = readPageSource('../content/blog/de/what-are-ai-agent-skills.md');
    const ruWhatAreSkillsSource = readPageSource('../content/blog/ru/what-are-ai-agent-skills.md');
    const frWhatAreSkillsSource = readPageSource('../content/blog/fr/what-are-ai-agent-skills.md');
    const esWhatAreSkillsSource = readPageSource('../content/blog/es/what-are-ai-agent-skills.md');
    const jaWhatAreSkillsSource = readPageSource('../content/blog/ja/what-are-ai-agent-skills.md');
    const koWhatAreSkillsSource = readPageSource('../content/blog/ko/what-are-ai-agent-skills.md');
    const ptWhatAreSkillsSource = readPageSource('../content/blog/pt/what-are-ai-agent-skills.md');
    const ruI18nWorkflowSource = readPageSource('../content/blog/ru/automating-i18n-workflows-with-llms.md');
    const arI18nWorkflowSource = readPageSource('../content/blog/ar/automating-i18n-workflows-with-llms.md');

    expect(enBestSkillsSource).not.toContain('ContinueWindsurf');
    expect(zhBestSkillsSource).not.toContain('ContinueWindsurf');
    expect(deBestSkillsSource).not.toContain('ContinueWindsurf');
    expect(frBestSkillsSource).not.toContain('ContinueWindsurf');
    expect(esBestSkillsSource).not.toContain('ContinueWindsurf');
    expect(jaBestSkillsSource).not.toContain('ContinueWindsurf');
    expect(koBestSkillsSource).not.toContain('ContinueWindsurf');
    expect(ptBestSkillsSource).not.toContain('ContinueWindsurf');
    expect(ruBestSkillsSource).not.toContain('ContinueWindsurf');
    expect(arBestSkillsSource).not.toContain('ContinueWindsurf');

    for (const source of [
      enBestSkillsSource,
      zhBestSkillsSource,
      deBestSkillsSource,
      frBestSkillsSource,
      esBestSkillsSource,
      jaBestSkillsSource,
      koBestSkillsSource,
      ptBestSkillsSource,
      ruBestSkillsSource,
      arBestSkillsSource,
    ]) {
      expect(source).not.toContain('npx killer-skills add blader/humanizer');
      expect(source).toContain('npx killer-skills add minhtungo/ai-agents-factory/humanizer');
    }

    expect(zhBestSkillsSource).toContain('](/zh/skills)');
    expect(zhBestSkillsSource).not.toContain('](/en/skills)');

    expect(deBestSkillsSource).toContain('](/de/skills)');
    expect(deBestSkillsSource).not.toContain('](/en/skills)');

    expect(frBestSkillsSource).toContain('](/fr/skills)');
    expect(frBestSkillsSource).not.toContain('](/en/skills)');

    expect(esBestSkillsSource).toContain('](/es/skills)');
    expect(esBestSkillsSource).not.toContain('](/en/skills)');

    expect(jaBestSkillsSource).toContain('](/ja/skills)');
    expect(jaBestSkillsSource).not.toContain('](/en/skills)');

    expect(koBestSkillsSource).toContain('](/ko/skills)');
    expect(koBestSkillsSource).not.toContain('](/en/skills)');

    expect(ptBestSkillsSource).toContain('](/pt/skills)');
    expect(ptBestSkillsSource).not.toContain('](/en/skills)');

    expect(ruBestSkillsSource).toContain('](/ru/skills)');
    expect(ruBestSkillsSource).not.toContain('](/en/skills)');

    expect(arBestSkillsSource).toContain('](/ar/skills)');
    expect(arBestSkillsSource).not.toContain('](/en/skills)');

    expect(ruI18nWorkflowSource).toContain('](/ru/)');
    expect(ruI18nWorkflowSource).not.toContain('](/en/)');

    expect(arI18nWorkflowSource).toContain('](/ar/)');
    expect(arI18nWorkflowSource).not.toContain('](/en/)');

    expect(arHowToInstallSource).toContain('](/ar/skills)');
    expect(arHowToInstallSource).not.toContain('](/en/skills)');

    expect(frHowToInstallSource).toContain('](/fr/skills)');
    expect(frHowToInstallSource).not.toContain('](/en/skills)');

    expect(esHowToInstallSource).toContain('](/es/skills)');
    expect(esHowToInstallSource).not.toContain('](/en/skills)');

    expect(deHowToInstallSource).toContain('](/de/skills)');
    expect(deHowToInstallSource).not.toContain('](/en/skills)');

    expect(zhHowToInstallSource).toContain('](/zh/skills)');
    expect(zhHowToInstallSource).not.toContain('](/en/skills)');

    expect(ruHowToInstallSource).toContain('](/ru/skills)');
    expect(ruHowToInstallSource).not.toContain('](/en/skills)');

    expect(koHowToInstallSource).toContain('](/ko/skills)');
    expect(koHowToInstallSource).not.toContain('](/en/skills)');

    expect(jaHowToInstallSource).toContain('](/ja/skills)');
    expect(jaHowToInstallSource).not.toContain('](/en/skills)');

    expect(ptHowToInstallSource).toContain('](/pt/skills)');
    expect(ptHowToInstallSource).not.toContain('](/en/skills)');

    expect(zhWhatAreSkillsSource).toContain('查看[技能目录](/zh/skills)');
    expect(zhWhatAreSkillsSource).not.toContain('查看[技能目录](/en/skills)');

    expect(deWhatAreSkillsSource).toContain('](/de/skills)');
    expect(deWhatAreSkillsSource).not.toContain('](/en/skills)');

    expect(ruWhatAreSkillsSource).toContain('](/ru/skills)');
    expect(ruWhatAreSkillsSource).not.toContain('](/en/skills)');
    expect(ruWhatAreSkillsSource).not.toContain('Here is the translated content in Chinese:');
    expect(ruWhatAreSkillsSource).not.toContain('## 它们实际上是如何工作的');
    expect(ruWhatAreSkillsSource).not.toContain('## Where skills run');
    expect(ruWhatAreSkillsSource).not.toContain('# Finding skills you can use today');
    expect(zhWhatAreSkillsSource).not.toContain('查看[技能目录](/en/skills)');

    expect(frWhatAreSkillsSource).toContain('](/fr/skills)');
    expect(frWhatAreSkillsSource).not.toContain('](/en/skills)');

    expect(esWhatAreSkillsSource).toContain('](/es/skills)');
    expect(esWhatAreSkillsSource).not.toContain('](/en/skills)');

    expect(jaWhatAreSkillsSource).toContain('](/ja/skills)');
    expect(jaWhatAreSkillsSource).not.toContain('](/en/skills)');
    expect(jaWhatAreSkillsSource).not.toContain('Of course. Here is the translated content in Simplified Chinese:');
    expect(jaWhatAreSkillsSource).not.toContain('## 它们实际上是如何工作的');

    expect(koWhatAreSkillsSource).toContain('](/ko/skills)');
    expect(koWhatAreSkillsSource).not.toContain('](/en/skills)');

    expect(ptWhatAreSkillsSource).toContain('](/pt/skills)');
    expect(ptWhatAreSkillsSource).not.toContain('](/en/skills)');
    expect(ptWhatAreSkillsSource).not.toContain('"translated_content":');

    expect(zhIntroOpenClawSource).toContain('/zh/blog/enhancing-openclaw-with-killer-skills-guide');
    expect(zhIntroOpenClawSource).not.toContain('/zh/blog/enhancing-ai-agents-with-killer-skills-guide');
  });

  it('keeps the latest blog cleanup slice free of mixed-language bleed and broken humanizer links', () => {
    const openClawLocales = ['ar', 'de', 'en', 'es', 'fr', 'ja', 'ko', 'pt', 'ru', 'zh'];
    const arIntroOpenClawSource = readPageSource('../content/blog/ar/introducing-openclaw-autonomous-ai-agent.md');
    const esOpenClawScenariosSource = readPageSource('../content/blog/es/openclaw-application-scenarios.md');
    const deThemeFactorySource = readPageSource('../content/blog/de/instant-branding-with-theme-factory-skills.md');
    const jaCanvasDesignSource = readPageSource('../content/blog/ja/professional-poster-design-with-canvas-skills.md');

    for (const locale of openClawLocales) {
      const source = readPageSource(`../content/blog/${locale}/openclaw-application-scenarios.md`);
      expect(source).not.toContain(`/${locale}/blog/humanizer-skill`);
      expect(source).toContain('/en/skills/minhtungo/ai-agents-factory/humanizer');
    }

    expect(arIntroOpenClawSource).not.toContain('## OpenClaw 的独特之处');
    expect(arIntroOpenClawSource).not.toContain('/zh/blog/claude-code-vs-cursor-vs-windsurf');
    expect(arIntroOpenClawSource).not.toContain('/zh/blog/what-are-ai-agent-skills');

    expect(esOpenClawScenariosSource).not.toContain('## 5. 动态学习与能力扩展');
    expect(esOpenClawScenariosSource).not.toContain('/zh/blog/introducing-openclaw-autonomous-ai-agent');
    expect(esOpenClawScenariosSource).not.toContain('/zh/blog/best-ai-agent-skills-2026');

    expect(deThemeFactorySource).not.toContain('## 探索入门主题');
    expect(deThemeFactorySource).not.toContain('## 如何使用 Theme-Factory 与 Killer-Skills');
    expect(deThemeFactorySource).not.toContain('## Conclusión');
    expect(deThemeFactorySource).not.toContain('/es/blog/que-son-las-habilidades-de-los-agentes-de-ia');
    expect(deThemeFactorySource).not.toContain('/es/blog/mejores-habilidades-de-agentes-de-ia-2026');

    expect(jaCanvasDesignSource).not.toContain('title: "Static Design Mastery: Canvas-Design Skill"');
    expect(jaCanvasDesignSource).not.toContain(
      'description: "Master static design with our proven canvas-design skill guide',
    );
    expect(jaCanvasDesignSource).not.toContain('## Was macht Canvas-Design anders?');
    expect(jaCanvasDesignSource).not.toContain('## Key Design Principles');
    expect(jaCanvasDesignSource).not.toContain('Of course. Here is the translated Markdown content:');
    expect(jaCanvasDesignSource).not.toContain('## Wie man es mit Killer-Skills verwendet');
    expect(jaCanvasDesignSource).not.toContain('## Conclusión');
    expect(jaCanvasDesignSource).not.toContain('https://killer-skills.com/es/skills/anthropics/skills/algorithmic-art');
    expect(jaCanvasDesignSource).not.toContain('/es/blog/what-are-ai-agent-skills');
    expect(jaCanvasDesignSource).not.toContain('/es/blog/best-ai-agent-skills-2026');
  });

  it('keeps the newly audited locale posts free of untranslated scaffolding and broken localized links', () => {
    const deBestSkillsSource = readPageSource('../content/blog/de/best-ai-agent-skills-2026.md');
    const esWhatAreSkillsSource = readPageSource('../content/blog/es/what-are-ai-agent-skills.md');
    const frWhatAreSkillsSource = readPageSource('../content/blog/fr/what-are-ai-agent-skills.md');
    const ptWhatAreSkillsSource = readPageSource('../content/blog/pt/what-are-ai-agent-skills.md');
    const arOpenClawGuideSource = readPageSource('../content/blog/ar/enhancing-openclaw-with-killer-skills-guide.md');
    const esGenerativeArtSource = readPageSource(
      '../content/blog/es/mastering-generative-art-with-claudecode-skills.md',
    );

    expect(deBestSkillsSource).toContain('## Was ist eine KI-Agenten-Fähigkeit?');
    expect(deBestSkillsSource).not.toContain('## What is an AI agent skill?');
    expect(deBestSkillsSource).not.toContain('## Automatización de documentos');
    expect(deBestSkillsSource).not.toContain('## Frontend and design');
    expect(deBestSkillsSource).not.toContain('## Developer tooling');
    expect(deBestSkillsSource).not.toContain("Here's the translated content in Simplified Chinese:");
    expect(deBestSkillsSource).not.toContain('## How to choose');
    expect(deBestSkillsSource).not.toContain('"name": "What are AI agent skills?"');

    expect(esWhatAreSkillsSource).toContain('description: Cómo escribir y ejecutar pruebas en este proyecto');
    expect(esWhatAreSkillsSource).toContain('# Pruebas en este proyecto');
    expect(esWhatAreSkillsSource).not.toContain('description: How to write and run tests in this project');
    expect(esWhatAreSkillsSource).not.toContain('# Testing in this project');
    expect(esWhatAreSkillsSource).not.toContain('We use Vitest. Run tests with `npm test`.');

    expect(frWhatAreSkillsSource).toContain('description: Comment écrire et exécuter les tests dans ce projet');
    expect(frWhatAreSkillsSource).toContain('# Les tests dans ce projet');
    expect(frWhatAreSkillsSource).not.toContain('description: How to write and run tests in this project');
    expect(frWhatAreSkillsSource).not.toContain('# Testing in this project');
    expect(frWhatAreSkillsSource).not.toContain('We use Vitest. Run tests with `npm test`.');

    expect(ptWhatAreSkillsSource).toContain('description: Como escrever e executar testes neste projeto');
    expect(ptWhatAreSkillsSource).toContain('# Testes neste projeto');
    expect(ptWhatAreSkillsSource).toContain('- **pdf** - Leia, combine, divida e crie PDFs');
    expect(ptWhatAreSkillsSource).not.toContain('description: How to write and run tests in this project');
    expect(ptWhatAreSkillsSource).not.toContain('testing/SKILL.md       # how to write tests in this project');
    expect(ptWhatAreSkillsSource).not.toContain('- **pdf** - Leia, mergulhe, divida e crie PDFs');

    expect(arOpenClawGuideSource).toContain('## الخطوة 2: تهيئة دعم OpenClaw داخل مشروعك');
    expect(arOpenClawGuideSource).toContain('npx killer-skills add anthropics/skills/frontend-design');
    expect(arOpenClawGuideSource).toContain('npx killer-skills add minhtungo/ai-agents-factory/humanizer');
    expect(arOpenClawGuideSource).not.toContain('## Step 2: Initialize OpenClaw Support in Your Project');
    expect(arOpenClawGuideSource).not.toContain('## Scenario-based Skill Packs');
    expect(arOpenClawGuideSource).not.toContain('適合');
    expect(arOpenClawGuideSource).not.toContain('اشترِ экземпляр OpenClaw');
    expect(arOpenClawGuideSource).not.toContain('npx killer-skills add frontend-design');
    expect(arOpenClawGuideSource).not.toContain('npx killer-skills add pdf');

    expect(esGenerativeArtSource).toContain('## Una mirada interna: la filosofía');
    expect(esGenerativeArtSource).toContain('## Cómo empezar');
    expect(esGenerativeArtSource).toContain('https://killer-skills.com/en/skills/anthropics/skills/canvas-design');
    expect(esGenerativeArtSource).toContain('/es/blog/what-are-ai-agent-skills');
    expect(esGenerativeArtSource).not.toContain('## A Look Under the Hood: The Philosophy');
    expect(esGenerativeArtSource).not.toContain('# Getting Started');
    expect(esGenerativeArtSource).not.toContain('## Step 1: Equip the Skill');
    expect(esGenerativeArtSource).not.toContain('## Step 2: Prompt Your Agent');
    expect(esGenerativeArtSource).not.toContain('## Step 3: Iterate and Explore');
    expect(esGenerativeArtSource).not.toContain('## Why This Matters for Developers');
    expect(esGenerativeArtSource).not.toContain(
      'https://killer-skills.com/es/habilidades/antropicas/habilidades/canvas-design',
    );
    expect(esGenerativeArtSource).not.toContain(
      'https://killer-skills.com/es/habilidades/antropicas/habilidades/theme-factory',
    );
    expect(esGenerativeArtSource).not.toContain('/es/blog/que-son-las-habilidades-de-agentes-de-ia');
    expect(esGenerativeArtSource).not.toContain('/es/blog/mejores-habilidades-de-agentes-de-ia-2026');
  });

  it('keeps authored public URLs free of trailing-slash regressions and query-string leaks', () => {
    const auditedFiles = [
      ...collectRepoFiles('src/content'),
      ...collectRepoFiles('src/pages'),
      ...collectRepoFiles('src/components'),
      ...collectRepoFiles('src/layouts'),
      ...collectRepoFiles('docs'),
    ];
    const trailingSlashMatches: string[] = [];
    const queryMatches: Array<{ file: string; url: string }> = [];

    for (const relativePath of auditedFiles) {
      const source = readRepoSource(relativePath);

      for (const match of source.matchAll(SITE_URL_TRAILING_SLASH_PATTERN)) {
        trailingSlashMatches.push(`${relativePath}: ${match[0]}`);
      }

      for (const match of source.matchAll(SITE_URL_QUERY_PATTERN)) {
        queryMatches.push({ file: relativePath, url: match[0] });
      }
    }

    expect(trailingSlashMatches).toEqual([]);
    expect(queryMatches).toEqual([
      {
        file: 'src/pages/[locale]/categories/index.astro',
        url: 'https://killer-skills.com/${locale}/skills?category=${cat.id}',
      },
      {
        // Existing authored homepage URL (kept for backwards compatibility
        // with prior structured-data shape).
        file: 'src/pages/[locale]/index.astro',
        url: 'https://killer-skills.com/${locale}/skills?q={search_term_string}',
      },
      {
        // WebSite JSON-LD SearchAction urlTemplate (sitelinks search box).
        // Google requires an absolute URL here, so we cannot collapse it to a
        // relative path. Tracked separately to make accidental changes loud.
        file: 'src/pages/[locale]/index.astro',
        url: 'https://killer-skills.com/${locale}/skills?q={search_term_string}',
      },
      {
        // SoftwareApplication.installUrl emitted from skill detail JSON-LD.
        // Points users at the CLI install entry; canonical and intentional.
        file: 'src/pages/[locale]/skills/[owner]/[...repo].astro',
        url: 'https://killer-skills.com/en/cli?install=${encodeURIComponent(schemaInstallPath',
      },
      {
        file: 'src/pages/[locale]/skills/index.astro',
        url: 'https://killer-skills.com/${locale}/skills?${serialized}',
      },
      {
        // Badge API query parameter for GitHub README embedding.
        // Intentional: shields.io-style badge endpoint uses ?type= to select badge variant.
        file: 'src/pages/api/badge.ts',
        url: 'https://killer-skills.com/api/badge?type=skills',
      },
    ]);
  });

  it('keeps hardcoded public skill links aligned with locale suppression governance', () => {
    const auditedFiles = [
      ...collectRepoFiles('src/content'),
      ...collectRepoFiles('src/pages'),
      ...collectRepoFiles('src/components'),
      ...collectRepoFiles('src/layouts'),
    ];
    const mismatches: string[] = [];

    for (const relativePath of auditedFiles) {
      const source = readRepoSource(relativePath);

      for (const match of source.matchAll(HARDCODED_SKILL_LINK_PATTERN)) {
        const actualLocale = match[1];
        const owner = decodeURIComponent(match[2]);
        const routePath = match[3]
          .split('/')
          .map((segment) => decodeURIComponent(segment))
          .join('/');
        const expectedLocale = resolveSkillDetailLocale(owner, routePath, actualLocale);

        if (actualLocale !== expectedLocale) {
          mismatches.push(
            `${relativePath}: /${actualLocale}/skills/${owner}/${routePath} -> expected /${expectedLocale}/`,
          );
        }
      }
    }

    expect(mismatches).toEqual([]);
  });
});
