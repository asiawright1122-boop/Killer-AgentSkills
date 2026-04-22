import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import type { AiConfigGuardReport } from './ai-config-guard';
import { buildAiProviderHealthReport, renderAiProviderHealthReport } from './ai-provider-health';
import type { AIProviderProbeReport } from './ai-provider-probe';
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
    recentRetryableFailureCount: 0,
    recent429Count: 0,
    recentCooldownCount: 0,
    lastPressureAt: null,
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
        workloadProfile: 'batch_generation',
        backupPriorityOrder: ['siliconflow', 'openrouter', 'cloudflare'],
        backupsAllowed: false,
        activationReason: null,
        decision: 'primary_preferred',
        decisionReason: 'No provider pressure is active.',
        nvidiaConfigured: availableOrder.some((entry) => entry.provider === 'nvidia'),
        nvidiaAvailable: availableOrder.some((entry) => entry.provider === 'nvidia'),
        configuredBackupProviders: Array.from(
          new Set(availableOrder.filter((entry) => entry.provider !== 'nvidia').map((entry) => entry.provider)),
        ),
        eligibleBackupProviders: availableOrder
          .filter((entry) => entry.provider !== 'nvidia')
          .map((entry) => ({ label: entry.label, provider: entry.provider })),
        pressureLabels: [],
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

function writeProbe(reportsDir: string, data: AIProviderProbeReport): void {
  writeFileSync(join(reportsDir, 'latest-ai-provider-probe.json'), JSON.stringify(data, null, 2));
}

function writeProbeHistory(reportsDir: string, filename: string, data: AIProviderProbeReport): void {
  const historyDir = join(reportsDir, 'ai-provider-probe-history');
  mkdirSync(historyDir, { recursive: true });
  writeFileSync(join(historyDir, filename), JSON.stringify(data, null, 2));
}

function writeAiConfigGuard(reportsDir: string, overrides: Partial<AiConfigGuardReport> = {}): void {
  const report: AiConfigGuardReport = {
    workersAiMode: 'free-only',
    fallbackPolicy: 'guarded',
    workersAiModel: '@cf/meta/llama-3.1-8b-instruct',
    providerModels: {
      runtime: {
        nvidia: { model: 'meta/llama-3.1-70b-instruct', source: 'default', envKey: null, rejectedOverride: null },
        siliconflow: { model: 'Qwen/Qwen2.5-72B-Instruct', source: 'default', envKey: null, rejectedOverride: null },
        openrouter: { model: 'google/gemini-2.5-flash', source: 'default', envKey: null, rejectedOverride: null },
      },
      translate: {
        nvidia: { model: 'meta/llama-3.1-70b-instruct', source: 'default', envKey: null, rejectedOverride: null },
        siliconflow: { model: 'Qwen/Qwen2.5-72B-Instruct', source: 'default', envKey: null, rejectedOverride: null },
        openrouter: { model: 'google/gemini-2.5-flash', source: 'default', envKey: null, rejectedOverride: null },
      },
      skill_try: {
        nvidia: { model: 'deepseek-ai/deepseek-v3.1', source: 'default', envKey: null, rejectedOverride: null },
        siliconflow: { model: 'DeepSeek/DeepSeek-V3', source: 'default', envKey: null, rejectedOverride: null } as any,
        openrouter: {
          model: 'google/gemma-3-27b-it:free',
          source: 'default',
          envKey: null,
          rejectedOverride: { envKey: 'OPENROUTER_MODEL', model: 'google/gemini-2.5-flash' },
        },
      },
      script: {
        nvidia: { model: 'meta/llama-3.3-70b-instruct', source: 'default', envKey: null, rejectedOverride: null },
        siliconflow: { model: 'Qwen/Qwen2.5-72B-Instruct', source: 'default', envKey: null, rejectedOverride: null },
        openrouter: { model: 'google/gemini-2.5-flash', source: 'default', envKey: null, rejectedOverride: null },
      },
      probe: {
        nvidia: { model: 'meta/llama-3.3-70b-instruct', source: 'default', envKey: null, rejectedOverride: null },
        siliconflow: { model: 'Qwen/Qwen2.5-72B-Instruct', source: 'default', envKey: null, rejectedOverride: null },
        openrouter: { model: 'google/gemini-2.5-flash', source: 'default', envKey: null, rejectedOverride: null },
      },
    },
    backupProviderPostures: {
      siliconflow: {
        provider: 'siliconflow',
        posture: 'standby',
        reason: null,
        envKey: 'AI_BACKUP_SILICONFLOW_POSTURE',
        reasonEnvKey: 'AI_BACKUP_SILICONFLOW_REASON',
        source: 'default',
      },
      openrouter: {
        provider: 'openrouter',
        posture: 'standby',
        reason: null,
        envKey: 'AI_BACKUP_OPENROUTER_POSTURE',
        reasonEnvKey: 'AI_BACKUP_OPENROUTER_REASON',
        source: 'default',
      },
      cloudflare: {
        provider: 'cloudflare',
        posture: 'burst-only',
        reason: 'Workers AI remains a free-only last-resort backup during recovery.',
        envKey: 'AI_BACKUP_CLOUDFLARE_POSTURE',
        reasonEnvKey: 'AI_BACKUP_CLOUDFLARE_REASON',
        source: 'default',
      },
    },
    workersAiMaxCallsPerRun: 60,
    workersAiMaxCallsPerDay: 60,
    workersAiMaxTokens: 1024,
    issues: [],
    ...overrides,
  };

  writeFileSync(join(reportsDir, 'latest-ai-config-guard.json'), JSON.stringify(report, null, 2));
}

