#!/usr/bin/env tsx

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildBlockedRepoKeySet,
  buildPublicRepoKeySet,
  buildRemovalPrefixScope,
  PREFIX_ELIGIBLE_CATEGORIES,
  renderRemovalPrefixStrategyMarkdown,
  summarizeRemovalPrefixStrategy,
  type RemovalPrefixCategory,
  type RemovalPrefixRow,
} from './lib/gsc-removal-prefixes';

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'reports', 'seo');
const SITEMAP_SKILLS_PATH = path.join(ROOT, 'data', 'sitemap-skills.json');
const BLOCKLIST_PATH = path.join(ROOT, 'data', 'seo-sitemap-blocklist.json');

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function findLatestRemovalTimestamp(): string {
  const matches = readdirSync(REPORT_DIR)
    .map((fileName) => {
      const match = fileName.match(/^gsc-removal-full-(\d{4}-\d{2}-\d{2})\.txt$/);
      return match ? match[1] : null;
    })
    .filter((value): value is string => Boolean(value))
    .sort();

  if (matches.length === 0) {
    throw new Error(`No gsc-removal-full-YYYY-MM-DD.txt files found in ${REPORT_DIR}`);
  }

  return matches[matches.length - 1];
}

function collectRowsForTimestamp(timestamp: string): {
  rows: RemovalPrefixRow[];
  totalRemovalSafeUrls: number;
  categoryCounts: Array<{ category: string; count: number }>;
} {
  const rows: RemovalPrefixRow[] = [];
  const categoryCounts: Array<{ category: string; count: number }> = [];
  let totalRemovalSafeUrls = 0;
  for (const fileName of readdirSync(REPORT_DIR).sort()) {
    const match = fileName.match(new RegExp(`^gsc-removal-(.+)-${timestamp}\\.txt$`));
    if (!match) continue;

    const category = match[1] || '';
    const filePath = path.join(REPORT_DIR, fileName);
    const urls = readFileSync(filePath, 'utf8')
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);

    if (category === 'full') {
      totalRemovalSafeUrls = urls.length;
      continue;
    }

    if (category === 'priority') {
      continue;
    }

    categoryCounts.push({ category, count: urls.length });
    if (!PREFIX_ELIGIBLE_CATEGORIES.has(category as RemovalPrefixCategory)) continue;

    for (const url of urls) {
      rows.push({ url, category: category as RemovalPrefixCategory });
    }
  }

  return {
    rows,
    totalRemovalSafeUrls,
    categoryCounts,
  };
}

const timestamp = findLatestRemovalTimestamp();
const { rows, totalRemovalSafeUrls, categoryCounts } = collectRowsForTimestamp(timestamp);
const publicRepoKeys = buildPublicRepoKeySet(
  readJson<Array<{ owner?: string; routePath?: string }>>(SITEMAP_SKILLS_PATH),
);
const blockedRepoKeys = buildBlockedRepoKeySet(readJson<unknown>(BLOCKLIST_PATH));
const strategy = summarizeRemovalPrefixStrategy(rows, {
  publicRepoKeys,
  blockedRepoKeys,
});
const scope = buildRemovalPrefixScope({
  totalRemovalSafeUrls: totalRemovalSafeUrls || rows.length,
  categoryCounts,
});

const markdown = renderRemovalPrefixStrategyMarkdown(strategy, new Date().toISOString(), scope);
const markdownPath = path.join(REPORT_DIR, `gsc-removal-prefix-strategy-${timestamp}.md`);
const jsonPath = path.join(REPORT_DIR, `gsc-removal-prefix-strategy-${timestamp}.json`);

writeFileSync(markdownPath, markdown);
writeFileSync(jsonPath, `${JSON.stringify(strategy, null, 2)}\n`);

console.log(`# GSC Removal Prefix Strategy`);
console.log(`- Timestamp: ${timestamp}`);
console.log(`- Total removal-safe URLs available: ${scope.totalRemovalSafeUrls}`);
console.log(`- Repo-prefix-eligible removal-safe URLs reviewed: ${strategy.totalRows}`);
console.log(`- High-confidence prefixes: ${strategy.highConfidenceCandidates.length} covering ${strategy.highConfidenceCoverage} URLs`);
console.log(`- Medium-confidence prefixes: ${strategy.mediumConfidenceCandidates.length} covering ${strategy.mediumConfidenceCoverage} URLs`);
console.log(`- Exact backlog after prefix compression: ${strategy.exactOnlyCoverage}`);
console.log(`- Markdown: ${markdownPath}`);
console.log(`- JSON: ${jsonPath}`);
