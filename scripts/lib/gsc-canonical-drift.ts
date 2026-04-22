import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parseGscCsv, type GscRow } from '../../src/lib/gsc-report';
import { resolveCollectionBySlug, type getCollectionCanonicalSlug } from '../../src/lib/collection-slugs';
import { compileSitemapBlocklist, isSitemapSkillBlocked, type CompiledSitemapBlocklist } from '../../src/lib/sitemap-blocklist';

export type CanonicalSkillRecord = {
  owner: string;
  repo: string;
  routePath: string;
  updatedAt?: string;
};

export type CollectionRecord = {
  id: string;
  data?: {
    canonicalSlug?: string;
    legacySlugs?: string[];
  };
};

export type SkillLocaleGovernanceRecord = {
  owner?: string;
  routePath?: string;
  eligibleLocales?: string[];
  canonicalLocale?: string | null;
};

export type GscCanonicalDriftKind =
  | 'canonical_keep'
  | 'docs_legacy_slug'
  | 'legacy_trailing_slash'
  | 'collection_legacy_slug'
  | 'skill_noncanonical_locale'
  | 'skill_repo_root_single_target'
  | 'skill_repo_root_multi_target'
  | 'skill_blocklisted'
  | 'skill_missing_or_unpublished'
  | 'skill_source_file_path'
  | 'skill_route_mismatch_single_target'
  | 'skill_route_mismatch_multi_target'
  | 'listing_parameter_page'
  | 'unknown';

export type GscCanonicalDriftAction = 'keep' | 'canonicalize' | 'keep410' | 'noindex' | 'investigate';

export type GscCanonicalDriftRow = GscRow & {
  url: string;
  kind: GscCanonicalDriftKind;
  action: GscCanonicalDriftAction;
  locale: string | null;
  section: string | null;
  targetUrl: string | null;
  reason: string;
  signals: string[];
};

export type GscCanonicalDriftSummaryBucket = {
  kind: GscCanonicalDriftKind;
  action: GscCanonicalDriftAction;
  count: number;
  clicks: number;
  impressions: number;
  examples: string[];
};

export type GscCanonicalDriftSummary = {
  totalRows: number;
  snapshotLabel: string;
  sourceCsvPath: string;
  actionSummary: Array<{ action: GscCanonicalDriftAction; count: number; clicks: number; impressions: number }>;
  kindSummary: GscCanonicalDriftSummaryBucket[];
  topRows: GscCanonicalDriftRow[];
};

type GovernanceEntry = {
  eligibleLocales: string[];
  canonicalLocale: string | null;
};

export type GscCanonicalDriftContext = {
  exactSkillMap: Map<string, CanonicalSkillRecord>;
  repoSkillMap: Map<string, CanonicalSkillRecord[]>;
  governanceMap: Map<string, GovernanceEntry>;
  blocklist: CompiledSitemapBlocklist;
  collections: CollectionRecord[];
};

const FILE_LIKE_SEGMENT_REGEX = /\.(md|markdown|txt|json|ya?ml|toml|js|jsx|ts|tsx|py|rb|go|rs|java|kt|php|html|css|scss|xml)$/i;
const ROOT_SECTION_FOLLOWERS = new Set(['blog', 'docs', 'collections', 'skills']);
const LEGACY_DOC_PATH_REDIRECTS = new Map<string, string>([['development/create-skill', 'creating-skills']]);

function normalizeKeyPart(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeLocale(value: string | null): string | null {
  if (!value) return null;
  const locale = value.trim().toLowerCase();
  return locale || null;
}

function normalizeSkillKey(owner: string, routePath: string): string {
  return `${normalizeKeyPart(owner)}/${normalizeKeyPart(routePath)}`;
}

function normalizeRepoKey(owner: string, repo: string): string {
  return `${normalizeKeyPart(owner)}/${normalizeKeyPart(repo)}`;
}

function removeTrailingSlash(pathname: string): string {
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/, '') || '/';
}

function buildSiteUrl(locale: string | null, section: string, tail: string, search = ''): string {
  const segments = ['https://killer-skills.com'];
  if (locale) segments.push(locale);
  segments.push(section);
  if (tail) segments.push(...tail.split('/').filter(Boolean));
  return `${segments.join('/')}${search}`;
}

function resolveGovernedLocale(governance: GovernanceEntry | undefined, requestedLocale: string | null): string | null {
  if (!requestedLocale) return governance?.canonicalLocale || null;
  if (!governance) return requestedLocale;
  if (governance.eligibleLocales.includes(requestedLocale)) return requestedLocale;
  return governance.canonicalLocale || requestedLocale;
}

