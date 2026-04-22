#!/usr/bin/env npx tsx

import {
  buildRecoveryControlBoardFromFiles,
  DEFAULT_RECOVERY_CONTROL_BOARD_JSON_PATH,
  DEFAULT_RECOVERY_CONTROL_BOARD_MD_PATH,
  writeRecoveryControlBoardArtifacts,
  renderRecoveryControlBoardReport,
} from './lib/recovery-control-board';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

async function main() {
  const stdoutOnly = process.argv.includes('--stdout-only');
  const report = buildRecoveryControlBoardFromFiles({
    scorecardJsonPath: readArg('--scorecard-json'),
    coverageJsonPath: readArg('--coverage-json'),
    trafficJsonPath: readArg('--traffic-json'),
  });

  if (!stdoutOnly) {
    writeRecoveryControlBoardArtifacts(report, {
      markdownOutputPath: readArg('--output') || DEFAULT_RECOVERY_CONTROL_BOARD_MD_PATH,
      jsonOutputPath: readArg('--json-output') || DEFAULT_RECOVERY_CONTROL_BOARD_JSON_PATH,
    });
  }

  console.log(renderRecoveryControlBoardReport(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
