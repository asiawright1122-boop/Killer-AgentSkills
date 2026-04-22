import type { GscCanonicalDriftAction, GscCanonicalDriftKind, GscCanonicalDriftRow } from './gsc-canonical-drift';
import { countExtraSkillSegments, isSourceFilePathname } from './coverage-url-classification';

const SOURCE_FILE_EXT_REGEX = /\.(md|mdx|ts|tsx|js|jsx|py|json|go|yaml|yml|toml|rs|rb|css|html|xml|txt|ini|csv|lock)$/i;

export type RemovalHeuristicCategory =
  | 'trailing_slash'
  | 'source_file'
  | 'deep_path'
  | 'query_param'
  | 'legacy_html'
  | 'other';

export type RemovalSemanticCategory =
  | 'docs_legacy_slug'
  | 'skill_blocklisted'
  | 'skill_missing_or_unpublished'
  | 'skill_repo_root_single_target'
  | 'skill_noncanonical_locale'
  | 'collection_legacy_slug'
  | 'skill_repo_root_multi_target'
  | 'skill_route_mismatch_single_target'
  | 'skill_route_mismatch_multi_target'
  | 'canonical_keep';

export type RemovalUrlCategory = RemovalHeuristicCategory | RemovalSemanticCategory;

export type CoverageRow = {
  url: string;
  issue: string;
};

export type CoverageSourceCandidate = {
  directory: string;
  folderName: string;
  issueName: string;
  sourceLabel: string;
};

export type RemovalReadinessReport = {
  generatedAt: string;
  status: 'ready' | 'blocked';
  reason: string;
  eligibleIssueNames: string[];
  eligibleDirectories: string[];
  availableSources: CoverageSourceCandidate[];
};

export type RemovalSummaryCategoryEntry = {
  category: string;
  count: number;
};

export type RemovalSemanticSignal = Pick<GscCanonicalDriftRow, 'kind' | 'action' | 'targetUrl' | 'reason'>;

export type RemovalPrefixCompressionSummary = {
  totalRemovalSafeUrls: number;
  analyzedUrlCount: number;
  excludedUrlCount: number;
  highConfidencePrefixCount: number;
  highConfidenceCoverage: number;
  mediumConfidencePrefixCount: number;
  mediumConfidenceCoverage: number;
  exactOnlyCoverage: number;
  reportFileName: string;
};

export type CanonicalizeFollowupEntry = {
  sourceUrl: string;
  targetUrl: string;
  category: RemovalUrlCategory;
  reason: string;
};

export type RemovalInvestigationEntry = {
  sourceUrl: string;
  category: RemovalUrlCategory;
  reason: string;
};

export const PRIORITY_REMOVAL_CATEGORIES: RemovalUrlCategory[] = [
  'trailing_slash',
  'source_file',
  'deep_path',
  'skill_blocklisted',
  'skill_missing_or_unpublished',
  'skill_repo_root_multi_target',
  'skill_route_mismatch_multi_target',
];

export const CANONICALIZE_FOLLOWUP_CATEGORIES: RemovalUrlCategory[] = [
  'docs_legacy_slug',
  'skill_repo_root_single_target',
  'skill_noncanonical_locale',
  'collection_legacy_slug',
  'skill_route_mismatch_single_target',
];

export const NON_REMOVAL_CATEGORIES: RemovalUrlCategory[] = ['canonical_keep'];

