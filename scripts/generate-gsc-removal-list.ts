#!/usr/bin/env tsx
/**
 * Generate URL removal list for Google Search Console
 * 
 * This script analyzes the Coverage Drilldown reports and generates:
 * 1. List of trailing-slash URLs to remove from index
 * 2. List of source-code file URLs to remove
 * 3. List of deep-path crawl trap URLs to remove
 * 
 * Usage:
 *   npx tsx scripts/generate-gsc-removal-list.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  discoverCoverageDrilldownSourceDirectories,
  parseCoverageDrilldownCsv,
  readCoverageDrilldownMetadata,
  resolveCoverageDrilldownCsvPaths,
} from './lib/coverage-drilldown-source';
import {
  buildGscCanonicalDriftContext,
  classifyGscPageUrl,
  loadCollectionsFromDirectory,
  type SkillLocaleGovernanceRecord,
} from './lib/gsc-canonical-drift';
import {
  buildBlockedRepoKeySet,
  buildPublicRepoKeySet,
  buildRemovalPrefixScope,
  PREFIX_ELIGIBLE_CATEGORIES,
  renderRemovalPrefixStrategyMarkdown,
  summarizeRemovalPrefixStrategy,
  type RemovalPrefixRow,
} from './lib/gsc-removal-prefixes';
import {
  buildRemovalReadinessReport,
  buildRemovalSummaryMarkdown,
  categorizeRemovalUrl,
  classifyRemovalEligibleIssue,
  isRemovalSubmissionCategory,
  parseRemovalCoverageRows,
  renderRemovalInvestigationMarkdown,
  renderCanonicalizeFollowupMarkdown,
  shouldIncludeCanonicalizeFollowup,
  type CoverageRow,
  type CoverageSourceCandidate,
  type RemovalInvestigationEntry,
  type RemovalSemanticSignal,
  type RemovalReadinessReport,
  type RemovalSummaryCategoryEntry,
  type RemovalUrlCategory,
  type CanonicalizeFollowupEntry,
  PRIORITY_REMOVAL_CATEGORIES,
  renderRemovalReadinessMarkdown,
} from './lib/gsc-removal-list';

const OUTPUT_DIR = path.join(process.cwd(), 'reports', 'seo');
const READINESS_MD_PATH = path.join(OUTPUT_DIR, 'latest-gsc-removal-readiness.md');
const READINESS_JSON_PATH = path.join(OUTPUT_DIR, 'latest-gsc-removal-readiness.json');
const SITEMAP_SKILLS_PATH = path.join(process.cwd(), 'data', 'sitemap-skills.json');
const BLOCKLIST_PATH = path.join(process.cwd(), 'data', 'seo-sitemap-blocklist.json');
const LOCALE_GOVERNANCE_PATH = path.join(process.cwd(), 'data', 'seo-skill-locale-governance.json');
const COLLECTIONS_DIR = path.join(process.cwd(), 'src', 'content', 'collections');

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function collectCoverageSources(): CoverageSourceCandidate[] {
  return discoverCoverageDrilldownSourceDirectories().flatMap((source) => {
    const metadata = readCoverageDrilldownMetadata(source.csvPaths);
    return [
      {
        directory: source.directoryPath,
        folderName: source.folderName,
        issueName: metadata['问题名称'] || '未知问题',
        sourceLabel: metadata['站点地图'] || '未知来源',
      },
    ];
  });
}

function writeReadinessReport(report: RemovalReadinessReport): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(READINESS_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(READINESS_MD_PATH, renderRemovalReadinessMarkdown(report));
}

function parseCoverageCSV(csvPath: string): CoverageRow[] {
  if (!fs.existsSync(csvPath)) {
    return [];
  }

  return parseRemovalCoverageRows(parseCoverageDrilldownCsv(fs.readFileSync(csvPath, 'utf-8')));
}

function cleanupRemovalBundleArtifacts(timestamp: string): void {
  if (!fs.existsSync(OUTPUT_DIR)) return;

  const patterns = [
    new RegExp(`^gsc-removal-.+-${timestamp}\\.txt$`),
    new RegExp(`^gsc-removal-summary-${timestamp}\\.md$`),
    new RegExp(`^gsc-removal-canonicalize-followup-${timestamp}\\.md$`),
    new RegExp(`^gsc-removal-investigate-${timestamp}\\.md$`),
    new RegExp(`^gsc-removal-prefix-strategy-${timestamp}\\.(md|json)$`),
  ];

  for (const fileName of fs.readdirSync(OUTPUT_DIR)) {
    if (!patterns.some((pattern) => pattern.test(fileName))) continue;
    fs.rmSync(path.join(OUTPUT_DIR, fileName), { force: true });
  }
}

function main() {
  console.log('🔍 Searching for Coverage Drilldown exports...\n');

  const sources = collectCoverageSources();
  const generatedAt = new Date().toISOString();
  const readinessReport = buildRemovalReadinessReport({
    generatedAt,
    sources,
  });
  const eligibleSources = sources.filter((source) => classifyRemovalEligibleIssue(source.issueName));

  if (readinessReport.status === 'blocked' && sources.length === 0) {
    const report: RemovalReadinessReport = readinessReport;
    writeReadinessReport(report);
    console.error('❌ No Coverage Drilldown directories found in archive or Downloads');
    console.error(`   Readiness report: ${READINESS_MD_PATH}`);
    process.exit(1);
  }

  if (readinessReport.status === 'blocked') {
    writeReadinessReport(readinessReport);
    console.log('⚠️ No removal-safe Coverage Drilldown source found.');
    console.log('   Guardrail: removal lists are only generated from `未找到 (404)` exports.');
    console.log(`   Readiness report: ${READINESS_MD_PATH}\n`);
    return;
  }

  writeReadinessReport(readinessReport);

  const dirs = eligibleSources.map((source) => source.directory);
  console.log(`✅ Found ${dirs.length} Coverage Drilldown export(s)\n`);

  const skills = readJson<Array<{ owner: string; repo: string; routePath: string; updatedAt?: string }>>(SITEMAP_SKILLS_PATH);
  const blocklist = readJson<unknown>(BLOCKLIST_PATH);
  const localeGovernanceRaw = readJson<{ skills?: unknown[]; records?: unknown[] }>(LOCALE_GOVERNANCE_PATH);
  const collections = loadCollectionsFromDirectory(COLLECTIONS_DIR);
  const localeGovernance = ((localeGovernanceRaw.skills || localeGovernanceRaw.records || []) as Array<Record<string, unknown>>).map(
    (record): SkillLocaleGovernanceRecord => ({
      owner: typeof record.owner === 'string' ? record.owner : undefined,
      routePath: typeof record.routePath === 'string' ? record.routePath : undefined,
      eligibleLocales: Array.isArray(record.eligibleLocales)
        ? record.eligibleLocales.filter((value): value is string => typeof value === 'string')
        : undefined,
      canonicalLocale: typeof record.canonicalLocale === 'string' ? record.canonicalLocale : null,
    }),
  );
  const semanticContext = buildGscCanonicalDriftContext({
    skills,
    blocklistData: blocklist,
    localeGovernanceRecords: localeGovernance,
    collections,
  });

  const allURLs = new Set<string>();
  const removalURLs = new Set<string>();
  const categories = new Map<string, Set<string>>();
  const canonicalizeFollowups = new Map<
    string,
    CanonicalizeFollowupEntry
  >();
  const investigationEntries = new Map<string, RemovalInvestigationEntry>();

  for (const dir of dirs) {
    const csvPaths = resolveCoverageDrilldownCsvPaths(dir);
    if (!csvPaths) continue;

    const metadata = readCoverageDrilldownMetadata(csvPaths);
    console.log(
      `📂 Processing: ${path.basename(dir)} | issue=${metadata['问题名称'] || '未知问题'} | table=${path.basename(csvPaths.table)}`,
    );
    const rows = parseCoverageCSV(csvPaths.table);

    for (const row of rows) {
      if (!row.url.startsWith('https://killer-skills.com/')) continue;

      allURLs.add(row.url);
      const semanticSignal: RemovalSemanticSignal = (() => {
        const classified = classifyGscPageUrl(
          row.url,
          { entity: row.url, clicks: 0, impressions: 0, ctr: 0, position: 0 },
          semanticContext,
        );
        return {
          kind: classified.kind,
          action: classified.action,
          targetUrl: classified.targetUrl,
          reason: classified.reason,
        };
      })();
      const category = categorizeRemovalUrl(row.url, { semanticSignal });

      if (!categories.has(category)) {
        categories.set(category, new Set());
      }
      categories.get(category)!.add(row.url);
      if (isRemovalSubmissionCategory(category)) {
        removalURLs.add(row.url);
      } else {
        investigationEntries.set(row.url, {
          sourceUrl: row.url,
          category,
          reason: semanticSignal.reason,
        });
      }

      if (shouldIncludeCanonicalizeFollowup(category, semanticSignal)) {
        canonicalizeFollowups.set(row.url, {
          sourceUrl: row.url,
          targetUrl: semanticSignal.targetUrl!,
          category,
          reason: semanticSignal.reason,
        });
      }
    }
  }

  console.log(`\n📊 Total reviewed URLs: ${allURLs.size}`);
  console.log(`📊 Removal-safe URLs: ${removalURLs.size}\n`);
  console.log('Category breakdown:');
  
  const sortedCategories = Array.from(categories.entries())
    .sort((a, b) => b[1].size - a[1].size);

  for (const [category, urls] of sortedCategories) {
    console.log(`  ${category}: ${urls.size}`);
  }

  // Generate removal lists
  console.log('\n📝 Generating removal lists...\n');

  const timestamp = new Date().toISOString().split('T')[0];
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  cleanupRemovalBundleArtifacts(timestamp);

  const priorityURLs: string[] = [];

  for (const category of PRIORITY_REMOVAL_CATEGORIES) {
    const urls = categories.get(category);
    if (urls) {
      priorityURLs.push(...Array.from(urls));
    }
  }

  // Write priority removal list
  const priorityPath = path.join(OUTPUT_DIR, `gsc-removal-priority-${timestamp}.txt`);
  fs.writeFileSync(priorityPath, priorityURLs.join('\n'));
  console.log(`✅ Priority removal list: ${priorityPath}`);
  console.log(`   ${priorityURLs.length} URLs`);

  // Write full removal list
  const fullPath = path.join(OUTPUT_DIR, `gsc-removal-full-${timestamp}.txt`);
  fs.writeFileSync(fullPath, Array.from(removalURLs).sort().join('\n'));
  console.log(`✅ Full removal list: ${fullPath}`);
  console.log(`   ${removalURLs.size} URLs`);

  // Generate category-specific lists
  for (const [category, urls] of sortedCategories) {
    if (!isRemovalSubmissionCategory(category as RemovalUrlCategory)) continue;
    const categoryPath = path.join(OUTPUT_DIR, `gsc-removal-${category}-${timestamp}.txt`);
    fs.writeFileSync(categoryPath, Array.from(urls).sort().join('\n'));
    console.log(`✅ ${category}: ${categoryPath} (${urls.size} URLs)`);
  }

  const categoryCounts = sortedCategories.map(
    ([category, urls]): RemovalSummaryCategoryEntry => ({
      category,
      count: urls.size,
    }),
  );
  const removalCategoryCounts = categoryCounts.filter((entry) => isRemovalSubmissionCategory(entry.category as RemovalUrlCategory));

  const prefixRows: RemovalPrefixRow[] = [];
  for (const category of PREFIX_ELIGIBLE_CATEGORIES) {
    const urls = categories.get(category);
    if (!urls) continue;
    for (const url of urls) {
      prefixRows.push({ url, category });
    }
  }

  const prefixStrategy = summarizeRemovalPrefixStrategy(prefixRows, {
    publicRepoKeys: buildPublicRepoKeySet(skills),
    blockedRepoKeys: buildBlockedRepoKeySet(blocklist),
  });
  const prefixScope = buildRemovalPrefixScope({
    totalRemovalSafeUrls: removalURLs.size,
    categoryCounts: removalCategoryCounts,
  });
  const prefixStrategyMarkdown = renderRemovalPrefixStrategyMarkdown(
    prefixStrategy,
    new Date().toISOString(),
    prefixScope,
  );
  const prefixStrategyPath = path.join(OUTPUT_DIR, `gsc-removal-prefix-strategy-${timestamp}.md`);
  const prefixStrategyJsonPath = path.join(OUTPUT_DIR, `gsc-removal-prefix-strategy-${timestamp}.json`);
  fs.writeFileSync(prefixStrategyPath, prefixStrategyMarkdown);
  fs.writeFileSync(prefixStrategyJsonPath, `${JSON.stringify(prefixStrategy, null, 2)}\n`);
  console.log(`✅ Prefix strategy: ${prefixStrategyPath}`);
  console.log(
    `   ${prefixStrategy.highConfidenceCandidates.length} high-confidence prefixes, ${prefixStrategy.mediumConfidenceCandidates.length} medium-confidence prefixes`,
  );

  // Generate summary report
  const summaryPath = path.join(OUTPUT_DIR, `gsc-removal-summary-${timestamp}.md`);
  const canonicalizeFollowupPath = path.join(OUTPUT_DIR, `gsc-removal-canonicalize-followup-${timestamp}.md`);
  const investigationPath = path.join(OUTPUT_DIR, `gsc-removal-investigate-${timestamp}.md`);
  if (canonicalizeFollowups.size > 0) {
    fs.writeFileSync(
      canonicalizeFollowupPath,
      renderCanonicalizeFollowupMarkdown({
        generatedAt: new Date().toISOString(),
        entries: Array.from(canonicalizeFollowups.values()),
      }),
    );
    console.log(`✅ Canonicalize follow-up: ${canonicalizeFollowupPath} (${canonicalizeFollowups.size} URLs)`);
  }
  if (investigationEntries.size > 0) {
    fs.writeFileSync(
      investigationPath,
      renderRemovalInvestigationMarkdown({
        generatedAt: new Date().toISOString(),
        entries: Array.from(investigationEntries.values()),
      }),
    );
    console.log(`✅ Investigation queue: ${investigationPath} (${investigationEntries.size} URLs)`);
  }

  const summary = buildRemovalSummaryMarkdown({
    generatedAt: new Date().toISOString(),
    timestamp,
    reviewedUrlCount: allURLs.size,
    removableUrlCount: removalURLs.size,
    priorityUrlCount: priorityURLs.length,
    canonicalizeFollowupCount: canonicalizeFollowups.size,
    investigationCount: investigationEntries.size,
    categoryCounts,
    prefixCompressionSummary: {
      totalRemovalSafeUrls: removalURLs.size,
      analyzedUrlCount: prefixScope.analyzedRows,
      excludedUrlCount: prefixScope.excludedCoverage,
      highConfidencePrefixCount: prefixStrategy.highConfidenceCandidates.length,
      highConfidenceCoverage: prefixStrategy.highConfidenceCoverage,
      mediumConfidencePrefixCount: prefixStrategy.mediumConfidenceCandidates.length,
      mediumConfidenceCoverage: prefixStrategy.mediumConfidenceCoverage,
      exactOnlyCoverage: prefixStrategy.exactOnlyCoverage,
      reportFileName: path.basename(prefixStrategyPath),
    },
  });

  fs.writeFileSync(summaryPath, summary);
  console.log(`\n✅ Summary report: ${summaryPath}\n`);

  console.log('🎯 Next steps:');
  console.log('   1. Review the generated files');
  console.log('   2. Go to Google Search Console > Removals');
  console.log('   3. Submit removal requests for priority URLs');
  console.log('   4. Monitor the Page Indexing report for improvements\n');
}

main();
