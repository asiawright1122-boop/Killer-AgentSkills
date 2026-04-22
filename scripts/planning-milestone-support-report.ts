#!/usr/bin/env npx tsx

import {
  buildPlanningMilestoneSupportReport,
  renderMilestoneBootstrapReport,
  renderMilestoneCloseoutReport,
  renderMilestonesIndex,
  writePlanningMilestoneSupportArtifacts,
} from './lib/planning-milestone-support';
import { syncPlanningPhaseLifecycle } from './lib/planning-phase-lifecycle';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

async function main() {
  const rootDir = readArg('--root');
  const stdoutOnly = process.argv.includes('--stdout-only');
  const skipPhaseLifecycle = process.argv.includes('--skip-phase-lifecycle');

  if (!stdoutOnly && !skipPhaseLifecycle) {
    syncPlanningPhaseLifecycle({ rootDir });
  }

  const report = buildPlanningMilestoneSupportReport({ rootDir });

  if (!stdoutOnly) {
    writePlanningMilestoneSupportArtifacts(report, {
      milestonesIndexPath: readArg('--milestones-output'),
      bootstrapMarkdownPath: readArg('--bootstrap-output'),
      bootstrapJsonPath: readArg('--bootstrap-json-output'),
      closeoutMarkdownPath: readArg('--closeout-output'),
      closeoutJsonPath: readArg('--closeout-json-output'),
    });
  }

  console.log(renderMilestonesIndex(report));
  console.log('\n---\n');
  console.log(renderMilestoneBootstrapReport(report));
  console.log('\n---\n');
  console.log(renderMilestoneCloseoutReport(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
