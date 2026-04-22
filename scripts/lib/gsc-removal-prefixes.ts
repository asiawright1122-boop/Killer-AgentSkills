export type RemovalPrefixCategory =
  | 'source_file'
  | 'skill_blocklisted'
  | 'skill_missing_or_unpublished'
  | 'deep_path';

export type RemovalPrefixRow = {
  url: string;
  category: RemovalPrefixCategory;
};

export type RemovalPrefixScopeEntry = {
  category: string;
  count: number;
};

export type RemovalPrefixScope = {
  totalRemovalSafeUrls: number;
  analyzedRows: number;
  analyzedCategories: RemovalPrefixCategory[];
  excludedCoverage: number;
  excludedCategoryCounts: RemovalPrefixScopeEntry[];
};

export type RemovalPrefixCandidateConfidence = 'high' | 'medium';

export type RemovalPrefixCandidate = {
  prefixUrl: string;
  locale: string;
  owner: string;
  repo: string;
  repoKey: string;
  categories: RemovalPrefixCategory[];
  confidence: RemovalPrefixCandidateConfidence;
  count: number;
  rationale: string;
  sampleUrls: string[];
};

export type RemovalPrefixStrategy = {
  totalRows: number;
  highConfidenceCoverage: number;
  mediumConfidenceCoverage: number;
  exactOnlyCoverage: number;
  highConfidenceCandidates: RemovalPrefixCandidate[];
  mediumConfidenceCandidates: RemovalPrefixCandidate[];
};

type ParsedSkillPrefix = {
  prefixUrl: string;
  locale: string;
  owner: string;
  repo: string;
  repoKey: string;
};

export const PREFIX_ELIGIBLE_CATEGORIES = new Set<RemovalPrefixCategory>([
  'source_file',
  'skill_blocklisted',
  'skill_missing_or_unpublished',
  'deep_path',
]);

const HIGH_CONFIDENCE_CATEGORIES = new Set<RemovalPrefixCategory>(['skill_blocklisted', 'source_file', 'deep_path']);
const MEDIUM_CONFIDENCE_CATEGORIES = new Set<RemovalPrefixCategory>(['skill_missing_or_unpublished', 'source_file', 'deep_path']);

function sortCategories(categories: Set<RemovalPrefixCategory>): RemovalPrefixCategory[] {
  return Array.from(categories).sort((a, b) => a.localeCompare(b)) as RemovalPrefixCategory[];
}

export function parseSkillRepoPrefix(url: string): ParsedSkillPrefix | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 4 || parts[1] !== 'skills') return null;

  const locale = parts[0] || '';
  const owner = decodeURIComponent(parts[2] || '').trim();
  const repo = decodeURIComponent(parts[3] || '').trim();
  if (!locale || !owner || !repo) return null;

  return {
    prefixUrl: `https://killer-skills.com/${locale}/skills/${owner}/${repo}`,
    locale,
    owner,
    repo,
    repoKey: `${owner.toLowerCase()}/${repo.toLowerCase()}`,
  };
}

export function buildPublicRepoKeySet(
  skills: Array<{
    owner?: string;
    routePath?: string;
  }>,
): Set<string> {
  const repoKeys = new Set<string>();

  for (const skill of skills) {
    const owner = String(skill.owner || '').trim();
    const routePath = String(skill.routePath || '').trim();
    const repo = routePath.split('/').filter(Boolean)[0] || '';
    if (!owner || !repo) continue;
    repoKeys.add(`${owner.toLowerCase()}/${repo.toLowerCase()}`);
  }

  return repoKeys;
}

export function buildBlockedRepoKeySet(blocklistData: unknown): Set<string> {
  const rules = (blocklistData as { rules?: { excludeRepo?: unknown[] } })?.rules;
  const blocked = Array.isArray(rules?.excludeRepo) ? rules!.excludeRepo : [];
  return new Set(
    blocked
      .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
      .filter(Boolean),
  );
}

