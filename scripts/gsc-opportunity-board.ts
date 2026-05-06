#!/usr/bin/env npx tsx

import {
  buildGscOpportunityBoardFromFiles,
  DEFAULT_GSC_OPPORTUNITY_BOARD_JSON_PATH,
  DEFAULT_GSC_OPPORTUNITY_BOARD_MD_PATH,
  renderGscOpportunityBoardReport,
  writeGscOpportunityBoardArtifacts,
} from './lib/gsc-opportunity-board';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

async function main() {
  const stdoutOnly = process.argv.includes('--stdout-only');
  const report = buildGscOpportunityBoardFromFiles({
    trafficJsonPath: readArg('--traffic-json'),
  });

  if (!stdoutOnly) {
    writeGscOpportunityBoardArtifacts(report, {
      markdownOutputPath: readArg('--output') || DEFAULT_GSC_OPPORTUNITY_BOARD_MD_PATH,
      jsonOutputPath: readArg('--json-output') || DEFAULT_GSC_OPPORTUNITY_BOARD_JSON_PATH,
    });
  }

  console.log(renderGscOpportunityBoardReport(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