function looksLikeSourceFilePath(routeSegments: string[]): boolean {
  if (routeSegments.length === 0) return false;
  return routeSegments.some((segment) => FILE_LIKE_SEGMENT_REGEX.test(segment));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function safeDecodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function buildGscCanonicalDriftContext(input: {
  skills: CanonicalSkillRecord[];
  localeGovernanceRecords?: SkillLocaleGovernanceRecord[];
  blocklistData?: unknown;
  collections?: CollectionRecord[];
}): GscCanonicalDriftContext {
  const exactSkillMap = new Map<string, CanonicalSkillRecord>();
  const repoSkillMap = new Map<string, CanonicalSkillRecord[]>();

  for (const skill of input.skills) {
    const owner = String(skill.owner || '').trim();
    const repo = String(skill.repo || '').trim();
    const routePath = String(skill.routePath || '').trim();
    if (!owner || !repo || !routePath) continue;

    exactSkillMap.set(normalizeSkillKey(owner, routePath), { owner, repo, routePath, updatedAt: skill.updatedAt });

    const repoKey = normalizeRepoKey(owner, repo);
    const current = repoSkillMap.get(repoKey) || [];
    current.push({ owner, repo, routePath, updatedAt: skill.updatedAt });
    repoSkillMap.set(repoKey, current);
  }

  const governanceMap = new Map<string, GovernanceEntry>();
  for (const record of input.localeGovernanceRecords || []) {
    const owner = String(record.owner || '').trim();
    const routePath = String(record.routePath || '').trim();
    if (!owner || !routePath) continue;

    const eligibleLocales = Array.isArray(record.eligibleLocales)
      ? record.eligibleLocales
          .map((locale) => normalizeLocale(typeof locale === 'string' ? locale : null))
          .filter((locale): locale is string => Boolean(locale))
      : [];

    governanceMap.set(normalizeSkillKey(owner, routePath), {
      eligibleLocales,
      canonicalLocale: normalizeLocale(typeof record.canonicalLocale === 'string' ? record.canonicalLocale : null),
    });
  }

  return {
    exactSkillMap,
    repoSkillMap,
    governanceMap,
    blocklist: compileSitemapBlocklist(input.blocklistData || {}),
    collections: input.collections || [],
  };
}

export function classifyGscPageUrl(entity: string, metrics: GscRow, context: GscCanonicalDriftContext): GscCanonicalDriftRow {
  let parsed: URL;
  try {
    parsed = new URL(entity);
  } catch {
    return {
      ...metrics,
      url: entity,
      kind: 'unknown',
      action: 'investigate',
      locale: null,
      section: null,
      targetUrl: null,
      reason: 'Entity is not a valid absolute URL.',
      signals: [],
    };
  }

  const pathname = parsed.pathname;
  const trimmedPathname = removeTrailingSlash(pathname);
  const hasTrailingSlash = pathname.length > 1 && pathname !== trimmedPathname;
  const segments = trimmedPathname.split('/').filter(Boolean);
  const locale = normalizeLocale(segments[0] || null);
  const section = segments[1] || null;
  const search = parsed.search || '';

  const baseResult = {
    ...metrics,
    url: entity,
    locale,
    section,
  };

  if (search && section === 'skills' && segments.length === 2) {
    return {
      ...baseResult,
      kind: 'listing_parameter_page',
      action: 'noindex',
      targetUrl: buildSiteUrl(locale, 'skills', ''),
      reason: 'Parameterized skills listing URL should stay noindex and canonicalize to the clean listing.',
      signals: uniqueStrings([search]),
    };
  }

  if (section === 'collections') {
    const slug = segments.slice(2).join('/');
    const resolved = resolveCollectionBySlug(context.collections, slug);
    if (resolved && !resolved.isCanonical) {
      return {
        ...baseResult,
        kind: 'collection_legacy_slug',
        action: 'canonicalize',
        targetUrl: buildSiteUrl(locale, 'collections', resolved.canonicalSlug),
        reason: 'Collection page uses a legacy slug and should redirect to the canonical collection URL.',
        signals: uniqueStrings([slug, hasTrailingSlash ? 'trailing_slash' : '']),
      };
    }

    if (hasTrailingSlash) {
      return {
        ...baseResult,
        kind: 'legacy_trailing_slash',
        action: 'canonicalize',
        targetUrl: `${buildSiteUrl(locale, 'collections', slug)}${search}`,
        reason: 'Collection URL has a historical trailing slash variant.',
        signals: ['trailing_slash'],
      };
    }

    return {
      ...baseResult,
      kind: 'canonical_keep',
      action: 'keep',
      targetUrl: null,
      reason: 'Collection URL already matches the current canonical pattern.',
      signals: [],
    };
  }

  if (section === 'docs') {
    const slug = segments
      .slice(2)
      .map((segment) => safeDecodePathSegment(segment).trim())
      .filter(Boolean)
      .join('/');
    const canonicalSlug = LEGACY_DOC_PATH_REDIRECTS.get(slug.toLowerCase());
    if (canonicalSlug) {
      return {
        ...baseResult,
        kind: 'docs_legacy_slug',
        action: 'canonicalize',
        targetUrl: buildSiteUrl(locale, 'docs', canonicalSlug),
        reason: 'Docs page uses a legacy slug and should redirect to the canonical docs URL.',
        signals: uniqueStrings([slug, hasTrailingSlash ? 'trailing_slash' : '']),
      };
    }
  }

  if (section === 'skills') {
    const owner = segments[2] || '';
    const routeSegments = segments.slice(3);
    const routePath = routeSegments.join('/');

    if (!owner && search) {
      return {
        ...baseResult,
        kind: 'listing_parameter_page',
        action: 'noindex',
        targetUrl: buildSiteUrl(locale, 'skills', ''),
        reason: 'Parameterized skills listing URL should stay noindex and canonicalize to the clean listing.',
        signals: uniqueStrings([search]),
      };
    }

    if (!owner || routeSegments.length === 0) {
      return {
        ...baseResult,
        kind: 'unknown',
        action: 'investigate',
        targetUrl: null,
        reason: 'Skills URL is missing owner or route segments.',
        signals: [],
      };
    }

    if (looksLikeSourceFilePath(routeSegments)) {
      return {
        ...baseResult,
        kind: 'skill_source_file_path',
        action: 'keep410',
        targetUrl: null,
        reason: 'URL points at a source-file-like path rather than a public skill route.',
        signals: uniqueStrings(routeSegments.filter((segment) => FILE_LIKE_SEGMENT_REGEX.test(segment))),
      };
    }

    const exactKey = normalizeSkillKey(owner, routePath);
    const exactSkill = context.exactSkillMap.get(exactKey);
    if (exactSkill) {
      const governedLocale = resolveGovernedLocale(context.governanceMap.get(exactKey), locale);
      if (governedLocale && locale && governedLocale !== locale) {
        return {
          ...baseResult,
          kind: 'skill_noncanonical_locale',
          action: 'canonicalize',
          targetUrl: buildSiteUrl(governedLocale, 'skills', `${owner}/${exactSkill.routePath}`),
          reason: 'Skill route exists, but the locale variant is suppressed and should canonicalize to the governed locale.',
          signals: uniqueStrings([`requested:${locale}`, `canonical:${governedLocale}`]),
        };
      }

      if (hasTrailingSlash) {
        return {
          ...baseResult,
          kind: 'legacy_trailing_slash',
          action: 'canonicalize',
          targetUrl: `${buildSiteUrl(locale, 'skills', `${owner}/${exactSkill.routePath}`)}${search}`,
          reason: 'Skill detail URL has a historical trailing slash variant.',
          signals: ['trailing_slash'],
        };
      }

      return {
        ...baseResult,
        kind: 'canonical_keep',
        action: 'keep',
        targetUrl: null,
        reason: 'Skill URL already matches the current canonical route and locale contract.',
        signals: [],
      };
    }

    if (isSitemapSkillBlocked(owner, routePath, context.blocklist)) {
      return {
        ...baseResult,
        kind: 'skill_blocklisted',
        action: 'keep410',
        targetUrl: null,
        reason: 'Skill path is blocklisted or repo-suppressed and should remain out of the public index.',
        signals: ['blocklisted'],
      };
    }

    const repo = routeSegments[0];
    const repoEntries = context.repoSkillMap.get(normalizeRepoKey(owner, repo)) || [];
    const exactRepoBlocked = isSitemapSkillBlocked(owner, repo, context.blocklist);
    if (routeSegments.length === 1) {
      if (exactRepoBlocked) {
        return {
          ...baseResult,
          kind: 'skill_blocklisted',
          action: 'keep410',
          targetUrl: null,
          reason: 'Repo-root skill URL is blocklisted and should stay removed.',
          signals: ['repo_root', 'blocklisted'],
        };
      }

      if (repoEntries.length === 1) {
        const target = repoEntries[0];
        const governedLocale = resolveGovernedLocale(context.governanceMap.get(normalizeSkillKey(owner, target.routePath)), locale);
        return {
          ...baseResult,
          kind: 'skill_repo_root_single_target',
          action: 'canonicalize',
          targetUrl: buildSiteUrl(governedLocale || locale, 'skills', `${owner}/${target.routePath}`),
          reason: 'Repo-root URL should resolve to the repo\'s single public skill route.',
          signals: uniqueStrings(['repo_root', hasTrailingSlash ? 'trailing_slash' : '', `target:${target.routePath}`]),
        };
      }

      if (repoEntries.length > 1) {
        return {
          ...baseResult,
          kind: 'skill_repo_root_multi_target',
          action: 'keep410',
          targetUrl: null,
          reason: 'Repo-root URL does not have a single canonical target because the repo has multiple public skill routes.',
          signals: uniqueStrings(['repo_root', `public_targets:${String(repoEntries.length)}`]),
        };
      }

      return {
        ...baseResult,
        kind: 'skill_missing_or_unpublished',
        action: 'keep410',
        targetUrl: null,
        reason: 'Repo-root skill URL is not present in the current public corpus and should stay removed.',
        signals: uniqueStrings(['repo_root', routePath]),
      };
    }

    if (repoEntries.length === 1) {
      const target = repoEntries[0];
      const governedLocale = resolveGovernedLocale(context.governanceMap.get(normalizeSkillKey(owner, target.routePath)), locale);
      return {
        ...baseResult,
        kind: 'skill_route_mismatch_single_target',
        action: 'canonicalize',
        targetUrl: buildSiteUrl(governedLocale || locale, 'skills', `${owner}/${target.routePath}`),
        reason: 'Skill path does not match the canonical public route; canonicalize to the repo\'s single public target.',
        signals: uniqueStrings([`requested:${routePath}`, `target:${target.routePath}`]),
      };
    }

    if (repoEntries.length > 1) {
      return {
        ...baseResult,
        kind: 'skill_route_mismatch_multi_target',
        action: 'keep410',
        targetUrl: null,
        reason: 'Skill path does not match a public route and the repo has multiple public targets, so there is no safe canonical redirect.',
        signals: uniqueStrings([`requested:${routePath}`, `public_targets:${String(repoEntries.length)}`]),
      };
    }

    if (repoEntries.length === 0) {
      return {
        ...baseResult,
        kind: 'skill_missing_or_unpublished',
        action: 'keep410',
        targetUrl: null,
        reason: 'Skill path is not present in the current public corpus and has no canonical public target.',
        signals: uniqueStrings([routePath]),
      };
    }

    return {
      ...baseResult,
      kind: 'unknown',
      action: 'investigate',
      targetUrl: null,
      reason: 'Skill URL does not match current public routes, blocklist rules, or known source-file traps.',
      signals: uniqueStrings([routePath, hasTrailingSlash ? 'trailing_slash' : '']),
    };
  }

  if (hasTrailingSlash && section && ROOT_SECTION_FOLLOWERS.has(section)) {
    return {
      ...baseResult,
      kind: 'legacy_trailing_slash',
      action: 'canonicalize',
      targetUrl: `https://killer-skills.com${trimmedPathname}${search}`,
      reason: 'URL has a historical trailing slash variant.',
      signals: ['trailing_slash'],
    };
  }

  return {
    ...baseResult,
    kind: 'canonical_keep',
    action: 'keep',
    targetUrl: null,
    reason: 'URL does not show canonical drift signals in the current rule set.',
    signals: [],
  };
}

export function summarizeGscCanonicalDrift(
  rows: GscRow[],
  context: GscCanonicalDriftContext,
  options: { sourceCsvPath: string; snapshotLabel: string; topN?: number },
): GscCanonicalDriftSummary {
  const classifiedRows = rows.map((row) => classifyGscPageUrl(row.entity, row, context));
  const topN = options.topN ?? 20;

  const kindAccumulator = new Map<GscCanonicalDriftKind, GscCanonicalDriftSummaryBucket>();
  const actionAccumulator = new Map<GscCanonicalDriftAction, { action: GscCanonicalDriftAction; count: number; clicks: number; impressions: number }>();

  for (const row of classifiedRows) {
    const bucket =
      kindAccumulator.get(row.kind) ||
      ({ kind: row.kind, action: row.action, count: 0, clicks: 0, impressions: 0, examples: [] } as GscCanonicalDriftSummaryBucket);
    bucket.count += 1;
    bucket.clicks += row.clicks;
    bucket.impressions += row.impressions;
    if (bucket.examples.length < 5) bucket.examples.push(row.url);
    kindAccumulator.set(row.kind, bucket);

    const actionBucket =
      actionAccumulator.get(row.action) ||
      ({ action: row.action, count: 0, clicks: 0, impressions: 0 } as {
        action: GscCanonicalDriftAction;
        count: number;
        clicks: number;
        impressions: number;
      });
    actionBucket.count += 1;
    actionBucket.clicks += row.clicks;
    actionBucket.impressions += row.impressions;
    actionAccumulator.set(row.action, actionBucket);
  }

  return {
    totalRows: classifiedRows.length,
    snapshotLabel: options.snapshotLabel,
    sourceCsvPath: options.sourceCsvPath,
    actionSummary: Array.from(actionAccumulator.values()).sort((a, b) => b.impressions - a.impressions),
    kindSummary: Array.from(kindAccumulator.values()).sort((a, b) => b.impressions - a.impressions),
    topRows: classifiedRows.sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks).slice(0, topN),
  };
}

