#!/usr/bin/env npx tsx

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSeoCollectionLocaleGapReport } from './lib/seo-collection-locale-gaps';

const workspaceRoot = process.cwd();
const outputPath = resolve(workspaceRoot, 'data/seo-collection-locale-gaps.json');

function main() {
  const report = buildSeoCollectionLocaleGapReport({ workspaceRoot });
  writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log(`Collection locale gap report written: ${outputPath}`);
  console.log(
    `Collections: total=${report.totalCollections}, fullCoverage=${report.fullCoverageCollections}, gaps=${report.collectionsWithGaps}`,
  );
}

main();
