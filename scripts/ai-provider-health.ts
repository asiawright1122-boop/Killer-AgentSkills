#!/usr/bin/env npx tsx

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  DEFAULT_AI_PROVIDER_PROBE_TREND_JSON_PATH,
  DEFAULT_AI_PROVIDER_PROBE_TREND_MD_PATH,
} from './lib/ai-provider-probe';
import {
  buildAiProviderHealthArtifacts,
  buildAiProviderHealthReport,
  DEFAULT_AI_PROVIDER_HEALTH_JSON_PATH,
  DEFAULT_AI_PROVIDER_HEALTH_MD_PATH,
  DEFAULT_AI_TELEMETRY_SUMMARY_MD_PATH,
  parseAiAlertSeverity,
} from './lib/ai-provider-health';
import { DEFAULT_AI_TREND_JSON_PATH, DEFAULT_AI_TREND_MD_PATH } from './lib/ai-telemetry-trend';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

function isMissingTelemetryCheckpointError(error: unknown): error is Error {
  return error instanceof Error && error.message.includes('No AI telemetry checkpoint found under');
}

function buildMissingCheckpointFallback(options: {
  checkpointArg?: string;
  failOnSeverity: ReturnType<typeof parseAiAlertSeverity>;
  reportsDir: string;
  generatedAt: string;
}) {
  const checkpointPath = options.checkpointArg
    ? resolve(process.cwd(), options.checkpointArg)
    : resolve(options.reportsDir, 'latest-ai-runtime-summary.json');

  const report = {
    generatedAt: options.generatedAt,
    reportsDir: options.reportsDir,
    checkpointPath,
    checkpointStatus: 'missing',
    checkpointBatch: null,
    checkpointCounts: {
      selected: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      skipped: 0,
    },
    gate: {
      failOnSeverity: options.failOnSeverity || 'none',
      blocking: false,
      blockingAlertCount: 0,
      blockingAlertCodes: [],
      blockingAlertTitles: [],
    },
    alertSummary: {
      total: 0,
      warningCount: 0,
      criticalCount: 0,
      highestSeverity: 'none',
      status: 'clear',
    },
    alerts: [],
    latestSnapshot: {
      timestamp: null,
      availableOrder: [],
      strongestNvidia: [],
      fallbackProviders: [],
      fallbackRouting: {
        policy: 'guarded',
        workloadProfile: 'balanced',
        backupPriorityOrder: [],
        backupsAllowed: false,
        activationReason: null,
        decision: 'providers_exhausted',
        decisionReason: 'No AI telemetry checkpoint was produced in this environment.',
        nvidiaConfigured: false,
        nvidiaAvailable: false,
        configuredBackupProviders: [],
        eligibleBackupProviders: [],
        pressureLabels: [],
        recentActivations: [],
      },
      quarantinedLabels: [],
      coolingDownProviders: [],
      hardDisabledProviders: [],
      workersAi: {
        usageFile: 'reports/seo/latest-ai-runtime-summary.json',
        model: 'n/a',
        callsThisRun: 0,
        dailyDate: '',
        dailyCalls: 0,
        dailyRemaining: null,
        runRemaining: null,
        maxCallsPerRun: null,
        maxCallsPerDay: null,
        maxTokens: null,
        canUse: false,
        status: 'disabled',
        blockedReason: 'No runtime probe checkpoint available.',
      },
      recentEvents: [],
    },
    telemetry: {
      timestamp: options.generatedAt,
      mode: {
        workersAi: process.env.WORKERS_AI_MODE || 'disabled',
        fallbackPolicy: process.env.AI_FALLBACK_POLICY || 'guarded',
        concurrencyLimit: 0,
        localeBatchSize: 0,
      },
      stats: {
        nvidia: 0,
        siliconflow: 0,
        openrouter: 0,
        cloudflare: 0,
        nvidiaFail: 0,
      },
      recentEvents: [],
      labelStats: [],
      availableProviders: [],
      quarantinedLabels: [],
      hardDisabledProviders: [],
      coolingDownProviders: [],
      fallbackRouting: {
        policy: process.env.AI_FALLBACK_POLICY || 'guarded',
        workloadProfile: 'balanced',
        backupPriorityOrder: [],
        backupsAllowed: false,
        activationReason: null,
        decision: 'providers_exhausted',
        decisionReason: 'No AI telemetry checkpoint was produced in this environment.',
        nvidiaConfigured: false,
        nvidiaAvailable: false,
        configuredBackupProviders: [],
        eligibleBackupProviders: [],
        pressureLabels: [],
        recentActivations: [],
      },
      workersAi: {
        usageFile: 'reports/seo/latest-ai-runtime-summary.json',
        model: 'n/a',
        callsThisRun: 0,
        dailyDate: '',
        dailyCalls: 0,
        dailyRemaining: null,
        runRemaining: null,
        maxCallsPerRun: null,
        maxCallsPerDay: null,
        maxTokens: null,
        canUse: false,
        status: 'disabled',
        blockedReason: 'No runtime probe checkpoint available.',
      },
    },
    trend: {
      generatedAt: options.generatedAt,
      reportsDir: options.reportsDir,
      sampleCount: 0,
      windowStart: null,
      windowEnd: null,
      latestSamplePath: null,
      latestSampleAgeHours: null,
      freshness: {
        status: 'unknown',
        warningThresholdHours: 36,
      },
      latestStatus: 'missing',
      latestAvailableOrder: [],
      latestWorkersAi: null,
      latestIssues: {
        quarantinedLabels: [],
        hardDisabledProviders: [],
      },
      alerts: [],
      alertSummary: {
        total: 0,
        warningCount: 0,
        criticalCount: 0,
        highestSeverity: 'none',
        status: 'clear',
      },
      strongestNvidia: [],
      unstableLabels: [],
      fallbackProviders: [],
      eventCounts: [],
      workersBudget: {
        minRunRemaining: null,
        minDailyRemaining: null,
        maxCallsThisRun: null,
        maxDailyCalls: null,
        unavailableSnapshots: 0,
      },
    },
    aiConfigGuard: {
      available: false,
      reportPath: null,
      status: 'missing',
      issueCount: 0,
      fallbackPolicy: process.env.AI_FALLBACK_POLICY || null,
      workersAiMode: process.env.WORKERS_AI_MODE || null,
      workersAiModel: null,
      backupPostures: {
        siliconflow: { posture: null, reason: null, source: null },
        openrouter: { posture: null, reason: null, source: null },
        cloudflare: { posture: null, reason: null, source: null },
      },
      openrouterModels: {
        runtime: null,
        translate: null,
        skillTry: null,
        script: null,
        probe: null,
      },
      issues: [],
      rejectedOverrides: [],
    },
    directProbe: {
      available: false,
      reportPath: null,
      generatedAt: null,
      ageHours: null,
      freshness: 'missing',
      warningThresholdHours: 24,
      summary: null,
      targets: null,
      guidance: ['No direct probe artifact found in this environment.'],
      workersAiReason: null,
      rateLimitedLabels: [],
      accessIssueLabels: [],
      results: [],
    },
    directProbeTrend: {
      generatedAt: options.generatedAt,
      reportsDir: options.reportsDir,
      sampleCount: 0,
      windowStart: null,
      windowEnd: null,
      latestReportPath: null,
      stableNvidia: [],
      weakBackups: [],
      frequentRateLimitedLabels: [],
    },
    routingGuidance: {
      preferredNvidia: [],
      preferredBackups: [],
      workersAiNote: null,
    },
    operatorControls: {
      routingDecision: 'providers_exhausted',
      routingReason: 'No AI telemetry checkpoint was produced in this environment.',
      actionSummary: 'Generate a runtime probe artifact before treating AI health output as actionable.',
      currentPressureLabels: [],
      historicalPressureLabels: [],
      workersAiGuardrail: null,
      aiConfigNote: 'AI config guard artifact is missing for this environment.',
      directProbeNote: 'No AI telemetry checkpoint was produced, so AI health was generated in degraded mode.',
    },
  } as unknown as ReturnType<typeof buildAiProviderHealthReport>;

  const healthMarkdown = [
    '# AI Provider Health',
    '',
    `- Generated at: ${options.generatedAt}`,
    `- Reports directory: ${options.reportsDir}`,
    `- Runtime checkpoint: ${checkpointPath}`,
    '- Status: degraded',
    '- Blocking alerts: 0',
    '',
    '## Notes',
    '',
    '- No AI telemetry checkpoint was found, so this report was generated in degraded mode.',
    '- This is expected in CI environments where no provider credentials are configured and the runtime probe is skipped.',
  ].join('\n');

  const telemetryMarkdown = [
    '# AI Telemetry Summary',
    '',
    `- Generated at: ${options.generatedAt}`,
    `- Checkpoint: ${checkpointPath}`,
    '- Status: missing runtime probe checkpoint',
    '- No provider telemetry was available in this environment.',
  ].join('\n');

  const trendMarkdown = [
    '# AI Telemetry Trend',
    '',
    `- Generated at: ${options.generatedAt}`,
    '- Samples analyzed: 0',
    '- Status: no telemetry samples found',
  ].join('\n');

  const probeTrendMarkdown = [
    '# AI Provider Probe Trend',
    '',
    `- Generated at: ${options.generatedAt}`,
    '- Samples analyzed: 0',
    '- Status: no provider probe samples found',
  ].join('\n');

  return {
    report,
    artifacts: {
      healthMarkdown,
      telemetryMarkdown,
      trendMarkdown,
      probeTrendMarkdown,
    },
  };
}

