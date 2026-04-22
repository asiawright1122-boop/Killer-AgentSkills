#!/usr/bin/env npx tsx

import {
  buildRecoveryExperimentLadderFromFiles,
  DEFAULT_RECOVERY_EXPERIMENT_LADDER_JSON_PATH,
  DEFAULT_RECOVERY_EXPERIMENT_LADDER_MD_PATH,
  renderRecoveryExperimentLadderReport,
  writeRecoveryExperimentLadderArtifacts,
} from './lib/recovery-experiment-ladder';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

async function main() {
  const stdoutOnly = process.argv.includes('--stdout-only');
  const report = buildRecoveryExperimentLadderFromFiles({
    authorityUpliftScorecardJsonPath: readArg('--scorecard-json'),
    executionQueueJsonPath: readArg('--queue-json'),
    deltaBoardJsonPath: readArg('--delta-json'),
  });

  const finalizedReport = stdoutOnly
    ? report
    : writeRecoveryExperimentLadderArtifacts(report, {
        markdownOutputPath: readArg('--output') || DEFAULT_RECOVERY_EXPERIMENT_LADDER_MD_PATH,
        jsonOutputPath: readArg('--json-output') || DEFAULT_RECOVERY_EXPERIMENT_LADDER_JSON_PATH,
      });

  console.log(renderRecoveryExperimentLadderReport(finalizedReport));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