const SEMANTIC_CATEGORY_GUIDANCE: Partial<Record<RemovalUrlCategory, string>> = {
  docs_legacy_slug: 'Verify the legacy docs slug 301s to the canonical docs URL; recrawl should consolidate once Google revisits it.',
  skill_blocklisted: 'Keep these URLs at 410 and use exact removal submissions when they continue to appear in Coverage or Removals.',
  skill_missing_or_unpublished:
    'Keep these URLs at 410 until the skill is republished into the public corpus; do not restore them blindly.',
  skill_repo_root_single_target:
    'Verify the repo-root URL 301s to the single governed skill detail page, then let Google recrawl the canonical target.',
  skill_noncanonical_locale:
    'Verify the suppressed locale redirects to the governed canonical locale rather than serving a standalone public page.',
  collection_legacy_slug: 'Verify the legacy collection slug 301s to the canonical collection slug.',
  skill_repo_root_multi_target:
    'Keep these URLs at 410 until the repo has a single safe public landing target; exact removals are safe in the meantime.',
  skill_route_mismatch_single_target:
    "Verify the mismatched skill route 301s to the repo's single canonical public target.",
  skill_route_mismatch_multi_target:
    'Keep these URLs at 410 until a unique canonical target exists; exact removals are safer than speculative redirects.',
  canonical_keep: 'These URLs look canonical under current rules and should be investigated separately if they still show up in 404 exports.',
};

function getCategoryCount(categoryCounts: RemovalSummaryCategoryEntry[], category: string): number {
  return categoryCounts.find((entry) => entry.category === category)?.count || 0;
}

function mapDriftKindToRemovalCategory(kind: GscCanonicalDriftKind): RemovalUrlCategory {
  switch (kind) {
    case 'docs_legacy_slug':
      return 'docs_legacy_slug';
    case 'legacy_trailing_slash':
      return 'trailing_slash';
    case 'skill_source_file_path':
      return 'source_file';
    case 'listing_parameter_page':
      return 'query_param';
    case 'skill_blocklisted':
      return 'skill_blocklisted';
    case 'skill_missing_or_unpublished':
      return 'skill_missing_or_unpublished';
    case 'skill_repo_root_single_target':
      return 'skill_repo_root_single_target';
    case 'skill_noncanonical_locale':
      return 'skill_noncanonical_locale';
    case 'collection_legacy_slug':
      return 'collection_legacy_slug';
    case 'skill_repo_root_multi_target':
      return 'skill_repo_root_multi_target';
    case 'skill_route_mismatch_single_target':
      return 'skill_route_mismatch_single_target';
    case 'skill_route_mismatch_multi_target':
      return 'skill_route_mismatch_multi_target';
    case 'canonical_keep':
      return 'canonical_keep';
    default:
      return 'other';
  }
}

export function classifyRemovalEligibleIssue(issueName: string): boolean {
  const normalized = String(issueName || '').trim().toLowerCase();
  return normalized.includes('404') || normalized.includes('未找到');
}

export function parseRemovalCoverageRows(rows: string[][]): CoverageRow[] {
  if (rows.length < 2) return [];

  const parsedRows: CoverageRow[] = [];
  for (const row of rows.slice(1)) {
    const url = String(row[0] || '').trim();
    const issue = String(row[1] || '').trim();
    if (!url || !issue) continue;
    parsedRows.push({ url, issue });
  }

  return parsedRows;
}

export function categorizeRemovalUrl(
  url: string,
  options?: {
    semanticSignal?: RemovalSemanticSignal | null;
  },
): RemovalUrlCategory {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'other';
  }

  const pathname = parsed.pathname;

  if (url.endsWith('/') && url !== 'https://killer-skills.com/') {
    return 'trailing_slash';
  }

  if (url.includes('.html') && !pathname.includes('/skills/')) {
    return 'legacy_html';
  }

  if (isSourceFilePathname(pathname, SOURCE_FILE_EXT_REGEX)) {
    return 'source_file';
  }

  if (countExtraSkillSegments(pathname) >= 2) {
    return 'deep_path';
  }

  if (parsed.searchParams.size > 0) {
    return 'query_param';
  }

  if (options?.semanticSignal) {
    return mapDriftKindToRemovalCategory(options.semanticSignal.kind);
  }

  return 'other';
}

