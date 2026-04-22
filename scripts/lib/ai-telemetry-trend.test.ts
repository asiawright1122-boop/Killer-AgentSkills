import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  buildAiTelemetryTrend,
  filterAiTelemetryAlertsAtOrAboveSeverity,
  listAiTelemetrySamples,
  renderAiTelemetryTrendReport,
  summarizeAiTelemetryAlerts,
} from './ai-telemetry-trend';
import type { TelemetryCheckpoint } from './ai-telemetry-report';

type ProviderName = NonNullable<
  NonNullable<TelemetryCheckpoint['aiTelemetry']>['availableProviders']
>[number]['provider'];
type LabelTelemetry = NonNullable<NonNullable<TelemetryCheckpoint['aiTelemetry']>['labelStats']>[number];

function label(
  entryLabel: string,
  provider: ProviderName,
  selectionRank: number | null,
  overrides: Partial<LabelTelemetry> = {},
): LabelTelemetry {
  return {
    label: entryLabel,
    provider,
    selectionRank,
    successCount: 0,
    failureCount: 0,
    consecutiveRetryableFailures: 0,
    consecutive429s: 0,
    lastStatus: null,
    lastError: null,
    lastEventAt: null,
    lastSuccessAt: null,
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
    ...overrides,
  };
}

function checkpoint(
  overrides: Partial<TelemetryCheckpoint> & {
    timestamp: string;
    availableOrder: Array<{ label: string; provider: ProviderName }>;
  },
): TelemetryCheckpoint {
  const { aiTelemetry: aiTelemetryOverrides, timestamp, availableOrder, ...checkpointOverrides } = overrides;
  return {
    status: 'completed',
    lastUpdated: timestamp,
    aiTelemetry: {
      timestamp,
      mode: {
        workersAi: 'free-only',
        fallbackPolicy: 'cold',
        concurrencyLimit: 3,
        localeBatchSize: 3,
      },
      stats: {
        nvidia: 1,
        siliconflow: 0,
        openrouter: 0,
        cloudflare: 0,
        nvidiaFail: 0,
      },
      recentEvents: [],
      labelStats: [],
      availableProviders: availableOrder,
      quarantinedLabels: [],
      hardDisabledProviders: [],
      coolingDownProviders: [],
      fallbackRouting: {
        policy: 'cold',
        backupsAllowed: false,
        activationReason: null,
        nvidiaConfigured: availableOrder.some((entry) => entry.provider === 'nvidia'),
        nvidiaAvailable: availableOrder.some((entry) => entry.provider === 'nvidia'),
        configuredBackupProviders: Array.from(
          new Set(availableOrder.filter((entry) => entry.provider !== 'nvidia').map((entry) => entry.provider)),
        ),
        eligibleBackupProviders: availableOrder
          .filter((entry) => entry.provider !== 'nvidia')
          .map((entry) => ({ label: entry.label, provider: entry.provider })),
        recentActivations: [],
      },
      workersAi: {
        usageFile: '.tmp/workers-ai-usage.json',
        model: '@cf/meta/llama-3.1-8b-instruct',
        callsThisRun: 0,
        dailyDate: '2026-04-04',
        dailyCalls: 0,
        dailyRemaining: 300,
        runRemaining: 80,
        maxCallsPerRun: 80,
        maxCallsPerDay: 300,
        maxTokens: 800,
        canUse: true,
        status: 'available',
        blockedReason: null,
      },
      ...aiTelemetryOverrides,
    },
    ...checkpointOverrides,
  };
}

function writeCheckpoint(reportsDir: string, filename: string, data: TelemetryCheckpoint): void {
  writeFileSync(join(reportsDir, filename), JSON.stringify(data, null, 2));
}

