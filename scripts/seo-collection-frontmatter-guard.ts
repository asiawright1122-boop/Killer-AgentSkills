#!/usr/bin/env npx tsx
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  lintCollectionFrontmatter,
  type LintResult,
} from './lib/seo-collection-frontmatter-guard';

const ROOT = process.cwd();
const COLLECTIONS_DIR = resolve(ROOT, 'src/content/collections');
const REPORT_DIR = resolve(ROOT, 'reports/seo');
const REPORT_BASE = 'latest-collection-frontmatter-guard';

function loadCollections(): Array<{ slug: string; data: any }> {
  return readdirSync(COLLECTIONS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const data = JSON.parse(readFileSync(resolve(COLLECTIONS_DIR, f), 'utf8'));
      const slug = data.canonicalSlug ?? f.replace(/\.json$/, '');
      return { slug, data };
    });
}

function main() {
  const items = loadCollections();
  const results: Array<{ slug: string; result: LintResult }> = [];
  let totalViolations = 0;
  let totalWarnings = 0;
  for (const { slug, data } of items) {
    const result = lintCollectionFrontmatter(data, slug);
    results.push({ slug, result });
    totalViolations += result.violations.length;
    totalWarnings += result.warnings.length;
  }

  mkdirSync(REPORT_DIR, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    collectionCount: items.length,
    totalViolations,
    totalWarnings,
    collections: results.map((r) => ({
      slug: r.slug,
      violations: r.result.violations,
      warnings: r.result.warnings,
    })),
  };
  writeFileSync(
    resolve(REPORT_DIR, `${REPORT_BASE}.json`),
    JSON.stringify(report, null, 2) + '\n',
  );

  const md = [
    `# Collection Frontmatter Guard Report`,
    ``,
    `Generated: ${report.generatedAt}`,
    ``,
    `## Summary`,
    `- collections checked: ${report.collectionCount}`,
    `- violations: ${totalViolations}`,
    `- warnings: ${totalWarnings}`,
    ``,
    `## Collections with violations`,
    ...results
      .filter((r) => r.result.violations.length > 0)
      .map(
        (r) =>
          `- **${r.slug}** (${r.result.violations.length})\n` +
          r.result.violations
            .map((v) => `  - [${v.field}] ${v.code} (${v.locale}) — ${v.message}`)
            .join('\n'),
      ),
    ``,
  ].join('\n');
  writeFileSync(resolve(REPORT_DIR, `${REPORT_BASE}.md`), md);

  if (totalViolations > 0) {
    console.error(
      `Collection frontmatter guard failed with ${totalViolations} violation(s).`,
    );
    console.error(`See reports/seo/${REPORT_BASE}.md`);
    process.exit(1);
  }
  console.log(`Collection frontmatter guard passed: ${items.length} collections checked.`);
}

main();
