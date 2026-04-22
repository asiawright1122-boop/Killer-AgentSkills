import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SUPPORTED_LOCALES } from '../../src/i18n';
import { getLocalizedSeoEligibleLocales, getPreferredCanonicalLocale } from '../../src/lib/seo-locales';

type CollectionEntry = {
  title?: Record<string, string>;
  description?: Record<string, string>;
};

export type SeoCollectionLocaleGapReportItem = {
  file: string;
  slug: string;
  canonicalLocale: string;
  eligibleLocales: string[];
  missingLocales: string[];
};

export type SeoCollectionLocaleGapReport = {
  generatedAt: string;
  totalCollections: number;
  collectionsWithGaps: number;
  fullCoverageCollections: number;
  supportedLocales: string[];
  items: SeoCollectionLocaleGapReportItem[];
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function toSlug(fileName: string): string {
  return fileName.replace(/\.json$/i, '');
}

export function buildSeoCollectionLocaleGapReport(options?: {
  workspaceRoot?: string;
  generatedAt?: string;
}): SeoCollectionLocaleGapReport {
  const workspaceRoot = resolve(options?.workspaceRoot || process.cwd());
  const collectionsDir = resolve(workspaceRoot, 'src/content/collections');

  if (!existsSync(collectionsDir)) {
    throw new Error(`collections directory not found: ${collectionsDir}`);
  }

  const files = readdirSync(collectionsDir)
    .filter((file) => file.endsWith('.json'))
    .sort();
  const items: SeoCollectionLocaleGapReportItem[] = [];

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
    generatedAt: options?.generatedAt || new Date().toISOString(),
    totalCollections: files.length,
    collectionsWithGaps: items.length,
    fullCoverageCollections: files.length - items.length,
    supportedLocales: [...SUPPORTED_LOCALES],
    items,
  };
}
