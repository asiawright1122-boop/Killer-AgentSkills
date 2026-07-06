#!/usr/bin/env npx tsx
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateCollectionForBackfill } from './lib/backfill-authority-surface-collections';
import type { AuthoritySurfacesManifest } from './lib/authority-surfaces-paths';

type LocalizedText = Record<string, string>;
type CollectionJson = {
  canonicalSlug?: string;
  title?: LocalizedText;
  description?: LocalizedText;
  editorial?: {
    selectionReason?: LocalizedText;
    trustSignals?: Record<string, string[]>;
    maintenance?: { reviewedAt?: string };
  };
  featured?: boolean;
  category?: string;
};

const ROOT = process.cwd();
const COLLECTIONS_DIR = resolve(ROOT, 'src/content/collections');
const MANIFEST_PATH = resolve(ROOT, 'data/authority-surfaces.json');
const DRIFT_PATH = resolve(ROOT, 'data/seo-collection-drift.json');
const REPORT_DIR = resolve(ROOT, 'reports/seo');
const REPORT_BASE = 'latest-authority-surface-backfill';

function readJson<T>(p: string): T {
  if (!p) return {} as T;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as T;
  } catch {
    return {} as T;
  }
}

function loadManifestSlugs(manifest: AuthoritySurfacesManifest): Set<string> {
  return new Set(
    (manifest.surfaces ?? [])
      .filter((s) => s.surfaceClass === 'collection')
      .map((s) => (s.href ?? '').replace(/^\/{locale}\/collections\//, '')),
  );
}

function loadDriftIssues(): Record<string, string[]> {
  // The drift report (data/seo-collection-drift.json) is shaped as
  // { items: Array<{ file, slug, code, message, severity }>, issuesByCode, ... }.
  // Earlier revisions of this script assumed an `issues[]` field; the real field
  // is `items[]`. We coerce into the { slug -> string[] } map the gate expects.
  const drift = readJson<{ items?: Array<{ slug: string; code: string }> }>(DRIFT_PATH);
  const map: Record<string, string[]> = {};
  for (const issue of drift.items ?? []) {
    if (!issue.slug || !issue.code) continue;
    (map[issue.slug] ??= []).push(issue.code);
  }
  return map;
}

function loadDiskCollections(): CollectionJson[] {
  return readdirSync(COLLECTIONS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson<CollectionJson>(resolve(COLLECTIONS_DIR, f)));
}

function buildSurfaceRecordFromCollection(slug: string, c: CollectionJson) {
  return {
    id: `collection-${slug.replace(/^top-/, '')}`,
    role: 'primary',
    tier: c.featured ? 'P0' : 'P1',
    surfaceClass: 'collection',
    href: `/{locale}/collections/${slug}`,
    title: c.title ?? { en: slug },
    description: c.description ?? { en: '' },
    rationale: { en: `Backfilled from disk collection ${slug}; meets editorial + reviewedAt quality gate.` },
    placements: ['home', 'skills', 'collections', 'solutions'],
  };
}

function main() {
  const manifest = readJson<AuthoritySurfacesManifest>(MANIFEST_PATH);
  if (!manifest || !Array.isArray(manifest.surfaces)) {
    console.error(`FATAL: manifest missing or malformed at ${MANIFEST_PATH}. Expected a top-level "surfaces" array.`);
    process.exit(1);
  }
  const existingSlugs = loadManifestSlugs(manifest);
  const driftIssues = loadDriftIssues();
  const disk = loadDiskCollections();

  type Row = { slug: string; verdict: string; admit: boolean };
  const rows: Row[] = [];
  const admitted: Array<{ slug: string; record: ReturnType<typeof buildSurfaceRecordFromCollection> }> = [];

  for (const c of disk) {
    const slug = c.canonicalSlug;
    if (!slug) continue;
    const verdict = evaluateCollectionForBackfill(c, { existingSlugs, driftIssues });
    rows.push({ slug, verdict: verdict.reason, admit: verdict.admit });
    if (verdict.admit) admitted.push({ slug, record: buildSurfaceRecordFromCollection(slug, c) });
  }

  mkdirSync(REPORT_DIR, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    existingManifestSlugs: [...existingSlugs].sort(),
    diskCollectionCount: disk.filter((c) => c.canonicalSlug).length,
    admitted: admitted.map((a) => a.slug).sort(),
    deferred: rows.filter((r) => !r.admit).map((r) => ({ slug: r.slug, reason: r.verdict })).sort((a, b) => a.slug.localeCompare(b.slug)),
    // Include full surface records for the controller to append to the manifest after human review.
    admittedRecords: admitted.map((a) => ({ slug: a.slug, record: a.record })).sort((a, b) => a.slug.localeCompare(b.slug)),
  };
  writeFileSync(resolve(REPORT_DIR, `${REPORT_BASE}.json`), JSON.stringify(report, null, 2) + '\n');

  const md = [
    `# Authority Surface Backfill Report`,
    ``,
    `Generated: ${report.generatedAt}`,
    ``,
    `## Summary`,
    `- existing manifest collection slugs: ${report.existingManifestSlugs.length}`,
    `- disk collections with canonicalSlug: ${report.diskCollectionCount}`,
    `- admitted (ready to append): ${report.admitted.length}`,
    `- deferred: ${report.deferred.length}`,
    ``,
    `## Admitted (${report.admitted.length})`,
    ...report.admitted.map((s) => `- ${s}`),
    ``,
    `## Deferred (${report.deferred.length})`,
    ...report.deferred.map((d) => `- ${d.slug} — ${d.reason}`),
    ``,
    `## Admitted surface records (for manual manifest append)`,
    '```json',
    JSON.stringify(report.admittedRecords, null, 2),
    '```',
    ``,
  ].join('\n');
  writeFileSync(resolve(REPORT_DIR, `${REPORT_BASE}.md`), md);

  console.log(`Backfill report written: ${REPORT_DIR}/${REPORT_BASE}.{json,md}`);
  console.log(`Admitted ${admitted.length} new collection surfaces. To apply, append to data/authority-surfaces.json manually.`);
}

main();
