import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  getSiblingAiTelemetrySummaryPath,
  loadAiTelemetryCheckpoint,
  renderAiTelemetryReport,
  resolveAiTelemetryCheckpoint,
  type TelemetryCheckpoint,
} from './ai-telemetry-report';
import type { AIProviderLabelTelemetry } from './ai';

const sampleCheckpoint = (): TelemetryCheckpoint => ({
  status: 'completed',
  batch: 4,
  startedAt: '2026-04-04T06:00:00.000Z',
  lastUpdated: '2026-04-04T06:20:00.000Z',
  completedIds: ['owner/repo/skill-a'],
  pendingIds: [],
  skippedIds: [],
  failedIds: [],
  aiTelemetry: {
    timestamp: '2026-04-04T06:20:00.000Z',
    mode: {
      workersAi: 'free-only',
      fallbackPolicy: 'cold',
      concurrencyLimit: 3,
      localeBatchSize: 3,
    },
    stats: {
      nvidia: 8,
      siliconflow: 1,
      openrouter: 0,
      cloudflare: 0,
      nvidiaFail: 2,
    },
    recentEvents: [
      {
        timestamp: '2026-04-04T06:18:00.000Z',
        type: 'provider_failure',
        provider: 'nvidia',
        label: 'N0',
        status: 429,
        detail: 'N0 hit 429',
      },
      {
        timestamp: '2026-04-04T06:19:00.000Z',
        type: 'provider_success',
        provider: 'nvidia',
        label: 'N1',
        detail: 'json response received',
      },
    ],
    labelStats: [
      {
        label: 'N0',
        provider: 'nvidia',
        selectionRank: 3,
        successCount: 1,
        failureCount: 2,
        consecutiveRetryableFailures: 2,
        consecutive429s: 1,
        lastStatus: 429,
        lastError: 'nvidia 429',
        lastEventAt: '2026-04-04T06:18:00.000Z',
        lastSuccessAt: '2026-04-04T06:10:00.000Z',
        lastFailureAt: '2026-04-04T06:18:00.000Z',
        currentlyAvailable: true,
        coolingDown: false,
        cooldownUntil: null,
        cooldownReason: null,
        quarantined: false,
        quarantinedAt: null,
        quarantineReason: null,
        hardDisabled: false,
        hardDisableReason: null,
      },
      {
        label: 'N1',
        provider: 'nvidia',
        selectionRank: 1,
        successCount: 4,
        failureCount: 0,
        consecutiveRetryableFailures: 0,
        consecutive429s: 0,
        lastStatus: null,
        lastError: null,
        lastEventAt: '2026-04-04T06:19:00.000Z',
        lastSuccessAt: '2026-04-04T06:19:00.000Z',
        lastFailureAt: null,
        currentlyAvailable: true,
        coolingDown: false,
        cooldownUntil: null,
        cooldownReason: null,
        quarantined: false,
        quarantinedAt: null,
        quarantineReason: null,
        hardDisabled: false,
        hardDisableReason: null,
      },
      {
        label: 'N2',
        provider: 'nvidia',
        selectionRank: 2,
        successCount: 3,
        failureCount: 0,
        consecutiveRetryableFailures: 0,
        consecutive429s: 0,
        lastStatus: null,
        lastError: null,
        lastEventAt: '2026-04-04T06:17:00.000Z',
        lastSuccessAt: '2026-04-04T06:17:00.000Z',
        lastFailureAt: null,
        currentlyAvailable: true,
        coolingDown: false,
        cooldownUntil: null,
        cooldownReason: null,
        quarantined: false,
        quarantinedAt: null,
        quarantineReason: null,
        hardDisabled: false,
        hardDisableReason: null,
      },
      {
        label: 'S',
        provider: 'siliconflow',
        selectionRank: 4,
        successCount: 1,
        failureCount: 0,
        consecutiveRetryableFailures: 0,
        consecutive429s: 0,
        lastStatus: null,
        lastError: null,
        lastEventAt: '2026-04-04T06:16:00.000Z',
        lastSuccessAt: '2026-04-04T06:16:00.000Z',
        lastFailureAt: null,
        currentlyAvailable: true,
        coolingDown: false,
        cooldownUntil: null,
        cooldownReason: null,
        quarantined: false,
        quarantinedAt: null,
        quarantineReason: null,
        hardDisabled: false,
        hardDisableReason: null,
      },
      {
        label: 'C',
        provider: 'cloudflare',
        selectionRank: null,
        successCount: 0,
        failureCount: 1,
        consecutiveRetryableFailures: 0,
        consecutive429s: 0,
        lastStatus: 429,
        lastError: 'cloudflare 429',
        lastEventAt: '2026-04-04T06:12:00.000Z',
        lastSuccessAt: null,
        lastFailureAt: '2026-04-04T06:12:00.000Z',
        currentlyAvailable: false,
        coolingDown: false,
        cooldownUntil: null,
        cooldownReason: null,
        quarantined: false,
        quarantinedAt: null,
        quarantineReason: null,
        hardDisabled: true,
        hardDisableReason: 'C:429',
      },
    ] as unknown as AIProviderLabelTelemetry[],
    availableProviders: [
      { label: 'N1', provider: 'nvidia' },
      { label: 'N2', provider: 'nvidia' },
      { label: 'N0', provider: 'nvidia' },
      { label: 'S', provider: 'siliconflow' },
    ],
    quarantinedLabels: [],
    hardDisabledProviders: [{ provider: 'cloudflare', reason: 'C:429' }],
    coolingDownProviders: [],
    fallbackRouting: {
      policy: 'cold',
      backupsAllowed: false,
      activationReason: null,
      nvidiaConfigured: true,
      nvidiaAvailable: true,
      configuredBackupProviders: ['siliconflow', 'cloudflare'],
      eligibleBackupProviders: [{ label: 'S', provider: 'siliconflow' }],
      recentActivations: [],
      decision: 'primary_preferred',
      decisionReason: 'No provider pressure is active.',
      pressureLabels: [],
    },
    workersAi: {
      usageFile: '.tmp/workers-ai-usage.json',
      model: '@cf/meta/llama-3.1-8b-instruct',
      callsThisRun: 12,
      dailyDate: '2026-04-04',
      dailyCalls: 52,
      dailyRemaining: 248,
      runRemaining: 68,
      maxCallsPerRun: 80,
      maxCallsPerDay: 300,
      maxTokens: 800,
      canUse: true,
      status: 'available',
      blockedReason: null,
    },
  },
});

