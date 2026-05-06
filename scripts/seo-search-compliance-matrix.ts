#!/usr/bin/env npx tsx

import {
  buildSearchComplianceMatrixReportFromFiles,
  DEFAULT_SEARCH_COMPLIANCE_MATRIX_JSON_PATH,
  DEFAULT_SEARCH_COMPLIANCE_MATRIX_MD_PATH,
  renderSearchComplianceMatrixReport,
  writeSearchComplianceMatrixArtifacts,
} from './lib/search-compliance-matrix';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

function main() {
  const stdoutOnly = process.argv.includes('--stdout-only');
  const report = buildSearchComplianceMatrixReportFromFiles({
    crawlHealthJsonPath: readArg('--crawl-json'),
    coverageJsonPath: readArg('--coverage-json'),
    trafficJsonPath: readArg('--traffic-json'),
    proofWindowJsonPath: readArg('--proof-json'),
    authorityJsonPath: readArg('--authority-json'),
    experimentLadderJsonPath: readArg('--experiment-json'),
    guidelineResearchPath: readArg('--guidelines'),
  });

  const finalizedReport = stdoutOnly
    ? report
    : writeSearchComplianceMatrixArtifacts(report, {
        markdownOutputPath: readArg('--output') || DEFAULT_SEARCH_COMPLIANCE_MATRIX_MD_PATH,
        jsonOutputPath: readArg('--json-output') || DEFAULT_SEARCH_COMPLIANCE_MATRIX_JSON_PATH,
      });

  console.log(renderSearchComplianceMatrixReport(finalizedReport));
}

main();
