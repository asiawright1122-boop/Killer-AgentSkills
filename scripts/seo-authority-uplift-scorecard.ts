#!/usr/bin/env npx tsx

import {
  buildAuthorityUpliftScorecardFromFiles,
  DEFAULT_AUTHORITY_UPLIFT_SCORECARD_JSON_PATH,
  DEFAULT_AUTHORITY_UPLIFT_SCORECARD_MD_PATH,
  renderAuthorityUpliftScorecardReport,
  writeAuthorityUpliftScorecardArtifacts,
} from './lib/authority-uplift-scorecard';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

async function main() {
  const stdoutOnly = process.argv.includes('--stdout-only');
  const report = buildAuthorityUpliftScorecardFromFiles({
    deltaBoardJsonPath: readArg('--delta-json'),
    authorityProgramJsonPath: readArg('--authority-json'),
    authoritySurfacesJsonPath: readArg('--authority-surfaces-json'),
    trafficReportJsonPath: readArg('--traffic-json'),
    snapshotDir: readArg('--snapshot-dir'),
  });

  const finalizedReport = stdoutOnly
    ? report
    : writeAuthorityUpliftScorecardArtifacts(report, {
        markdownOutputPath: readArg('--output') || DEFAULT_AUTHORITY_UPLIFT_SCORECARD_MD_PATH,
        jsonOutputPath: readArg('--json-output') || DEFAULT_AUTHORITY_UPLIFT_SCORECARD_JSON_PATH,
      });

  console.log(renderAuthorityUpliftScorecardReport(finalizedReport));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
