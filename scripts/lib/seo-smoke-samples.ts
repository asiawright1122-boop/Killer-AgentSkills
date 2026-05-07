import { buildLocalizedSkillPath, type SitemapSkillEntry } from '../../src/lib/skill-route-paths';
import { isSitemapSkillBlocked, type CompiledSitemapBlocklist } from '../../src/lib/sitemap-blocklist';

export const DEFAULT_LOCALE_PROBE_ORDER = ['fr', 'de', 'es', 'ja', 'ko', 'pt', 'ru', 'ar', 'zh'] as const;

export type SkillLocaleGovernanceRecord = {
  owner?: string;
  repo?: string;
  routePath?: string;
  canonicalLocale?: string | null;
  publishedLocales?: string[];
};

export type SingleRouteRepoRedirectSample = {
  sourcePath: string;
  expectedPath: string;
  owner: string;
  repo: string;
  routePath: string;
};

export type SuppressedLocaleRedirectSample = {
  sourcePath: string;
  expectedPath: string;
  owner: string;
  routePath: string;
  requestedLocale: string;
  canonicalLocale: string;
};

export type BlocklistedSkillSample = {
  sourcePath: string;
  owner: string;
  routePath: string;
};

function normalizeLocale(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeSkillKey(owner: string, routePath: string): string {
  return `${owner.trim().toLowerCase()}/${routePath.trim().toLowerCase()}`;
}

export function buildRepoRootPath(locale: string, owner: string, repo: string): string {
  return `/${locale}/skills/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

export function readRedirectPathname(location: string, siteOrigin = 'https://killer-skills.com'): string {
  if (!location) return '';
  if (location.startsWith('http://') || location.startsWith('https://')) {
    return new URL(location).pathname;
  }

  return new URL(location, siteOrigin).pathname;
}

export function pickSingleRouteRepoRedirectSample(
  sitemapSkills: SitemapSkillEntry[],
  blocklist: CompiledSitemapBlocklist | null,
): SingleRouteRepoRedirectSample | null {
  const byRepo = new Map<string, Array<{ owner: string; repo: string; routePath: string }>>();

  for (const skill of sitemapSkills) {
    if (blocklist && isSitemapSkillBlocked(skill.owner, skill.routePath, blocklist)) continue;
    const segments = skill.routePath.split('/').filter(Boolean);
    if (segments.length < 2) continue;

    const repoKey = `${skill.owner.toLowerCase()}/${skill.repo.toLowerCase()}`;
    const current = byRepo.get(repoKey) || [];
    current.push({ owner: skill.owner, repo: skill.repo, routePath: skill.routePath });
    byRepo.set(repoKey, current);
  }

  for (const routes of byRepo.values()) {
    if (routes.length !== 1) continue;
    const route = routes[0];
    return {
      sourcePath: buildRepoRootPath('en', route.owner, route.repo),
      expectedPath: buildLocalizedSkillPath('en', route.owner, route.routePath),
      owner: route.owner,
      repo: route.repo,
      routePath: route.routePath,
    };
  }

  return null;
}

export function pickSuppressedLocaleRedirectSample(
  sitemapSkills: SitemapSkillEntry[],
  governanceRows: SkillLocaleGovernanceRecord[],
  blocklist: CompiledSitemapBlocklist | null,
  localeProbeOrder: readonly string[] = DEFAULT_LOCALE_PROBE_ORDER,
): SuppressedLocaleRedirectSample | null {
  const publicRouteKeys = new Set(
    sitemapSkills
      .filter((skill) => !blocklist || !isSitemapSkillBlocked(skill.owner, skill.routePath, blocklist))
      .map((skill) => normalizeSkillKey(skill.owner, skill.routePath)),
  );

  for (const row of governanceRows) {
    const owner = String(row.owner || '').trim();
    const routePath = String(row.routePath || '').trim();
    const canonicalLocale = normalizeLocale(row.canonicalLocale);
    const publishedLocales = Array.isArray(row.publishedLocales) ? row.publishedLocales.map(normalizeLocale).filter(Boolean) : [];
    if (!owner || !routePath || !canonicalLocale) continue;
    if (blocklist && isSitemapSkillBlocked(owner, routePath, blocklist)) continue;
    if (!publicRouteKeys.has(normalizeSkillKey(owner, routePath))) continue;

    const requestedLocale = localeProbeOrder.find(
      (locale) => locale !== canonicalLocale && !publishedLocales.includes(locale),
    );
    if (!requestedLocale) continue;

    return {
      sourcePath: buildLocalizedSkillPath(requestedLocale, owner, routePath),
      expectedPath: buildLocalizedSkillPath(canonicalLocale, owner, routePath),
      owner,
      routePath,
      requestedLocale,
      canonicalLocale,
    };
  }

  return null;
}

export function pickBlocklistedSkillSample(
  blocklist: CompiledSitemapBlocklist | null,
  sitemapSkills: SitemapSkillEntry[] = [],
): BlocklistedSkillSample | null {
  if (!blocklist || blocklist.exactKeys.size === 0) return null;

  const sitemapRouteKeys = new Set(sitemapSkills.map((skill) => normalizeSkillKey(skill.owner, skill.routePath)));
  const exactKey = Array.from(blocklist.exactKeys.values()).find(
    (key) => key.split('/').length >= 3 && sitemapRouteKeys.has(key),
  );
  if (!exactKey) return null;

  const [owner, ...routeParts] = exactKey.split('/');
  const routePath = routeParts.join('/');
  if (!owner || !routePath) return null;

  return {
    sourcePath: buildLocalizedSkillPath('en', owner, routePath),
    owner,
    routePath,
  };
}
