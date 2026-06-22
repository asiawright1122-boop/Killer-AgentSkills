#!/usr/bin/env npx tsx

import {
  renderCollectionLocalePunctuationReport,
  validateCollectionsDirectory,
} from './lib/collection-locale-punctuation';

function main() {
  const report = validateCollectionsDirectory();
  console.log(renderCollectionLocalePunctuationReport(report));

  if (report.issues.length > 0) {
    process.exitCode = 1;
  }
}

main();
