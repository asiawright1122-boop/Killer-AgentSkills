#!/usr/bin/env npx tsx

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SUPPORTED_LOCALES } from '../src/i18n';
import { getLocalizedSeoEligibleLocales, getPreferredCanonicalLocale } from '../src/lib/seo-locales';

type CollectionEntry = {
  title?: Record<string, string>;
  description?: Record<string, string>;
};

type LocaleGapReportItem = {
  file: string;
  slug: string;
  canonicalLocale: string;
  eligibleLocales: string[];
  missingLocales: string[];
};

type LocaleGapReport = {
  generatedAt: string;
  totalCollections: number;
  collectionsWithGaps: number;
  fullCoverageCollections: number;
  supportedLocales: string[];
  items: LocaleGapReportItem[];
};

const workspaceRoot = process.cwd();
const collectionsDir = resolve(workspaceRoot, 'src/content/collections');
const outputPath = resolve(workspaceRoot, 'data/seo-collection-locale-gaps.json');

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function toSlug(fileName: string): string {
  return fileName.replace(/\.json$/i, '');
}

function buildReport(): LocaleGapReport {
  if (!existsSync(collectionsDir)) {
    throw new Error(`collections directory not found: ${collectionsDir}`);
  }

  const files = readdirSync(collectionsDir)
    .filter((file) => file.endsWith('.json'))
    .sort();
  const items: LocaleGapReportItem[] = [];

  for (const file of files) {
    const entry = readJson<CollectionEntry>(join(collectionsDir, file));
    const eligibleLocales = getLocalizedSeoEligibleLocales(entry, SUPPORTED_LOCALES);
    const missingLocales = SUPPORTED_LOCALES.filter((locale) => !eligibleLocales.includes(locale));
    if (missingLocales.length === 0) continue;

    items.push({
      file,
      slug: toSlug(file),
      canonicalLocale: getPreferredCanonicalLocale(eligibleLocales),
      eligibleLocales,
      missingLocales,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    totalCollections: files.length,
    collectionsWithGaps: items.length,
    fullCoverageCollections: files.length - items.length,
    supportedLocales: [...SUPPORTED_LOCALES],
    items,
  };
}

function main() {
  const report = buildReport();
  writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log(`Collection locale gap report written: ${outputPath}`);
  console.log(
    `Collections: total=${report.totalCollections}, fullCoverage=${report.fullCoverageCollections}, gaps=${report.collectionsWithGaps}`,
  );
}

main();