export function buildRemovalReadinessReport(input: {
  generatedAt: string;
  sources: CoverageSourceCandidate[];
}): RemovalReadinessReport {
  const eligibleSources = input.sources.filter((source) => classifyRemovalEligibleIssue(source.issueName));
  const baseReport = {
    generatedAt: input.generatedAt,
    eligibleIssueNames: eligibleSources.map((source) => source.issueName),
    eligibleDirectories: eligibleSources.map((source) => source.directory),
    availableSources: input.sources,
  };

  if (input.sources.length === 0) {
    return {
      ...baseReport,
      status: 'blocked',
      reason: 'No Coverage Drilldown sources found in archive or Downloads.',
    };
  }

  if (eligibleSources.length === 0) {
    return {
      ...baseReport,
      status: 'blocked',
      reason:
        'No Coverage Drilldown source with issue name `未找到 (404)` is available, so removal lists were not generated.',
    };
  }

  return {
    ...baseReport,
    status: 'ready',
    reason: 'A 404 Coverage Drilldown source is present, so removal-list generation is enabled.',
  };
}

export function renderRemovalReadinessMarkdown(report: RemovalReadinessReport): string {
  const lines: string[] = [];
  lines.push('# GSC Removal Readiness');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Status: ${report.status}`);
  lines.push(`- Reason: ${report.reason}`);
  lines.push(`- Eligible sources: ${report.eligibleDirectories.length}`);
  lines.push('');
  lines.push('## Available Coverage Sources');
  lines.push('');
  if (report.availableSources.length === 0) {
    lines.push('- none');
  } else {
    for (const source of report.availableSources) {
      lines.push(
        `- ${source.folderName} | issue=${source.issueName} | source=${source.sourceLabel} | directory=${source.directory}`,
      );
    }
  }
  lines.push('');
  lines.push('## Guardrail');
  lines.push('');
  lines.push('- Generate removal lists only from `未找到 (404)` Coverage Drilldown exports.');
  lines.push('- Do not submit removals from `服务器错误 (5xx)` exports; those URLs may still be valid canonical pages after runtime fixes.');
  if (report.status === 'blocked') {
    lines.push('- Ignore any previously generated dated `gsc-removal-*.txt` files until a dedicated `未找到 (404)` export is ingested and this readiness report turns `ready`.');
  }

  return `${lines.join('\n')}\n`;
}

export function buildRemovalSummaryMarkdown(input: {
  generatedAt: string;
  timestamp: string;
  reviewedUrlCount: number;
  removableUrlCount: number;
  priorityUrlCount: number;
  categoryCounts: RemovalSummaryCategoryEntry[];
  canonicalizeFollowupCount?: number;
  investigationCount?: number;
  prefixCompressionSummary?: RemovalPrefixCompressionSummary | null;
}): string {
  const {
    canonicalizeFollowupCount = 0,
    categoryCounts,
    generatedAt,
    investigationCount = 0,
    prefixCompressionSummary = null,
    priorityUrlCount,
    removableUrlCount,
    reviewedUrlCount,
    timestamp,
  } = input;
  const lines: string[] = [];
  lines.push('# Google Search Console URL Removal Summary');
  lines.push('');
  lines.push(`Generated: ${generatedAt}`);
  lines.push('');
  lines.push('## Overview');
  lines.push('');
  lines.push(`Coverage URLs reviewed: ${reviewedUrlCount}`);
  lines.push(`URLs safe to submit for removal: ${removableUrlCount}`);
  lines.push('');
  lines.push('## Category Breakdown');
  lines.push('');
  lines.push(...categoryCounts.map((entry) => `- **${entry.category}**: ${entry.count} URLs`));
  lines.push('');
  lines.push('## Priority Actions');
  lines.push('');
  lines.push(`### 1. Trailing Slash URLs (${getCategoryCount(categoryCounts, 'trailing_slash')})`);
  lines.push('');
  lines.push('These URLs have trailing slashes and should be removed from the index.');
  lines.push('The site already redirects them with 301, but Google needs to be told to drop the old versions.');
  lines.push('');
  lines.push('**Action**: Use the generated trailing-slash URL list for exact submissions.');
  lines.push('- Do **not** use a wildcard prefix like `https://killer-skills.com/*/` because GSC prefix removals only accept literal prefixes.');
  lines.push(`- Preferred input: \`gsc-removal-trailing_slash-${timestamp}.txt\``);
  lines.push('- If you want to use prefix removals, derive a **literal** prefix only when every URL under that exact prefix is a stale trailing-slash variant.');
  lines.push('');
  lines.push(`### 2. Source Code Files (${getCategoryCount(categoryCounts, 'source_file')})`);
  lines.push('');
  lines.push('These are GitHub repository file paths that should never have been indexed.');
  lines.push('The middleware now returns 410 Gone for these.');
  lines.push('');
  lines.push('**Action**: Batch remove using the generated list');
  lines.push('');
  lines.push(`### 3. Deep Path Crawl Traps (${getCategoryCount(categoryCounts, 'deep_path')})`);
  lines.push('');
  lines.push('These are nested skill paths beyond the valid owner/repo structure.');
  lines.push('The middleware now redirects or returns 404 for these.');
  lines.push('');
  lines.push('**Action**: Batch remove using the generated list');

  if (prefixCompressionSummary) {
    lines.push('');
    lines.push('## Prefix Compression Snapshot');
    lines.push('');
    lines.push(
      `- Prefix-eligible skill URLs analyzed: ${prefixCompressionSummary.analyzedUrlCount} of ${prefixCompressionSummary.totalRemovalSafeUrls} removal-safe URLs`,
    );
    lines.push(
      `- High-confidence literal prefixes: ${prefixCompressionSummary.highConfidencePrefixCount} covering ${prefixCompressionSummary.highConfidenceCoverage} URLs`,
    );
    lines.push(
      `- Medium-confidence literal prefixes: ${prefixCompressionSummary.mediumConfidencePrefixCount} covering ${prefixCompressionSummary.mediumConfidenceCoverage} URLs`,
    );
    lines.push(`- Exact-URL backlog inside the analyzed subset: ${prefixCompressionSummary.exactOnlyCoverage}`);
    lines.push(`- Exact-only or non-prefix backlog outside this subset: ${prefixCompressionSummary.excludedUrlCount}`);
    lines.push(`- Detailed prefix candidates: \`${prefixCompressionSummary.reportFileName}\``);
  }

  const semanticEntries = categoryCounts.filter((entry) => SEMANTIC_CATEGORY_GUIDANCE[entry.category as RemovalUrlCategory]);
  if (semanticEntries.length > 0) {
    lines.push('');
    lines.push('## Semantic Reclassification');
    lines.push('');
    for (const entry of semanticEntries) {
      lines.push(`- **${entry.category}**: ${entry.count} URLs. ${SEMANTIC_CATEGORY_GUIDANCE[entry.category as RemovalUrlCategory]}`);
    }
  }

  lines.push('');
  lines.push('## Files Generated');
  lines.push('');
  lines.push(`- \`gsc-removal-priority-${timestamp}.txt\` - High priority URLs (${priorityUrlCount})`);
  lines.push(`- \`gsc-removal-full-${timestamp}.txt\` - Removal-safe URLs (${removableUrlCount})`);
  if (prefixCompressionSummary) {
    lines.push(`- \`${prefixCompressionSummary.reportFileName}\` - Repo-prefix compression candidates`);
  }
  if (canonicalizeFollowupCount > 0) {
    lines.push(`- \`gsc-removal-canonicalize-followup-${timestamp}.md\` - Redirect / canonicalize queue (${canonicalizeFollowupCount})`);
  }
  if (investigationCount > 0) {
    lines.push(`- \`gsc-removal-investigate-${timestamp}.md\` - Valid canonical URLs to review instead of removing (${investigationCount})`);
  }
  lines.push(
    ...categoryCounts
      .filter((entry) => !NON_REMOVAL_CATEGORIES.includes(entry.category as RemovalUrlCategory))
      .map((entry) => `- \`gsc-removal-${entry.category}-${timestamp}.txt\``),
  );
  lines.push('');
  lines.push('## Next Steps');
  lines.push('');
  lines.push('1. Go to [Google Search Console](https://search.google.com/search-console)');
  lines.push('2. Select your property (killer-skills.com)');
  lines.push('3. Navigate to **Removals** in the left sidebar');
  lines.push('4. Click **New Request**');
  lines.push('5. Use **Temporary Removals** with exact URLs from the generated `.txt` files');
  lines.push('6. Use **Remove all URLs with this prefix** only for safe, literal prefixes you have manually verified');
  if (canonicalizeFollowupCount > 0) {
    lines.push(`7. Work through \`gsc-removal-canonicalize-followup-${timestamp}.md\` and verify each source URL resolves to its canonical target.`);
  }
  if (investigationCount > 0) {
    lines.push(`8. Do **not** submit URLs from \`gsc-removal-investigate-${timestamp}.md\`; verify why they appeared in Coverage despite being canonical now.`);
  }
  lines.push('');
  lines.push('**Note**: Removals are temporary (6 months). The permanent fix is:');
  lines.push("- Ensure all internal links don't use trailing slashes ✅");
  lines.push("- Ensure sitemap doesn't include trailing slashes ✅");
  lines.push('- Ensure middleware redirects trailing slashes ✅');
  lines.push('- Wait for Google to recrawl and update its index');

  return `${lines.join('\n')}\n`;
}

