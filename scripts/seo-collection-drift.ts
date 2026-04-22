#!/usr/bin/env npx tsx

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSeoCollectionDriftReport } from './lib/seo-collection-drift';

const workspaceRoot = process.cwd();
const outputPath = resolve(workspaceRoot, 'data/seo-collection-drift.json');

function main() {
  const report = buildSeoCollectionDriftReport({ workspaceRoot });
  writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log(`Collection drift report written: ${outputPath}`);
  console.log(`Collections: total=${report.totalCollections}, issues=${report.totalIssues}`);

  if (report.totalIssues === 0) {
    console.log('Collection drift report passed with no issues');
    return;
  }

  for (const [code, count] of Object.entries(report.issuesByCode).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`- ${code}: ${count}`);
  }

  for (const item of report.items.slice(0, 80)) {
    console.log(`- ${item.file} [${item.code}] ${item.message}`);
  }

  if (report.items.length > 80) {
    console.log(`- ...and ${report.items.length - 80} more issue(s)`);
  }
}

main();
