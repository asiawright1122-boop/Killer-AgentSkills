#!/usr/bin/env npx tsx

import {
  renderCollectionLocalePunctuationReport,
  validateCollectionsDirectory,
  fixCollectionsDirectory,
} from './lib/collection-locale-punctuation';

function main() {
  const shouldFix = process.argv.includes('--fix');
  if (shouldFix) {
    console.log('🔧 Auto-fixing CJK typography and punctuation in collections...');
    const fixedCount = fixCollectionsDirectory();
    console.log(`✅ Fixed ${fixedCount} collection file(s).`);
  }

  const report = validateCollectionsDirectory();
  console.log(renderCollectionLocalePunctuationReport(report));

  if (report.issues.length > 0) {
    process.exitCode = 1;
  }
}

main();