describe('ai telemetry report', () => {
  it('renders a readable markdown summary from checkpoint telemetry', () => {
    const checkpoint = sampleCheckpoint();
    const report = renderAiTelemetryReport(checkpoint, '/tmp/checkpoint.json', '2026-04-04T06:30:00.000Z');

    expect(report).toContain('# AI Telemetry Summary');
    expect(report).toContain('Available order: N1:nvidia -> N2:nvidia -> N0:nvidia -> S:siliconflow');
    expect(report).toContain('Mode: free-only');
    expect(report).toContain('Fallback policy: cold');
    expect(report).toContain('N1 (#1) 4 ok, 0 fail');
    expect(report).toContain('Hard disabled cloudflare | C:429');
    expect(report).toContain('provider_failure');
  });

  it('resolves the newest checkpoint under reports dir that actually contains aiTelemetry', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-telemetry-report-'));
    const reportsDir = join(root, 'reports', 'seo');
    mkdirSync(reportsDir, { recursive: true });

    writeFileSync(join(reportsDir, 'ignore.json'), JSON.stringify({ status: 'completed' }, null, 2));
    const telemetryPath = join(reportsDir, 'batch-progress.latest.json');
    writeFileSync(telemetryPath, JSON.stringify(sampleCheckpoint(), null, 2));

    const resolved = resolveAiTelemetryCheckpoint(undefined, reportsDir);
    expect(resolved).toBe(telemetryPath);
    expect(loadAiTelemetryCheckpoint(resolved).aiTelemetry?.workersAi.model).toBe('@cf/meta/llama-3.1-8b-instruct');
  });

  it('prefers the checkpoint with the newest embedded telemetry timestamp over file ordering noise', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-telemetry-report-timestamp-'));
    const reportsDir = join(root, 'reports', 'seo');
    mkdirSync(reportsDir, { recursive: true });

    const older = sampleCheckpoint();
    older.lastUpdated = '2026-04-04T05:00:00.000Z';
    if (older.aiTelemetry) older.aiTelemetry.timestamp = '2026-04-04T05:00:00.000Z';

    const newer = sampleCheckpoint();
    newer.lastUpdated = '2026-04-04T09:00:00.000Z';
    if (newer.aiTelemetry) newer.aiTelemetry.timestamp = '2026-04-04T09:00:00.000Z';

    writeFileSync(join(reportsDir, 'zzz-old.json'), JSON.stringify(older, null, 2));
    const preferredPath = join(reportsDir, 'latest-ai-runtime-summary.json');
    writeFileSync(preferredPath, JSON.stringify(newer, null, 2));

    expect(resolveAiTelemetryCheckpoint(undefined, reportsDir)).toBe(preferredPath);
  });

  it('derives a sibling markdown summary path from checkpoint files', () => {
    expect(getSiblingAiTelemetrySummaryPath('/tmp/phase-02-batch-progress.json')).toBe(
      '/tmp/phase-02-batch-progress.summary.md',
    );
    expect(getSiblingAiTelemetrySummaryPath('/tmp/no-extension')).toBe('/tmp/no-extension.summary.md');
  });
});