describe('ai provider health', () => {
  it('renders a clear health report when the telemetry window is stable', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-provider-health-clear-'));
    const reportsDir = join(root, 'reports', 'seo');
    mkdirSync(reportsDir, { recursive: true });
    writeAiConfigGuard(reportsDir);

    writeCheckpoint(
      reportsDir,
      'stable.json',
      checkpoint({
        timestamp: '2026-04-04T09:00:00.000Z',
        batch: 3,
        selectedCount: 12,
        completedIds: ['skill-a'],
        availableOrder: [
          { label: 'N0', provider: 'nvidia' },
          { label: 'S', provider: 'siliconflow' },
        ],
        aiTelemetry: {
          labelStats: [
            label('N0', 'nvidia', 1, { successCount: 5, lastSuccessAt: '2026-04-04T09:00:00.000Z' }),
            label('S', 'siliconflow', 2, { successCount: 1, lastSuccessAt: '2026-04-04T09:00:00.000Z' }),
          ],
          recentEvents: [
            {
              timestamp: '2026-04-04T08:59:00.000Z',
              type: 'provider_success' as const,
              provider: 'nvidia' as const,
              label: 'N0',
              detail: 'response received',
            },
          ],
        },
      }),
    );

    const report = buildAiProviderHealthReport({
      reportsDir,
      limit: 5,
      failOnSeverity: 'critical',
      generatedAt: '2026-04-04T09:05:00.000Z',
    });

    expect(report.alertSummary.status).toBe('clear');
    expect(report.gate.blocking).toBe(false);
    expect(report.latestSnapshot.availableOrder).toEqual(['N0:nvidia', 'S:siliconflow']);

    const markdown = renderAiProviderHealthReport(report);
    expect(markdown).toContain('# AI Provider Health');
    expect(markdown).toContain('## AI Config Guard');
    expect(markdown).toContain('Config guard status: clear');
    expect(markdown).toContain('Backup posture: siliconflow=standby, openrouter=standby, cloudflare=burst-only');
    expect(markdown).toContain('OpenRouter models: runtime=google/gemini-2.5-flash');
    expect(markdown).toContain(
      'Rejected override: skill_try.openrouter rejected OPENROUTER_MODEL=google/gemini-2.5-flash',
    );
    expect(markdown).toContain('Current severity: clear');
    expect(markdown).toContain('Blocking at threshold: no');
    expect(markdown).toContain('Available order: N0:nvidia -> S:siliconflow');
    expect(markdown).toContain('Fallback policy: cold');
    expect(markdown).toContain('Workload profile: batch_generation');
    expect(markdown).toContain('Backup priority for workload: siliconflow -> openrouter -> cloudflare');
    expect(markdown).toContain('Configured backup posture: siliconflow=standby');
    expect(markdown).toContain('Current routing decision: primary_preferred');
    expect(markdown).toContain('Routing reason: No provider pressure is active.');
    expect(markdown).toContain('Workers AI budget status: available');
    expect(markdown).toContain('## Rate Pressure Evidence');
    expect(markdown).toContain('No active label/provider pressure is influencing the latest routing decision');
    expect(markdown).toContain('## Operator Controls');
    expect(markdown).toContain('## Operator Guidance');
    expect(markdown).toContain('N0 (nvidia) | latest=#1 | avg=1.00');
    expect(markdown).toContain('Workers AI note: Free-only is enforced with local call caps and model allowlists.');
    expect(markdown).toContain('No active AI alerts in the analyzed telemetry window');
  });

  it('marks policy-parked backups separately from unhealthy backups and surfaces direct probe billing flags', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-provider-health-policy-parked-'));
    const reportsDir = join(root, 'reports', 'seo');
    mkdirSync(reportsDir, { recursive: true });

    writeCheckpoint(
      reportsDir,
      'stable.json',
      checkpoint({
        timestamp: '2026-04-04T09:10:00.000Z',
        availableOrder: [{ label: 'N0', provider: 'nvidia' }],
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
            configuredBackupProviders: ['siliconflow'],
            eligibleBackupProviders: [],
            pressureLabels: [],
            recentActivations: [],
          },
          labelStats: [
            label('N0', 'nvidia', 1, { successCount: 5, lastSuccessAt: '2026-04-04T09:10:00.000Z' }),
            label('S', 'siliconflow', null, {
              currentlyAvailable: false,
            }),
          ],
          recentEvents: [
            {
              timestamp: '2026-04-04T09:09:00.000Z',
              type: 'provider_success' as const,
              provider: 'nvidia' as const,
              label: 'N0',
              detail: 'response received',
            },
          ],
        },
      }),
    );

    writeProbe(reportsDir, {
      generatedAt: '2026-04-04T09:11:00.000Z',
      targets: {
        total: 2,
        nvidia: 1,
        siliconflow: 1,
        openrouter: 0,
      },
      summary: {
        total: 2,
        healthy: 1,
        unhealthy: 1,
        nvidiaHealthy: 1,
        nvidiaUnhealthy: 0,
        backupHealthy: 0,
        backupUnhealthy: 1,
      },
      byProvider: [
        { provider: 'nvidia', configured: 1, healthy: 1, unhealthy: 0 },
        { provider: 'siliconflow', configured: 1, healthy: 0, unhealthy: 1 },
      ],
      workersAi: {
        probed: false,
        reason: 'Workers AI is intentionally excluded to avoid spending the free-only budget on health probes.',
      },
      guidance: ['Billing or balance issues detected on S:siliconflow.'],
      results: [
        {
          provider: 'nvidia',
          label: 'N0',
          model: 'meta/llama-3.3-70b-instruct',
          ok: true,
          status: 200,
          latencyMs: 410,
          failureClass: 'ok',
          error: null,
        },
        {
          provider: 'siliconflow',
          label: 'S',
          model: 'Qwen/Qwen2.5-72B-Instruct',
          ok: false,
          status: 403,
          latencyMs: 220,
          failureClass: 'billing_error',
          error: 'account balance is insufficient',
        },
      ],
    });

    const report = buildAiProviderHealthReport({
      reportsDir,
      limit: 5,
      failOnSeverity: 'critical',
      generatedAt: '2026-04-04T09:12:00.000Z',
    });

    expect(report.latestSnapshot.fallbackProviders).toEqual([
      expect.objectContaining({
        label: 'S',
        provider: 'siliconflow',
        flags: ['policy-parked', 'probe-billing-error'],
      }),
    ]);

    const markdown = renderAiProviderHealthReport(report);
    expect(markdown).toContain('S (siliconflow, n/a) 0 ok, 0 fail | policy-parked, probe-billing-error');
  });

  it('surfaces guarded fallback policy and recent activation evidence in the health report', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-provider-health-fallback-'));
    const reportsDir = join(root, 'reports', 'seo');
    mkdirSync(reportsDir, { recursive: true });

    writeCheckpoint(
      reportsDir,
      'fallback.json',
      checkpoint({
        timestamp: '2026-04-04T09:30:00.000Z',
        availableOrder: [{ label: 'O0', provider: 'openrouter' }],
        aiTelemetry: {
          mode: {
            workersAi: 'free-only',
            fallbackPolicy: 'guarded',
            concurrencyLimit: 3,
            localeBatchSize: 3,
          },
          fallbackRouting: {
            policy: 'guarded',
            workloadProfile: 'interactive_demo',
            backupPriorityOrder: ['siliconflow', 'openrouter', 'cloudflare'],
            backupsAllowed: true,
            activationReason: 'nvidia_unavailable',
            decision: 'backup_recovery',
            decisionReason: 'Backup providers are active because nvidia_unavailable.',
            nvidiaConfigured: true,
            nvidiaAvailable: false,
            configuredBackupProviders: ['openrouter'],
            eligibleBackupProviders: [{ label: 'O0', provider: 'openrouter' }],
            pressureLabels: [
              {
                label: 'N0',
                provider: 'nvidia',
                scope: 'primary',
                available: false,
                severity: 'critical',
                reasons: ['quarantined=N0:429-quarantine', 'recent_429s=2', 'recent_cooldowns=2'],
                consecutive429s: 1,
                consecutiveRetryableFailures: 1,
                recent429Count: 2,
                recentRetryableFailureCount: 1,
                recentCooldownCount: 2,
                failureCount: 3,
                successCount: 0,
                pressureScore: 24,
                lastPressureAt: '2026-04-04T09:29:55.000Z',
                lastStatus: 429,
                lastError: 'nvidia 429 burst',
              },
            ],
            recentActivations: [
              {
                timestamp: '2026-04-04T09:29:58.000Z',
                provider: 'openrouter',
                label: 'O0',
                reason: 'nvidia_unavailable',
                policy: 'guarded',
                attempt: 1,
              },
            ],
          },
          labelStats: [
            label('N0', 'nvidia', null, {
              failureCount: 3,
              consecutiveRetryableFailures: 1,
              consecutive429s: 1,
              recentRetryableFailureCount: 1,
              recent429Count: 2,
              recentCooldownCount: 2,
              lastPressureAt: '2026-04-04T09:29:55.000Z',
              lastStatus: 429,
              lastError: 'nvidia 429 burst',
              currentlyAvailable: false,
              quarantined: true,
              quarantinedAt: '2026-04-04T09:29:55.000Z',
              quarantineReason: 'N0:429-quarantine',
            }),
            label('O0', 'openrouter', 1, { successCount: 1, lastSuccessAt: '2026-04-04T09:29:58.000Z' }),
          ],
          recentEvents: [
            {
              timestamp: '2026-04-04T09:29:58.000Z',
              type: 'fallback_activated' as const,
              provider: 'openrouter' as const,
              label: 'O0',
              attempt: 1,
              detail: 'nvidia_unavailable',
            },
          ],
        },
      }),
    );

    const report = buildAiProviderHealthReport({
      reportsDir,
      limit: 5,
      failOnSeverity: 'critical',
      generatedAt: '2026-04-04T09:35:00.000Z',
    });

    expect(report.latestSnapshot.fallbackRouting.activationReason).toBe('nvidia_unavailable');
    expect(report.latestSnapshot.fallbackRouting.recentActivations).toHaveLength(1);

    const markdown = renderAiProviderHealthReport(report);
    expect(markdown).toContain('Fallback policy: guarded');
    expect(markdown).toContain('Workload profile: interactive_demo');
    expect(markdown).toContain('Current routing decision: backup_recovery');
    expect(markdown).toContain('Routing reason: Backup providers are active because nvidia_unavailable.');
    expect(markdown).toContain('Backup routing active now: yes');
    expect(markdown).toContain('Backup activation reason: nvidia_unavailable');
    expect(markdown).toContain('## Rate Pressure Evidence');
    expect(markdown).toContain('N0 (nvidia) | primary/critical | score=24');
    expect(markdown).toContain('recent429=2');
    expect(markdown).toContain('## Operator Controls');
    expect(markdown).toContain('Recommended action: Backups are active because nvidia_unavailable.');
    expect(markdown).toContain('O0 (openrouter) | nvidia_unavailable | policy=guarded | attempt=1');
    expect(markdown).toContain('O0 (openrouter) | latest=#1 | avg=1.00');
  });

  it('treats warning windows as non-blocking at critical threshold but blocking at warning threshold', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-provider-health-warning-'));
    const reportsDir = join(root, 'reports', 'seo');
    mkdirSync(reportsDir, { recursive: true });

    for (let index = 0; index < 3; index += 1) {
      const timestamp = `2026-04-04T10:0${index}:00.000Z`;
      writeCheckpoint(
        reportsDir,
        `warning-${index}.json`,
        checkpoint({
          timestamp,
          availableOrder: [
            { label: 'N0', provider: 'nvidia' },
            { label: 'N1', provider: 'nvidia' },
            { label: 'S', provider: 'siliconflow' },
          ],
          aiTelemetry: {
            labelStats: [
              label('N0', 'nvidia', 1, {
                successCount: 2,
                failureCount: index + 1,
                lastStatus: 429,
                lastError: 'nvidia 429 burst',
                lastFailureAt: timestamp,
              }),
              label('N1', 'nvidia', 2, { successCount: 5, lastSuccessAt: timestamp }),
              label('S', 'siliconflow', 3, { successCount: 1, lastSuccessAt: timestamp }),
            ],
            recentEvents: [
              {
                timestamp: `2026-04-04T10:0${index}:10.000Z`,
                type: 'provider_failure' as const,
                provider: 'nvidia' as const,
                label: 'N0',
                status: 429,
                detail: `nvidia failure ${index}`,
              },
              {
                timestamp: `2026-04-04T10:0${index}:20.000Z`,
                type: 'provider_cooldown' as const,
                provider: 'nvidia' as const,
                label: 'N0',
                detail: `nvidia cooldown ${index}`,
              },
            ],
          },
        }),
      );
    }

    const criticalThreshold = buildAiProviderHealthReport({
      reportsDir,
      limit: 5,
      failOnSeverity: 'critical',
      generatedAt: '2026-04-04T10:10:00.000Z',
    });
    expect(criticalThreshold.alertSummary.status).toBe('soft warning');
    expect(criticalThreshold.gate.blocking).toBe(false);
    expect(criticalThreshold.alerts.map((alert) => alert.code)).toContain('nvidia_instability_window');

    const warningThreshold = buildAiProviderHealthReport({
      reportsDir,
      limit: 5,
      failOnSeverity: 'warning',
      generatedAt: '2026-04-04T10:10:00.000Z',
    });
    expect(warningThreshold.gate.blocking).toBe(true);
    expect(warningThreshold.gate.blockingAlertCodes).toEqual(['nvidia_instability_window']);

    const markdown = renderAiProviderHealthReport(warningThreshold);
    expect(markdown).toContain('Gate threshold: warning');
    expect(markdown).toContain('Blocking at threshold: yes');
    expect(markdown).toContain('[WARNING] Historical NVIDIA volatility detected');
  });

  it('surfaces critical provider failures as blocking health results', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-provider-health-blocking-'));
    const reportsDir = join(root, 'reports', 'seo');
    mkdirSync(reportsDir, { recursive: true });

    writeCheckpoint(
      reportsDir,
      'blocking.json',
      checkpoint({
        timestamp: '2026-04-04T11:00:00.000Z',
        availableOrder: [
          { label: 'N1', provider: 'nvidia' },
          { label: 'S', provider: 'siliconflow' },
        ],
        aiTelemetry: {
          labelStats: [
            label('N0', 'nvidia', null, {
              currentlyAvailable: false,
              quarantined: true,
              quarantinedAt: '2026-04-04T11:00:00.000Z',
              quarantineReason: 'N0:429',
              lastStatus: 429,
              lastError: 'nvidia 429 burst',
            }),
            label('N1', 'nvidia', 1, { successCount: 4, lastSuccessAt: '2026-04-04T11:00:00.000Z' }),
            label('O0', 'openrouter', null, {
              currentlyAvailable: false,
              hardDisabled: true,
              hardDisableReason: '401 invalid key',
            }),
          ],
          quarantinedLabels: [
            {
              label: 'N0',
              provider: 'nvidia',
              reason: 'N0:429',
              quarantinedAt: '2026-04-04T11:00:00.000Z',
            },
          ],
          hardDisabledProviders: [
            {
              provider: 'openrouter',
              reason: '401 invalid key',
            },
          ],
          recentEvents: [
            {
              timestamp: '2026-04-04T11:00:05.000Z',
              type: 'provider_failure' as const,
              provider: 'nvidia' as const,
              label: 'N0',
              status: 429,
              detail: 'nvidia 429 burst',
            },
          ],
        },
      }),
    );

    const report = buildAiProviderHealthReport({
      reportsDir,
      limit: 5,
      failOnSeverity: 'critical',
      generatedAt: '2026-04-04T11:05:00.000Z',
    });

    expect(report.alertSummary.status).toBe('blocking');
    expect(report.gate.blocking).toBe(true);
    expect(report.gate.blockingAlertCodes).toContain('latest_hard_disabled_providers');

    const markdown = renderAiProviderHealthReport(report);
    expect(markdown).toContain('Hard-disabled providers: openrouter (401 invalid key)');
    expect(markdown).toContain('[CRITICAL] Hard-disabled AI providers present in latest snapshot');
    expect(markdown).toContain('[WARNING] Quarantined provider labels present in latest snapshot');
  });

  it('incorporates direct provider probe evidence and warning alerts into the health report', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-provider-health-probe-'));
    const reportsDir = join(root, 'reports', 'seo');
    mkdirSync(reportsDir, { recursive: true });

    writeCheckpoint(
      reportsDir,
      'stable.json',
      checkpoint({
        timestamp: '2026-04-04T12:00:00.000Z',
        availableOrder: [{ label: 'N0', provider: 'nvidia' }],
        aiTelemetry: {
          labelStats: [label('N0', 'nvidia', 1, { successCount: 4, lastSuccessAt: '2026-04-04T12:00:00.000Z' })],
          recentEvents: [
            {
              timestamp: '2026-04-04T11:59:00.000Z',
              type: 'provider_success' as const,
              provider: 'nvidia' as const,
              label: 'N0',
              detail: 'response received',
            },
          ],
        },
      }),
    );

    writeProbeHistory(reportsDir, 'ai-provider-probe-2026-04-04T12-01-00-000Z.json', {
      generatedAt: '2026-04-04T12:01:00.000Z',
      targets: {
        total: 3,
        nvidia: 1,
        siliconflow: 1,
        openrouter: 1,
      },
      summary: {
        total: 3,
        healthy: 2,
        unhealthy: 1,
        nvidiaHealthy: 1,
        nvidiaUnhealthy: 0,
        backupHealthy: 1,
        backupUnhealthy: 1,
      },
      byProvider: [
        { provider: 'nvidia', configured: 1, healthy: 1, unhealthy: 0 },
        { provider: 'siliconflow', configured: 1, healthy: 1, unhealthy: 0 },
        { provider: 'openrouter', configured: 1, healthy: 0, unhealthy: 1 },
      ],
      workersAi: {
        probed: false,
        reason: 'Workers AI is intentionally excluded to avoid spending the free-only budget on health probes.',
      },
      guidance: ['Previous probe saw one healthy backup provider.'],
      results: [
        {
          provider: 'nvidia',
          label: 'N0',
          model: 'meta/llama-3.3-70b-instruct',
          ok: true,
          status: 200,
          latencyMs: 480,
          failureClass: 'ok',
          error: null,
        },
        {
          provider: 'siliconflow',
          label: 'S',
          model: 'Qwen/Qwen2.5-72B-Instruct',
          ok: true,
          status: 200,
          latencyMs: 360,
          failureClass: 'ok',
          error: null,
        },
        {
          provider: 'openrouter',
          label: 'O0',
          model: 'google/gemini-2.5-flash',
          ok: false,
          status: 429,
          latencyMs: 300,
          failureClass: 'rate_limited',
          error: 'provider rate limited',
        },
      ],
    });

    writeProbe(reportsDir, {
      generatedAt: '2026-04-04T12:03:00.000Z',
      targets: {
        total: 3,
        nvidia: 1,
        siliconflow: 1,
        openrouter: 1,
      },
      summary: {
        total: 3,
        healthy: 1,
        unhealthy: 2,
        nvidiaHealthy: 1,
        nvidiaUnhealthy: 0,
        backupHealthy: 0,
        backupUnhealthy: 2,
      },
      byProvider: [
        { provider: 'nvidia', configured: 1, healthy: 1, unhealthy: 0 },
        { provider: 'siliconflow', configured: 1, healthy: 0, unhealthy: 1 },
        { provider: 'openrouter', configured: 1, healthy: 0, unhealthy: 1 },
      ],
      workersAi: {
        probed: false,
        reason: 'Workers AI is intentionally excluded to avoid spending the free-only budget on health probes.',
      },
      guidance: [
        'All 1 configured NVIDIA labels responded successfully.',
        'Direct probe shows backups are currently unavailable.',
      ],
      results: [
        {
          provider: 'nvidia',
          label: 'N0',
          model: 'meta/llama-3.3-70b-instruct',
          ok: true,
          status: 200,
          latencyMs: 500,
          failureClass: 'ok',
          error: null,
        },
        {
          provider: 'siliconflow',
          label: 'S',
          model: 'Qwen/Qwen2.5-72B-Instruct',
          ok: false,
          status: 403,
          latencyMs: 320,
          failureClass: 'billing_error',
          error: 'account balance is insufficient',
        },
        {
          provider: 'openrouter',
          label: 'O0',
          model: 'google/gemini-2.5-flash',
          ok: false,
          status: 429,
          latencyMs: 280,
          failureClass: 'rate_limited',
          error: 'provider rate limited',
        },
      ],
    });

    const report = buildAiProviderHealthReport({
      reportsDir,
      limit: 5,
      failOnSeverity: 'critical',
      generatedAt: '2026-04-04T12:05:00.000Z',
    });

    expect(report.alertSummary.status).toBe('soft warning');
    expect(report.gate.blocking).toBe(false);
    expect(report.alerts.map((alert) => alert.code)).toEqual(
      expect.arrayContaining(['probe_backups_unreachable', 'probe_rate_limited_labels', 'probe_access_issues']),
    );
    expect(report.directProbe.available).toBe(true);
    expect(report.directProbeTrend.sampleCount).toBe(2);
    expect(report.directProbeTrend.frequentRateLimitedLabels).toEqual(
      expect.arrayContaining([{ label: 'O0', provider: 'openrouter', count: 2 }]),
    );
    expect(report.operatorControls.directProbeNote).toContain('no backup provider is currently healthy');
    expect(report.operatorControls.actionSummary).toContain(
      'direct probe shows backup auth or billing issues on S:siliconflow, O0:openrouter',
    );

    const markdown = renderAiProviderHealthReport(report);
    expect(markdown).toContain('## Direct Provider Probe');
    expect(markdown).toContain('Probe summary: nvidia healthy=1/1, backups healthy=0/2, total healthy=1/3');
    expect(markdown).toContain('Probe rate-limited labels: O0:openrouter');
    expect(markdown).toContain('Probe access issues: S:siliconflow');
    expect(markdown).toContain('[WARNING] Direct provider probe found no healthy backup providers');
    expect(markdown).toContain('[WARNING] Direct provider probe observed rate-limited labels');
    expect(markdown).toContain('[WARNING] Direct provider probe observed auth or billing issues');
    expect(markdown).toContain('## Direct Probe Trend');
    expect(markdown).toContain('Samples analyzed: 2');
    expect(markdown).toContain('O0 (openrouter) | rate_limited_count=2');
    expect(markdown).toContain('S (siliconflow) | ok=1/2 | fail=1');
  });

  it('prioritizes config drift in operator controls when ai config guard reports issues', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-provider-health-config-issues-'));
    const reportsDir = join(root, 'reports', 'seo');
    mkdirSync(reportsDir, { recursive: true });
    writeAiConfigGuard(reportsDir, {
      providerModels: {
        ...JSON.parse(
          JSON.stringify({
            runtime: {
              nvidia: { model: 'meta/llama-3.1-70b-instruct', source: 'default', envKey: null, rejectedOverride: null },
              siliconflow: {
                model: 'Qwen/Qwen2.5-72B-Instruct',
                source: 'default',
                envKey: null,
                rejectedOverride: null,
              },
              openrouter: {
                model: 'google/gemma-3-27b-it:free',
                source: 'env',
                envKey: 'OPENROUTER_MODEL',
                rejectedOverride: null,
              },
            },
            translate: {
              nvidia: { model: 'meta/llama-3.1-70b-instruct', source: 'default', envKey: null, rejectedOverride: null },
              siliconflow: {
                model: 'Qwen/Qwen2.5-72B-Instruct',
                source: 'default',
                envKey: null,
                rejectedOverride: null,
              },
              openrouter: { model: 'google/gemini-2.5-flash', source: 'default', envKey: null, rejectedOverride: null },
            },
            skill_try: {
              nvidia: { model: 'deepseek-ai/deepseek-v3.1', source: 'default', envKey: null, rejectedOverride: null },
              siliconflow: { model: 'DeepSeek/DeepSeek-V3', source: 'default', envKey: null, rejectedOverride: null },
              openrouter: {
                model: 'google/gemma-3-27b-it:free',
                source: 'default',
                envKey: null,
                rejectedOverride: null,
              },
            },
            script: {
              nvidia: { model: 'meta/llama-3.3-70b-instruct', source: 'default', envKey: null, rejectedOverride: null },
              siliconflow: {
                model: 'Qwen/Qwen2.5-72B-Instruct',
                source: 'default',
                envKey: null,
                rejectedOverride: null,
              },
              openrouter: { model: 'google/gemini-2.5-flash', source: 'default', envKey: null, rejectedOverride: null },
            },
            probe: {
              nvidia: { model: 'meta/llama-3.3-70b-instruct', source: 'default', envKey: null, rejectedOverride: null },
              siliconflow: {
                model: 'Qwen/Qwen2.5-72B-Instruct',
                source: 'default',
                envKey: null,
                rejectedOverride: null,
              },
              openrouter: { model: 'google/gemini-2.5-flash', source: 'default', envKey: null, rejectedOverride: null },
            },
          }),
        ),
      } as any,
      issues: [
        {
          code: 'openrouter_free_model_outside_skill_try',
          message:
            'OpenRouter resolves to a free-tier model outside skill_try: runtime.openrouter=google/gemma-3-27b-it:free (env:OPENROUTER_MODEL).',
        },
      ],
    });

    writeCheckpoint(
      reportsDir,
      'stable.json',
      checkpoint({
        timestamp: '2026-04-04T13:00:00.000Z',
        availableOrder: [{ label: 'N0', provider: 'nvidia' }],
      }),
    );

    const report = buildAiProviderHealthReport({
      reportsDir,
      limit: 5,
      failOnSeverity: 'critical',
      generatedAt: '2026-04-04T13:05:00.000Z',
    });

    expect(report.aiConfigGuard.status).toBe('issues');
    expect(report.operatorControls.aiConfigNote).toContain('AI config guard has 1 issue');
    expect(report.operatorControls.actionSummary).toContain('Fix provider model or Workers AI policy drift');

    const markdown = renderAiProviderHealthReport(report);
    expect(markdown).toContain('Config guard status: issues');
    expect(markdown).toContain('Config issues: 1');
    expect(markdown).toContain('runtime=google/gemma-3-27b-it:free');
    expect(markdown).toContain('AI config note: AI config guard has 1 issue(s).');
  });
});