export function shouldIncludeCanonicalizeFollowup(
  category: RemovalUrlCategory,
  semanticSignal: RemovalSemanticSignal | null | undefined,
): boolean {
  return Boolean(
    semanticSignal &&
      semanticSignal.action === 'canonicalize' &&
      semanticSignal.targetUrl &&
      CANONICALIZE_FOLLOWUP_CATEGORIES.includes(category),
  );
}

export function renderCanonicalizeFollowupMarkdown(input: {
  generatedAt: string;
  entries: CanonicalizeFollowupEntry[];
}): string {
  const entries = [...input.entries].sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl));
  const lines: string[] = [];
  lines.push('# GSC Canonicalize Follow-up');
  lines.push('');
  lines.push(`Generated: ${input.generatedAt}`);
  lines.push('');
  lines.push(`Total URLs: ${entries.length}`);
  lines.push('');
  lines.push('Use this list to verify that each stale URL now resolves to the intended canonical target before relying on recrawl alone.');
  lines.push('');
  if (entries.length === 0) {
    lines.push('- none');
    return `${lines.join('\n')}\n`;
  }
  for (const entry of entries) {
    lines.push(`- ${entry.sourceUrl}`);
    lines.push(`  - category: ${entry.category}`);
    lines.push(`  - target: ${entry.targetUrl}`);
    lines.push(`  - reason: ${entry.reason}`);
  }

  return `${lines.join('\n')}\n`;
}

export function isRemovalSubmissionCategory(category: RemovalUrlCategory): boolean {
  return !NON_REMOVAL_CATEGORIES.includes(category);
}

export function renderRemovalInvestigationMarkdown(input: {
  generatedAt: string;
  entries: RemovalInvestigationEntry[];
}): string {
  const entries = [...input.entries].sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl));
  const lines: string[] = [];
  lines.push('# GSC Removal Investigation Queue');
  lines.push('');
  lines.push(`Generated: ${input.generatedAt}`);
  lines.push('');
  lines.push(`Total URLs: ${entries.length}`);
  lines.push('');
  lines.push('These URLs currently look canonical and should not be submitted as temporary removals unless a deeper investigation proves they are still invalid.');
  lines.push('');
  if (entries.length === 0) {
    lines.push('- none');
    return `${lines.join('\n')}\n`;
  }
  for (const entry of entries) {
    lines.push(`- ${entry.sourceUrl}`);
    lines.push(`  - category: ${entry.category}`);
    lines.push(`  - reason: ${entry.reason}`);
  }

  return `${lines.join('\n')}\n`;
}