export function renderGscCanonicalDriftMarkdown(summary: GscCanonicalDriftSummary): string {
  const lines: string[] = [];
  lines.push('# GSC Canonical Drift Audit');
  lines.push('');
  lines.push(`- Snapshot: ${summary.snapshotLabel}`);
  lines.push(`- Source CSV: ${summary.sourceCsvPath}`);
  lines.push(`- Total rows: ${summary.totalRows}`);
  lines.push('');
  lines.push('## Action Summary');
  lines.push('');
  for (const bucket of summary.actionSummary) {
    lines.push(`- ${bucket.action}: ${bucket.count} URLs, ${bucket.impressions} impressions, ${bucket.clicks} clicks`);
  }
  lines.push('');
  lines.push('## Drift Clusters');
  lines.push('');
  for (const bucket of summary.kindSummary) {
    lines.push(`### ${bucket.kind}`);
    lines.push(`- Action: ${bucket.action}`);
    lines.push(`- URLs: ${bucket.count}`);
    lines.push(`- Impressions: ${bucket.impressions}`);
    lines.push(`- Clicks: ${bucket.clicks}`);
    if (bucket.examples.length > 0) {
      lines.push('- Examples:');
      for (const example of bucket.examples) {
        lines.push(`  - ${example}`);
      }
    }
    lines.push('');
  }
  lines.push('## Top Impacted URLs');
  lines.push('');
  for (const row of summary.topRows) {
    lines.push(`- [${row.kind}] ${row.url}`);
    lines.push(`  - Action: ${row.action}`);
    lines.push(`  - Impressions: ${row.impressions}, Clicks: ${row.clicks}, CTR: ${(row.ctr * 100).toFixed(2)}%, Position: ${row.position.toFixed(2)}`);
    lines.push(`  - Reason: ${row.reason}`);
    if (row.targetUrl) lines.push(`  - Target: ${row.targetUrl}`);
    if (row.signals.length > 0) lines.push(`  - Signals: ${row.signals.join(', ')}`);
  }
  lines.push('');
  return lines.join('\n');
}

