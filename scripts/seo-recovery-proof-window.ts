#!/usr/bin/env npx tsx

import {
  buildRecoveryProofWindowFromFiles,
  DEFAULT_RECOVERY_PROOF_WINDOW_JSON_PATH,
  DEFAULT_RECOVERY_PROOF_WINDOW_MD_PATH,
  renderRecoveryProofWindowReport,
  writeRecoveryProofWindowArtifacts,
} from './lib/recovery-proof-window';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

async function main() {
  const stdoutOnly = process.argv.includes('--stdout-only');
  const report = buildRecoveryProofWindowFromFiles({
    proofWindowDir: readArg('--proof-dir'),
    baselineJsonPath: readArg('--baseline-json'),
    trafficJsonPath: readArg('--traffic-json'),
    coverageJsonPath: readArg('--coverage-json'),
    scorecardJsonPath: readArg('--scorecard-json'),
    controlBoardJsonPath: readArg('--board-json'),
    executionQueueJsonPath: readArg('--queue-json'),
    authorityJsonPath: readArg('--authority-json'),
  });

  const finalizedReport = stdoutOnly
    ? report
    : writeRecoveryProofWindowArtifacts(report, {
        markdownOutputPath: readArg('--output') || DEFAULT_RECOVERY_PROOF_WINDOW_MD_PATH,
        jsonOutputPath: readArg('--json-output') || DEFAULT_RECOVERY_PROOF_WINDOW_JSON_PATH,
        proofWindowDir: readArg('--proof-dir'),
        baselineJsonPath: readArg('--baseline-json'),
      });

  console.log(renderRecoveryProofWindowReport(finalizedReport));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