export function summarizeRemovalPrefixStrategy(
  rows: RemovalPrefixRow[],
  input: {
    publicRepoKeys: Set<string>;
    blockedRepoKeys: Set<string>;
    minUrlsPerPrefix?: number;
  },
): RemovalPrefixStrategy {
  const minUrlsPerPrefix = input.minUrlsPerPrefix ?? 2;
  const grouped = new Map<
    string,
    {
      prefixUrl: string;
      locale: string;
      owner: string;
      repo: string;
      repoKey: string;
      categories: Set<RemovalPrefixCategory>;
      sampleUrls: string[];
      count: number;
    }
  >();

  for (const row of rows) {
    const parsed = parseSkillRepoPrefix(row.url);
    if (!parsed) continue;

    const current =
      grouped.get(parsed.prefixUrl) || {
        ...parsed,
        categories: new Set<RemovalPrefixCategory>(),
        sampleUrls: [],
        count: 0,
      };

    current.categories.add(row.category);
    current.count += 1;
    if (current.sampleUrls.length < 3) {
      current.sampleUrls.push(row.url);
    }
    grouped.set(parsed.prefixUrl, current);
  }

  const highConfidenceCandidates: RemovalPrefixCandidate[] = [];
  const mediumConfidenceCandidates: RemovalPrefixCandidate[] = [];
  let assignedCoverage = 0;

  for (const group of grouped.values()) {
    if (group.count < minUrlsPerPrefix) continue;

    const categories = sortCategories(group.categories);
    const isPublicRepo = input.publicRepoKeys.has(group.repoKey);
    const isBlockedRepo = input.blockedRepoKeys.has(group.repoKey);
    const allHighConfidence = categories.every((category) => HIGH_CONFIDENCE_CATEGORIES.has(category));
    const allMediumConfidence = categories.every((category) => MEDIUM_CONFIDENCE_CATEGORIES.has(category));

    if (isBlockedRepo && !isPublicRepo && allHighConfidence) {
      highConfidenceCandidates.push({
        prefixUrl: group.prefixUrl,
        locale: group.locale,
        owner: group.owner,
        repo: group.repo,
        repoKey: group.repoKey,
        categories,
        confidence: 'high',
        count: group.count,
        rationale:
          'Repo is already blocklisted and absent from the current public corpus, so this locale/repo prefix is a high-confidence temporary-removal candidate.',
        sampleUrls: group.sampleUrls,
      });
      assignedCoverage += group.count;
      continue;
    }

    if (!isPublicRepo && allMediumConfidence) {
      mediumConfidenceCandidates.push({
        prefixUrl: group.prefixUrl,
        locale: group.locale,
        owner: group.owner,
        repo: group.repo,
        repoKey: group.repoKey,
        categories,
        confidence: 'medium',
        count: group.count,
        rationale:
          'Repo is absent from the current public corpus, but it is not explicitly blocklisted. Treat this prefix as manual-confirmation only before using a prefix removal.',
        sampleUrls: group.sampleUrls,
      });
      assignedCoverage += group.count;
    }
  }

  highConfidenceCandidates.sort((a, b) => b.count - a.count || a.prefixUrl.localeCompare(b.prefixUrl));
  mediumConfidenceCandidates.sort((a, b) => b.count - a.count || a.prefixUrl.localeCompare(b.prefixUrl));

  return {
    totalRows: rows.length,
    highConfidenceCoverage: highConfidenceCandidates.reduce((sum, item) => sum + item.count, 0),
    mediumConfidenceCoverage: mediumConfidenceCandidates.reduce((sum, item) => sum + item.count, 0),
    exactOnlyCoverage: rows.length - assignedCoverage,
    highConfidenceCandidates,
    mediumConfidenceCandidates,
  };
}

export function buildRemovalPrefixScope(input: {
  totalRemovalSafeUrls: number;
  categoryCounts: RemovalPrefixScopeEntry[];
  analyzedCategories?: Iterable<RemovalPrefixCategory>;
}): RemovalPrefixScope {
  const analyzedCategorySet = new Set(input.analyzedCategories || PREFIX_ELIGIBLE_CATEGORIES);
  const analyzedCategories = Array.from(analyzedCategorySet).sort((a, b) => a.localeCompare(b)) as RemovalPrefixCategory[];
  const excludedCategoryCounts = input.categoryCounts
    .filter((entry) => entry.count > 0 && !analyzedCategorySet.has(entry.category as RemovalPrefixCategory))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  const analyzedRows = input.categoryCounts
    .filter((entry) => analyzedCategorySet.has(entry.category as RemovalPrefixCategory))
    .reduce((sum, entry) => sum + entry.count, 0);
  const excludedCoverage = excludedCategoryCounts.reduce((sum, entry) => sum + entry.count, 0);

  return {
    totalRemovalSafeUrls: input.totalRemovalSafeUrls,
    analyzedRows,
    analyzedCategories,
    excludedCoverage,
    excludedCategoryCounts,
  };
}

