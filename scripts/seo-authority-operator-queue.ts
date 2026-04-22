#!/usr/bin/env npx tsx

import {
  buildAuthorityOperatorQueueFromFiles,
  DEFAULT_AUTHORITY_OPERATOR_QUEUE_JSON_PATH,
  DEFAULT_AUTHORITY_OPERATOR_QUEUE_MD_PATH,
  renderAuthorityOperatorQueueReport,
  writeAuthorityOperatorQueueArtifacts,
} from './lib/authority-operator-queue';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

async function main() {
  const stdoutOnly = process.argv.includes('--stdout-only');
  const report = buildAuthorityOperatorQueueFromFiles({
    scorecardJsonPath: readArg('--scorecard-json'),
    deltaBoardJsonPath: readArg('--delta-json'),
    authoritySurfacesJsonPath: readArg('--authority-surfaces-json'),
  });

  const finalizedReport = stdoutOnly
    ? report
    : writeAuthorityOperatorQueueArtifacts(report, {
        markdownOutputPath: readArg('--output') || DEFAULT_AUTHORITY_OPERATOR_QUEUE_MD_PATH,
        jsonOutputPath: readArg('--json-output') || DEFAULT_AUTHORITY_OPERATOR_QUEUE_JSON_PATH,
      });

  console.log(renderAuthorityOperatorQueueReport(finalizedReport));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