describe('ai telemetry trend', () => {
  it('collects samples, dedupes repeated snapshots, and renders an empty alert section when stable', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-telemetry-trend-'));
    const reportsDir = join(root, 'reports', 'seo');
    mkdirSync(reportsDir, { recursive: true });

    const sampleA = checkpoint({
      timestamp: '2026-04-04T06:12:00.000Z',
      availableOrder: [
        { label: 'N1', provider: 'nvidia' },
        { label: 'N0', provider: 'nvidia' },
        { label: 'S', provider: 'siliconflow' },
      ],
      aiTelemetry: {
        labelStats: [
          label('N0', 'nvidia', 3, {
            successCount: 1,
            failureCount: 2,
            consecutiveRetryableFailures: 2,
            consecutive429s: 1,
            lastStatus: 429,
            lastError: 'nvidia 429',
            lastEventAt: '2026-04-04T06:10:00.000Z',
            lastSuccessAt: '2026-04-04T06:00:00.000Z',
            lastFailureAt: '2026-04-04T06:10:00.000Z',
          }),
          label('N1', 'nvidia', 1, {
            successCount: 4,
            lastEventAt: '2026-04-04T06:11:00.000Z',
            lastSuccessAt: '2026-04-04T06:11:00.000Z',
          }),
          label('S', 'siliconflow', 4),
        ],
        recentEvents: [
          {
            timestamp: '2026-04-04T06:10:00.000Z',
            type: 'provider_failure' as const,
            provider: 'nvidia' as const,
            label: 'N0',
            status: 429,
            detail: 'nvidia 429',
          },
        ],
      },
    });

    const sampleB = checkpoint({
      timestamp: '2026-04-04T06:14:00.000Z',
      availableOrder: [
        { label: 'N1', provider: 'nvidia' },
        { label: 'N0', provider: 'nvidia' },
        { label: 'S', provider: 'siliconflow' },
      ],
      aiTelemetry: {
        labelStats: [
          label('N0', 'nvidia', null, {
            successCount: 1,
            failureCount: 2,
            consecutiveRetryableFailures: 2,
            consecutive429s: 1,
            lastStatus: 429,
            lastError: 'nvidia 429',
            lastEventAt: '2026-04-04T06:10:00.000Z',
            lastSuccessAt: '2026-04-04T06:00:00.000Z',
            lastFailureAt: '2026-04-04T06:10:00.000Z',
            currentlyAvailable: false,
            coolingDown: true,
            cooldownReason: 'N0:network',
          }),
          label('N1', 'nvidia', 1, {
            successCount: 5,
            lastEventAt: '2026-04-04T06:13:00.000Z',
            lastSuccessAt: '2026-04-04T06:13:00.000Z',
          }),
          label('S', 'siliconflow', 3),
        ],
        coolingDownProviders: [
          {
            label: 'N0',
            until: '2026-04-04T06:20:00.000Z',
            msRemaining: 6000,
            reason: 'N0:network',
          },
        ],
        workersAi: {
          usageFile: '.tmp/workers-ai-usage.json',
          model: '@cf/meta/llama-3.1-8b-instruct',
          callsThisRun: 12,
          dailyDate: '2026-04-04',
          dailyCalls: 45,
          dailyRemaining: 255,
          runRemaining: 68,
          maxCallsPerRun: 80,
          maxCallsPerDay: 300,
          maxTokens: 800,
          canUse: true,
        },
        recentEvents: [
          {
            timestamp: '2026-04-04T06:10:00.000Z',
            type: 'provider_failure' as const,
            provider: 'nvidia' as const,
            label: 'N0',
            status: 429,
            detail: 'nvidia 429',
          },
          {
            timestamp: '2026-04-04T06:13:00.000Z',
            type: 'provider_success' as const,
            provider: 'nvidia' as const,
            label: 'N1',
            detail: 'json response received',
          },
        ],
      },
    });

    writeCheckpoint(reportsDir, 'sample-a.json', sampleA);
    writeCheckpoint(reportsDir, 'sample-b.json', sampleB);
    writeCheckpoint(reportsDir, 'sample-b-dup.json', sampleB);

    const samples = listAiTelemetrySamples(reportsDir);
    expect(samples).toHaveLength(2);

    const trend = buildAiTelemetryTrend(samples, reportsDir, '2026-04-04T06:15:00.000Z');
    expect(trend.sampleCount).toBe(2);
    expect(trend.latestAvailableOrder).toEqual(['N1:nvidia', 'N0:nvidia', 'S:siliconflow']);
    expect(trend.strongestNvidia[0]?.label).toBe('N1');
    expect(trend.unstableLabels[0]?.label).toBe('N0');
    expect(trend.eventCounts).toEqual([
      { key: 'provider_failure@nvidia', count: 1 },
      { key: 'provider_success@nvidia', count: 1 },
    ]);
    expect(trend.workersBudget.minRunRemaining).toBe(68);
    expect(trend.workersBudget.maxCallsThisRun).toBe(12);
    expect(trend.alerts).toEqual([]);
    expect(trend.alertSummary).toEqual({
      total: 0,
      warningCount: 0,
      criticalCount: 0,
      highestSeverity: 'none',
      status: 'clear',
    });

    const report = renderAiTelemetryTrendReport(trend);
    expect(report).toContain('# AI Telemetry Trend');
    expect(report).toContain('## AI Alert Status');
    expect(report).toContain('Alert status: clear');
    expect(report).toContain('## AI Alerts');
    expect(report).toContain('No active AI alerts in the analyzed telemetry window');
    expect(report).toContain('Strongest NVIDIA Labels');
    expect(report).toContain('N1 (nvidia)');
    expect(report).toContain('N0 (nvidia)');
  });

  it('ignores policy-parked backups and suppresses stale NVIDIA volatility after the latest window recovers', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-telemetry-policy-parked-'));
    const reportsDir = join(root, 'reports', 'seo');
    mkdirSync(reportsDir, { recursive: true });

    for (const [index, timestamp] of [
      '2026-04-04T09:00:00.000Z',
      '2026-04-04T09:05:00.000Z',
      '2026-04-04T20:00:00.000Z',
    ].entries()) {
      const isLatest = index === 2;
      writeCheckpoint(
        reportsDir,
        `sample-${index}.json`,
        checkpoint({
          timestamp,
          availableOrder: [{ label: 'N1', provider: 'nvidia' }],
          aiTelemetry: {
            fallbackRouting: {
              policy: 'cold',
              workloadProfile: 'batch_generation',
              backupPriorityOrder: ['siliconflow', 'openrouter', 'cloudflare'],
              backupsAllowed: false,
              activationReason: null,
              decision: 'primary_preferred',
              decisionReason: 'NVIDIA capacity is available and backups are parked by policy.',
              nvidiaConfigured: true,
              nvidiaAvailable: true,
              configuredBackupProviders: ['siliconflow', 'openrouter'],
              eligibleBackupProviders: [],
              pressureLabels: [],
              recentActivations: [],
            },
            labelStats: [
              label('N1', 'nvidia', 1, {
                successCount: 5,
                lastSuccessAt: timestamp,
                lastEventAt: timestamp,
              }),
              label('S', 'siliconflow', null, {
                currentlyAvailable: false,
              }),
              label('O0', 'openrouter', null, {
                currentlyAvailable: false,
              }),
            ],
            recentEvents: isLatest
              ? [
                  {
                    timestamp,
                    type: 'provider_success' as const,
                    provider: 'nvidia' as const,
                    label: 'N1',
                    detail: 'response received',
                  },
                ]
              : [
                  {
                    timestamp,
                    type: 'provider_failure' as const,
                    provider: 'nvidia' as const,
                    label: 'N0',
                    status: 429,
                    detail: `old nvidia failure ${index}`,
                  },
                  {
                    timestamp: timestamp.replace(':00.000Z', ':30.000Z'),
                    type: 'provider_cooldown' as const,
                    provider: 'nvidia' as const,
                    label: 'N0',
                    detail: `old nvidia cooldown ${index}`,
                  },
                ],
          },
        }),
      );
    }

    const trend = buildAiTelemetryTrend(listAiTelemetrySamples(reportsDir), reportsDir, '2026-04-04T20:10:00.000Z');

    expect(trend.fallbackProviders.find((entry) => entry.label === 'S')?.issueSnapshots).toBe(0);
    expect(trend.fallbackProviders.find((entry) => entry.label === 'O0')?.issueSnapshots).toBe(0);
    expect(trend.alerts.map((alert) => alert.code)).not.toContain('nvidia_instability_window');

    const report = renderAiTelemetryTrendReport(trend);
    expect(report).not.toContain('Historical NVIDIA volatility detected');
    expect(report).toContain('S (siliconflow)');
    expect(report).toContain('policy-parked');
  });

  it('derives actionable alerts from latest snapshot issues, workers exhaustion, and noisy NVIDIA history', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-telemetry-alerts-'));
    const reportsDir = join(root, 'reports', 'seo');
    mkdirSync(reportsDir, { recursive: true });

    for (let index = 0; index < 4; index += 1) {
      const minutePrefix = 10 + index;
      const timestamp = `2026-04-04T07:${minutePrefix}:00.000Z`;
      const isLatest = index === 3;

      writeCheckpoint(
        reportsDir,
        `sample-${index}.json`,
        checkpoint({
          timestamp,
          availableOrder: isLatest
            ? [
                { label: 'N1', provider: 'nvidia' },
                { label: 'S', provider: 'siliconflow' },
              ]
            : [
                { label: 'N0', provider: 'nvidia' },
                { label: 'N1', provider: 'nvidia' },
                { label: 'S', provider: 'siliconflow' },
                { label: 'O0', provider: 'openrouter' },
              ],
          aiTelemetry: {
            labelStats: [
              label('N0', 'nvidia', isLatest ? null : 1, {
                successCount: 5 - index,
                failureCount: index,
                lastStatus: isLatest ? 429 : null,
                lastError: isLatest ? 'nvidia 429 burst' : null,
                lastFailureAt: isLatest ? timestamp : null,
                lastEventAt: timestamp,
                currentlyAvailable: !isLatest,
                quarantined: isLatest,
                quarantinedAt: isLatest ? timestamp : null,
                quarantineReason: isLatest ? 'N0:429' : null,
              }),
              label('N1', 'nvidia', 2, {
                successCount: 6,
                lastEventAt: timestamp,
                lastSuccessAt: timestamp,
              }),
              label('S', 'siliconflow', 3),
              label('O0', 'openrouter', isLatest ? null : 4, {
                currentlyAvailable: !isLatest,
                hardDisabled: isLatest,
                hardDisableReason: isLatest ? '401 invalid key' : null,
              }),
            ],
            quarantinedLabels: isLatest
              ? [
                  {
                    label: 'N0',
                    provider: 'nvidia',
                    reason: 'N0:429',
                    quarantinedAt: timestamp,
                  },
                ]
              : [],
            hardDisabledProviders: isLatest
              ? [
                  {
                    provider: 'openrouter',
                    reason: '401 invalid key',
                  },
                ]
              : [],
            recentEvents: [
              {
                timestamp: `2026-04-04T07:${minutePrefix}:01.000Z`,
                type: 'provider_failure' as const,
                provider: 'nvidia' as const,
                label: 'N0',
                status: 429,
                detail: `N0 429 burst ${index}`,
              },
              {
                timestamp: `2026-04-04T07:${minutePrefix}:02.000Z`,
                type: 'provider_cooldown' as const,
                provider: 'nvidia' as const,
                label: 'N0',
                detail: `N0 cooldown ${index}`,
              },
              {
                timestamp: `2026-04-04T07:${minutePrefix}:03.000Z`,
                type: 'provider_failure' as const,
                provider: 'nvidia' as const,
                label: 'N1',
                status: 429,
                detail: `N1 429 burst ${index}`,
              },
              {
                timestamp: `2026-04-04T07:${minutePrefix}:04.000Z`,
                type: 'provider_cooldown' as const,
                provider: 'nvidia' as const,
                label: 'N1',
                detail: `N1 cooldown ${index}`,
              },
              ...(isLatest
                ? [
                    {
                      timestamp: `2026-04-04T07:${minutePrefix}:05.000Z`,
                      type: 'workers_budget_exhausted' as const,
                      detail: 'Workers AI free-tier exhausted',
                    },
                  ]
                : []),
            ],
            workersAi: {
              usageFile: '.tmp/workers-ai-usage.json',
              model: '@cf/meta/llama-3.1-8b-instruct',
              callsThisRun: isLatest ? 80 : 20 + index,
              dailyDate: '2026-04-04',
              dailyCalls: isLatest ? 281 : 40 + index,
              dailyRemaining: isLatest ? 19 : 260 - index,
              runRemaining: isLatest ? 0 : 60 - index,
              maxCallsPerRun: 80,
              maxCallsPerDay: 300,
              maxTokens: 800,
              canUse: !isLatest,
            },
          },
        }),
      );
    }

    const trend = buildAiTelemetryTrend(listAiTelemetrySamples(reportsDir), reportsDir, '2026-04-04T07:30:00.000Z');

    expect(trend.latestIssues.quarantinedLabels).toEqual([
      {
        label: 'N0',
        provider: 'nvidia',
        reason: 'N0:429',
        at: '2026-04-04T07:13:00.000Z',
      },
    ]);
    expect(trend.latestIssues.hardDisabledProviders).toEqual([
      {
        provider: 'openrouter',
        reason: '401 invalid key',
      },
    ]);
    expect(trend.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'latest_hard_disabled_providers',
          severity: 'critical',
        }),
        expect.objectContaining({
          code: 'latest_quarantined_labels',
          severity: 'warning',
        }),
        expect.objectContaining({
          code: 'nvidia_instability_window',
          severity: 'warning',
        }),
        expect.objectContaining({
          code: 'workers_budget_exhausted',
          severity: 'warning',
        }),
      ]),
    );
    expect(filterAiTelemetryAlertsAtOrAboveSeverity(trend.alerts, 'critical').map((alert) => alert.code)).toEqual([
      'latest_hard_disabled_providers',
    ]);
    expect(filterAiTelemetryAlertsAtOrAboveSeverity(trend.alerts, 'warning')).toHaveLength(4);
    expect(summarizeAiTelemetryAlerts(trend.alerts)).toEqual({
      total: 4,
      warningCount: 3,
      criticalCount: 1,
      highestSeverity: 'critical',
      status: 'blocking',
    });
    expect(trend.alertSummary).toEqual({
      total: 4,
      warningCount: 3,
      criticalCount: 1,
      highestSeverity: 'critical',
      status: 'blocking',
    });

    const report = renderAiTelemetryTrendReport(trend);
    expect(report).toContain('## AI Alert Status');
    expect(report).toContain('Alert status: blocking');
    expect(report).toContain('## AI Alerts');
    expect(report).toContain('[CRITICAL] Hard-disabled AI providers present in latest snapshot');
    expect(report).toContain('[WARNING] Quarantined provider labels present in latest snapshot');
    expect(report).toContain('[WARNING] Historical NVIDIA volatility detected');
    expect(report).toContain('[WARNING] Workers AI free-tier budget exhausted');
  });

  it('raises a critical alert when provider rotation is exhausted', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-telemetry-providers-unavailable-'));
    const reportsDir = join(root, 'reports', 'seo');
    mkdirSync(reportsDir, { recursive: true });

    writeCheckpoint(
      reportsDir,
      'sample.json',
      checkpoint({
        timestamp: '2026-04-04T08:00:00.000Z',
        availableOrder: [],
        aiTelemetry: {
          labelStats: [
            label('N0', 'nvidia', null, {
              currentlyAvailable: false,
              failureCount: 3,
              lastStatus: 503,
              lastError: 'provider unavailable',
              lastFailureAt: '2026-04-04T08:00:00.000Z',
            }),
          ],
          recentEvents: [
            {
              timestamp: '2026-04-04T08:00:05.000Z',
              type: 'providers_unavailable' as const,
              detail: 'All providers unavailable',
            },
          ],
          workersAi: {
            usageFile: '.tmp/workers-ai-usage.json',
            model: '@cf/meta/llama-3.1-8b-instruct',
            callsThisRun: 0,
            dailyDate: '2026-04-04',
            dailyCalls: 0,
            dailyRemaining: 300,
            runRemaining: 80,
            maxCallsPerRun: 80,
            maxCallsPerDay: 300,
            maxTokens: 800,
            canUse: true,
          },
        },
      }),
    );

    const trend = buildAiTelemetryTrend(listAiTelemetrySamples(reportsDir), reportsDir, '2026-04-04T08:10:00.000Z');

    expect(trend.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'providers_unavailable',
          severity: 'critical',
        }),
      ]),
    );
    expect(trend.alertSummary.status).toBe('blocking');
    expect(renderAiTelemetryTrendReport(trend)).toContain('[CRITICAL] Provider rotation exhausted');
  });

  it('warns when the latest telemetry checkpoint is stale even if provider health is otherwise clear', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-telemetry-stale-'));
    const reportsDir = join(root, 'reports', 'seo');
    mkdirSync(reportsDir, { recursive: true });

    writeCheckpoint(
      reportsDir,
      'latest-ai-runtime-summary.json',
      checkpoint({
        timestamp: '2026-04-01T08:00:00.000Z',
        availableOrder: [{ label: 'N0', provider: 'nvidia' }],
        aiTelemetry: {
          labelStats: [label('N0', 'nvidia', 1, { successCount: 3, lastSuccessAt: '2026-04-01T08:00:00.000Z' })],
          recentEvents: [
            {
              timestamp: '2026-04-01T08:00:00.000Z',
              type: 'provider_success' as const,
              provider: 'nvidia' as const,
              label: 'N0',
              detail: 'response received',
            },
          ],
        },
      }),
    );

    const trend = buildAiTelemetryTrend(listAiTelemetrySamples(reportsDir), reportsDir, '2026-04-03T21:00:00.000Z');

    expect(trend.freshness.status).toBe('warning');
    expect(trend.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'latest_checkpoint_stale',
          severity: 'warning',
        }),
      ]),
    );
    const report = renderAiTelemetryTrendReport(trend);
    expect(report).toContain('Freshness: warning');
    expect(report).toContain('[WARNING] Latest AI telemetry checkpoint is stale');
  });
});