async function main() {
  const positionalPath = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
  const reportsDir = resolve(process.cwd(), readArg('--reports-dir') || 'reports/seo');
  const checkpointArg = readArg('--checkpoint-file') || positionalPath;
  const limitArg = readArg('--limit');
  const limit = limitArg ? Math.max(Number.parseInt(limitArg, 10) || 0, 0) : 20;
  const stdoutOnly = process.argv.includes('--stdout-only');
  const outputPath = resolve(process.cwd(), readArg('--output') || DEFAULT_AI_PROVIDER_HEALTH_MD_PATH);
  const jsonOutputPath = resolve(process.cwd(), readArg('--json-output') || DEFAULT_AI_PROVIDER_HEALTH_JSON_PATH);
  const telemetryOutputPath = resolve(
    process.cwd(),
    readArg('--telemetry-output') || DEFAULT_AI_TELEMETRY_SUMMARY_MD_PATH,
  );
  const trendOutputPath = resolve(process.cwd(), readArg('--trend-output') || DEFAULT_AI_TREND_MD_PATH);
  const trendJsonOutputPath = resolve(process.cwd(), readArg('--trend-json-output') || DEFAULT_AI_TREND_JSON_PATH);
  const probeTrendOutputPath = resolve(
    process.cwd(),
    readArg('--probe-trend-output') || DEFAULT_AI_PROVIDER_PROBE_TREND_MD_PATH,
  );
  const probeTrendJsonOutputPath = resolve(
    process.cwd(),
    readArg('--probe-trend-json-output') || DEFAULT_AI_PROVIDER_PROBE_TREND_JSON_PATH,
  );
  const failOnSeverity = parseAiAlertSeverity(readArg('--fail-on') || process.env.AI_ALERT_FAIL_ON_SEVERITY);
  const generatedAt = new Date().toISOString();

  let report: ReturnType<typeof buildAiProviderHealthReport>;
  let artifacts: ReturnType<typeof buildAiProviderHealthArtifacts>;

  try {
    report = buildAiProviderHealthReport({
      checkpointPath: checkpointArg,
      reportsDir,
      limit,
      failOnSeverity,
      generatedAt,
    });
    artifacts = buildAiProviderHealthArtifacts(report);
  } catch (error) {
    if (!isMissingTelemetryCheckpointError(error)) throw error;

    console.warn(error.message);
    console.warn('Generating degraded AI provider health artifacts so CI can continue without local probe output.');

    const fallback = buildMissingCheckpointFallback({
      checkpointArg,
      failOnSeverity,
      reportsDir,
      generatedAt,
    });

    report = fallback.report;
    artifacts = fallback.artifacts as ReturnType<typeof buildAiProviderHealthArtifacts>;
  }

  if (!stdoutOnly) {
    mkdirSync(dirname(outputPath), { recursive: true });
    mkdirSync(dirname(jsonOutputPath), { recursive: true });
    mkdirSync(dirname(telemetryOutputPath), { recursive: true });
    mkdirSync(dirname(trendOutputPath), { recursive: true });
    mkdirSync(dirname(trendJsonOutputPath), { recursive: true });
    mkdirSync(dirname(probeTrendOutputPath), { recursive: true });
    mkdirSync(dirname(probeTrendJsonOutputPath), { recursive: true });

    writeFileSync(outputPath, artifacts.healthMarkdown);
    writeFileSync(jsonOutputPath, JSON.stringify(report, null, 2));
    writeFileSync(telemetryOutputPath, artifacts.telemetryMarkdown);
    writeFileSync(trendOutputPath, artifacts.trendMarkdown);
    writeFileSync(trendJsonOutputPath, JSON.stringify(report.trend, null, 2));
    writeFileSync(probeTrendOutputPath, artifacts.probeTrendMarkdown);
    writeFileSync(probeTrendJsonOutputPath, JSON.stringify(report.directProbeTrend, null, 2));

    console.log(`Saved AI provider health report to ${outputPath}`);
    console.log(`Saved AI provider health data to ${jsonOutputPath}`);
    console.log(`Saved AI telemetry summary to ${telemetryOutputPath}`);
    console.log(`Saved AI telemetry trend report to ${trendOutputPath}`);
    console.log(`Saved AI telemetry trend data to ${trendJsonOutputPath}`);
    console.log(`Saved AI provider probe trend report to ${probeTrendOutputPath}`);
    console.log(`Saved AI provider probe trend data to ${probeTrendJsonOutputPath}`);
  }

  console.log('');
  console.log(artifacts.healthMarkdown);

  if (report.gate.blocking) {
    console.error('');
    console.error(
      `AI provider health gate triggered at severity >= ${report.gate.failOnSeverity}: ${report.gate.blockingAlertTitles.join('; ')}`,
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