export function renderRemovalPrefixStrategyMarkdown(
  strategy: RemovalPrefixStrategy,
  generatedAt: string,
  scope?: RemovalPrefixScope,
): string {
  const lines: string[] = [];
  lines.push('# GSC Removal Prefix Strategy');
  lines.push('');
  lines.push(`Generated: ${generatedAt}`);
  lines.push('');
  if (scope) {
    lines.push('## Scope');
    lines.push('');
    lines.push(`- Total removal-safe URLs available: ${scope.totalRemovalSafeUrls}`);
    lines.push(`- Prefix-eligible skill URLs analyzed in this report: ${scope.analyzedRows}`);
    lines.push(`- Exact-only or non-prefix URLs excluded from prefix analysis: ${scope.excludedCoverage}`);
    lines.push('');
    lines.push(
      `This report intentionally groups only locale/repo literal prefixes for these categories: ${scope.analyzedCategories.map((category) => `\`${category}\``).join(', ')}.`,
    );
    if (scope.excludedCategoryCounts.length > 0) {
      lines.push('The remaining removal-safe URLs stay exact-only or canonicalization follow-up work:');
      for (const entry of scope.excludedCategoryCounts) {
        lines.push(`- ${entry.category}: ${entry.count}`);
      }
    }
    lines.push('');
  }

  lines.push('## Summary');
  lines.push('');
  lines.push(`- Repo-prefix-eligible removal-safe URLs reviewed: ${strategy.totalRows}`);
  lines.push(`- High-confidence literal prefixes: ${strategy.highConfidenceCandidates.length} prefixes covering ${strategy.highConfidenceCoverage} URLs`);
  lines.push(`- Medium-confidence literal prefixes: ${strategy.mediumConfidenceCandidates.length} prefixes covering ${strategy.mediumConfidenceCoverage} URLs`);
  lines.push(`- Exact-URL backlog after prefix compression: ${strategy.exactOnlyCoverage}`);
  lines.push('');
  lines.push('Use high-confidence prefixes first. Treat medium-confidence prefixes as manual-confirmation only, because those repos are absent from the public corpus today but are not explicitly blocklisted.');
  lines.push('');

  lines.push('## High-Confidence Prefixes');
  lines.push('');
  if (strategy.highConfidenceCandidates.length === 0) {
    lines.push('- none');
  } else {
    for (const candidate of strategy.highConfidenceCandidates) {
      lines.push(`- ${candidate.prefixUrl}`);
      lines.push(`  - coverage: ${candidate.count}`);
      lines.push(`  - categories: ${candidate.categories.join(', ')}`);
      lines.push(`  - rationale: ${candidate.rationale}`);
      lines.push(`  - samples: ${candidate.sampleUrls.join(' ; ')}`);
    }
  }
  lines.push('');

  lines.push('## Medium-Confidence Prefixes');
  lines.push('');
  if (strategy.mediumConfidenceCandidates.length === 0) {
    lines.push('- none');
  } else {
    for (const candidate of strategy.mediumConfidenceCandidates) {
      lines.push(`- ${candidate.prefixUrl}`);
      lines.push(`  - coverage: ${candidate.count}`);
      lines.push(`  - categories: ${candidate.categories.join(', ')}`);
      lines.push(`  - rationale: ${candidate.rationale}`);
      lines.push(`  - samples: ${candidate.sampleUrls.join(' ; ')}`);
    }
  }
  lines.push('');

  lines.push('## Operator Guidance');
  lines.push('');
  lines.push('1. Submit high-confidence literal prefixes before spending time on hundreds of exact URLs.');
  lines.push('2. Only use a medium-confidence prefix if you manually confirm the repo should remain non-public for the next removal window.');
  lines.push('3. Keep using exact URL removals for public repos with source-file or deep-path traps, because repo-level prefixes would be too risky.');

  return `${lines.join('\n')}\n`;
}
