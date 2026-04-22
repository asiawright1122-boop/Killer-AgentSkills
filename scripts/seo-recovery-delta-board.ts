#!/usr/bin/env npx tsx

import {
  buildRecoveryDeltaBoardFromFiles,
  DEFAULT_RECOVERY_DELTA_BOARD_JSON_PATH,
  DEFAULT_RECOVERY_DELTA_BOARD_MD_PATH,
  renderRecoveryDeltaBoardReport,
  writeRecoveryDeltaBoardArtifacts,
} from './lib/recovery-delta-board';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

async function main() {
  const stdoutOnly = process.argv.includes('--stdout-only');
  const report = buildRecoveryDeltaBoardFromFiles({
    proofWindowJsonPath: readArg('--proof-json'),
    controlBoardJsonPath: readArg('--board-json'),
    baselineControlBoardJsonPath: readArg('--baseline-board-json'),
    authorityProgramJsonPath: readArg('--authority-json'),
    baselineAuthorityProgramJsonPath: readArg('--baseline-authority-json'),
    authoritySurfacesJsonPath: readArg('--authority-surfaces-json'),
  });

  const finalizedReport = stdoutOnly
    ? report
    : writeRecoveryDeltaBoardArtifacts(report, {
        markdownOutputPath: readArg('--output') || DEFAULT_RECOVERY_DELTA_BOARD_MD_PATH,
        jsonOutputPath: readArg('--json-output') || DEFAULT_RECOVERY_DELTA_BOARD_JSON_PATH,
      });

  console.log(renderRecoveryDeltaBoardReport(finalizedReport));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
