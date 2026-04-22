#!/usr/bin/env npx tsx

import {
  buildOperatorRemediationHandoffReport,
  buildOperatorOpsSummaryReport,
  buildOperatorRemediationReport,
  DEFAULT_AI_HEALTH_JSON_PATH,
  DEFAULT_CONTENT_GOVERNANCE_JSON_PATH,
  DEFAULT_OPS_HANDOFF_JSON_PATH,
  DEFAULT_OPS_HANDOFF_MD_PATH,
  DEFAULT_OPS_REMEDIATION_JSON_PATH,
  DEFAULT_OPS_REMEDIATION_MD_PATH,
  DEFAULT_OPS_SUMMARY_JSON_PATH,
  DEFAULT_OPS_SUMMARY_MD_PATH,
  parseOperatorRemediationHandoffMode,
  parseOperatorRemediationThreshold,
  renderOperatorOpsSummaryReport,
  writeOperatorOpsArtifacts,
} from './lib/operator-ops-summary';
import { DEFAULT_AI_CONFIG_GUARD_JSON_PATH } from './lib/ai-config-guard';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

async function main() {
  const stdoutOnly = process.argv.includes('--stdout-only');
  const aiConfigJsonPath = readArg('--ai-config-json') || DEFAULT_AI_CONFIG_GUARD_JSON_PATH;
  const aiHealthJsonPath = readArg('--ai-json') || DEFAULT_AI_HEALTH_JSON_PATH;
  const contentGovernanceJsonPath = readArg('--governance-json') || DEFAULT_CONTENT_GOVERNANCE_JSON_PATH;
  const aiThreshold = parseOperatorRemediationThreshold(
    readArg('--ai-threshold') || process.env.OPS_REMEDIATION_AI_THRESHOLD || 'warning',
  );
  const governanceThreshold = parseOperatorRemediationThreshold(
    readArg('--governance-threshold') || process.env.OPS_REMEDIATION_GOVERNANCE_THRESHOLD || 'warning',
  );
  const handoffMode = parseOperatorRemediationHandoffMode(
    readArg('--handoff-mode') || process.env.OPS_HANDOFF_MODE || 'none',
  );
  const handoffOwner = readArg('--handoff-owner') || process.env.OPS_HANDOFF_OWNER || process.env.GITHUB_OWNER || '';
  const handoffRepo = readArg('--handoff-repo') || process.env.OPS_HANDOFF_REPO || process.env.GITHUB_REPO || '';
  const handoffBaseBranch = readArg('--handoff-base-branch') || process.env.OPS_HANDOFF_BASE_BRANCH || 'main';
  const handoffLabels = readArg('--handoff-labels') || process.env.OPS_HANDOFF_LABELS || '';
  const handoffOutputPath = readArg('--handoff-output') || DEFAULT_OPS_HANDOFF_MD_PATH;
  const handoffJsonOutputPath = readArg('--handoff-json-output') || DEFAULT_OPS_HANDOFF_JSON_PATH;

  const remediation = buildOperatorRemediationReport({
    aiThreshold,
    governanceThreshold,
    aiConfigJsonPath,
    aiHealthJsonPath,
    contentGovernanceJsonPath,
  });
  const handoff = buildOperatorRemediationHandoffReport({
    remediationReport: remediation,
    mode: handoffMode,
    owner: handoffOwner,
    repo: handoffRepo,
    baseBranch: handoffBaseBranch,
    labels: handoffLabels,
    previousHandoffJsonPath: handoffJsonOutputPath,
    aiConfigJsonPath,
    aiHealthJsonPath,
    contentGovernanceJsonPath,
  });
  const summary = buildOperatorOpsSummaryReport({
    remediationReport: remediation,
    handoffReport: handoff,
    aiThreshold,
    governanceThreshold,
    aiConfigJsonPath,
    aiHealthJsonPath,
    contentGovernanceJsonPath,
  });

  if (!stdoutOnly) {
    writeOperatorOpsArtifacts(summary, remediation, handoff, {
      summaryOutputPath: readArg('--output') || DEFAULT_OPS_SUMMARY_MD_PATH,
      summaryJsonOutputPath: readArg('--json-output') || DEFAULT_OPS_SUMMARY_JSON_PATH,
      remediationOutputPath: readArg('--remediation-output') || DEFAULT_OPS_REMEDIATION_MD_PATH,
      remediationJsonOutputPath: readArg('--remediation-json-output') || DEFAULT_OPS_REMEDIATION_JSON_PATH,
      handoffOutputPath,
      handoffJsonOutputPath,
    });
  }

  console.log(renderOperatorOpsSummaryReport(summary));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