export function loadCollectionsFromDirectory(directoryPath: string): CollectionRecord[] {
  return readdirSync(directoryPath)
    .filter((entry) => entry.endsWith('.json'))
    .sort()
    .map((entry) => {
      const raw = JSON.parse(readFileSync(path.join(directoryPath, entry), 'utf8')) as { canonicalSlug?: string; legacySlugs?: string[] };
      return {
        id: entry,
        data: {
          canonicalSlug: typeof raw.canonicalSlug === 'string' ? raw.canonicalSlug : undefined,
          legacySlugs: Array.isArray(raw.legacySlugs) ? raw.legacySlugs.filter((slug) => typeof slug === 'string') : [],
        },
      };
    });
}

export function findLatestGscPagesSnapshot(snapshotDirectory: string): { csvPath: string; snapshotLabel: string } {
  const candidates = readdirSync(snapshotDirectory)
    .filter((entry) => entry.endsWith('-pages.csv'))
    .sort();
  if (candidates.length === 0) {
    throw new Error(`No GSC page snapshot CSV files found in ${snapshotDirectory}`);
  }

  const latest = candidates[candidates.length - 1];
  return {
    csvPath: path.join(snapshotDirectory, latest),
    snapshotLabel: latest.replace(/-pages\.csv$/i, ''),
  };
}

export function loadRowsFromGscPagesCsv(csvPath: string): GscRow[] {
  return parseGscCsv(readFileSync(csvPath, 'utf8'));
}
