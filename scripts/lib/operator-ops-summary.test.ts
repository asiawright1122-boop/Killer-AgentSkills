import { describe, expect, it } from 'vitest';
import type { AiConfigGuardReport } from './ai-config-guard';
import {
  buildOperatorOpsSummaryReport,
  buildOperatorRemediationHandoffReport,
  buildOperatorRemediationReport,
  renderOperatorOpsSummaryReport,
  renderOperatorRemediationHandoffReport,
} from './operator-ops-summary';

function clearAiConfig(): AiConfigGuardReport {
  return {
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
        openrouter: { model: 'google/gemma-3-27b-it:free', source: 'default', envKey: null, rejectedOverride: null },
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
  };
}

describe('operator ops summary', () => {
  it('stays quiet when both upstream reports are clear', () => {
    const remediation = buildOperatorRemediationReport({
      aiConfigReport: clearAiConfig(),
      aiThreshold: 'warning',
      governanceThreshold: 'warning',
      aiHealthReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        gate: {
          failOnSeverity: 'critical',
          blocking: false,
          blockingAlertCount: 0,
          blockingAlertCodes: [],
          blockingAlertTitles: [],
        },
        alertSummary: { total: 0, warningCount: 0, criticalCount: 0, highestSeverity: 'none', status: 'clear' },
        alerts: [],
      } as any,
      contentGovernanceReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        severity: 'clear',
        gate: { failOnSeverity: 'blocking', blocking: false, triggeredChecks: [] },
        checks: [],
      } as any,
    });

    const handoff = buildOperatorRemediationHandoffReport({
      remediationReport: remediation,
      mode: 'none',
    });

    const summary = buildOperatorOpsSummaryReport({
      aiConfigReport: clearAiConfig(),
      aiThreshold: 'warning',
      governanceThreshold: 'warning',
      remediationReport: remediation,
      handoffReport: handoff,
      aiHealthReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        gate: {
          failOnSeverity: 'critical',
          blocking: false,
          blockingAlertCount: 0,
          blockingAlertCodes: [],
          blockingAlertTitles: [],
        },
        alertSummary: { total: 0, warningCount: 0, criticalCount: 0, highestSeverity: 'none', status: 'clear' },
        alerts: [],
      } as any,
      contentGovernanceReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        severity: 'clear',
        gate: { failOnSeverity: 'blocking', blocking: false, triggeredChecks: [] },
        checks: [],
      } as any,
    });

    expect(remediation.summary.totalItems).toBe(0);
    expect(handoff.status).toBe('disabled');
    expect(summary.quiet).toBe(true);
    expect(summary.overallStatus).toBe('clear');
    expect(renderOperatorOpsSummaryReport(summary)).toContain('No active remediation items');
  });

  it('seeds warning remediation items from AI alerts and governance checks', () => {
    const remediation = buildOperatorRemediationReport({
      aiConfigReport: clearAiConfig(),
      aiThreshold: 'warning',
      governanceThreshold: 'warning',
      aiHealthReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        gate: {
          failOnSeverity: 'critical',
          blocking: false,
          blockingAlertCount: 0,
          blockingAlertCodes: [],
          blockingAlertTitles: [],
        },
        alertSummary: {
          total: 1,
          warningCount: 1,
          criticalCount: 0,
          highestSeverity: 'warning',
          status: 'soft warning',
        },
        alerts: [
          {
            severity: 'warning',
            code: 'nvidia_instability_window',
            title: 'Historical NVIDIA volatility detected',
            detail: 'Recent 429 pressure remains noisy.',
          },
        ],
        directProbeTrend: {
          sampleCount: 2,
          frequentRateLimitedLabels: [{ label: 'N0', provider: 'nvidia', count: 2 }],
          weakBackups: [],
          stableNvidia: [],
        },
      } as any,
      contentGovernanceReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        severity: 'warning',
        gate: { failOnSeverity: 'blocking', blocking: false, triggeredChecks: [] },
        checks: [
          {
            code: 'collection_drift',
            title: 'Collection metadata / canonical drift',
            severity: 'warning',
            blocking: false,
            summary: '2 drift issues detected',
            stats: { totalIssues: 2 },
          },
        ],
      } as any,
    });

    expect(remediation.summary.totalItems).toBe(2);
    expect(remediation.summary.warningItems).toBe(2);
    expect(remediation.items.map((item) => item.id)).toEqual([
      'ai-health:nvidia_instability_window',
      'content-governance:collection_drift',
    ]);
    expect(remediation.items[0].summary).toContain('Direct probe repeats: N0 x2.');
    expect(remediation.items[0].evidencePaths).toEqual(
      expect.arrayContaining([
        'reports/seo/latest-ai-provider-health.json',
        'reports/seo/latest-ai-provider-health.md',
        'reports/seo/latest-ai-provider-probe-trend.json',
        'reports/seo/latest-ai-provider-probe-trend.md',
      ]),
    );
  });

  it('builds deduped handoff scaffolds and tracks repeats across runs', () => {
    const remediation = buildOperatorRemediationReport({
      aiConfigReport: clearAiConfig(),
      aiThreshold: 'warning',
      governanceThreshold: 'warning',
      generatedAt: '2026-04-07T00:00:00.000Z',
      aiHealthReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        gate: {
          failOnSeverity: 'critical',
          blocking: false,
          blockingAlertCount: 0,
          blockingAlertCodes: [],
          blockingAlertTitles: [],
        },
        alertSummary: {
          total: 1,
          warningCount: 1,
          criticalCount: 0,
          highestSeverity: 'warning',
          status: 'soft warning',
        },
        alerts: [
          {
            severity: 'warning',
            code: 'nvidia_instability_window',
            title: 'Historical NVIDIA volatility detected',
            detail: 'Recent 429 pressure remains noisy.',
          },
        ],
      } as any,
      contentGovernanceReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        severity: 'clear',
        gate: { failOnSeverity: 'blocking', blocking: false, triggeredChecks: [] },
        checks: [],
      } as any,
    });

    const firstReport = buildOperatorRemediationHandoffReport({
      remediationReport: remediation,
      generatedAt: '2026-04-07T00:00:00.000Z',
      mode: 'issue',
      owner: 'asiawright1122-boop',
      repo: 'Killer-AgentSkills',
      baseBranch: 'main',
      labels: ['ops-remediation', 'automated'],
    });
    const secondReport = buildOperatorRemediationHandoffReport({
      remediationReport: remediation,
      generatedAt: '2026-04-07T01:00:00.000Z',
      mode: 'issue',
      owner: 'asiawright1122-boop',
      repo: 'Killer-AgentSkills',
      baseBranch: 'main',
      labels: ['ops-remediation', 'automated'],
      previousHandoffReport: firstReport,
    });

    expect(firstReport.status).toBe('ready');
    expect(firstReport.summary.totalScaffolds).toBe(1);
    expect(firstReport.scaffolds[0].state).toBe('new');
    expect(firstReport.scaffolds[0].title).toContain('Historical NVIDIA volatility detected');
    expect(firstReport.scaffolds[0].body).toContain('## Dedupe Metadata');

    expect(secondReport.scaffolds[0].state).toBe('repeat');
    expect(secondReport.scaffolds[0].repeatCount).toBe(2);
    expect(secondReport.scaffolds[0].dedupeKey).toBe(firstReport.scaffolds[0].dedupeKey);
    expect(renderOperatorRemediationHandoffReport(secondReport)).toContain('[REPEAT][issue]');
  });

  it('elevates overall status to blocking when a blocking governance item exists', () => {
    const remediation = buildOperatorRemediationReport({
      aiConfigReport: clearAiConfig(),
      aiThreshold: 'warning',
      governanceThreshold: 'warning',
      aiHealthReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        gate: {
          failOnSeverity: 'critical',
          blocking: false,
          blockingAlertCount: 0,
          blockingAlertCodes: [],
          blockingAlertTitles: [],
        },
        alertSummary: { total: 0, warningCount: 0, criticalCount: 0, highestSeverity: 'none', status: 'clear' },
        alerts: [],
      } as any,
      contentGovernanceReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        severity: 'blocking',
        gate: { failOnSeverity: 'blocking', blocking: true, triggeredChecks: ['public_route_contracts'] },
        checks: [
          {
            code: 'public_route_contracts',
            title: 'Representative localized public-route contracts',
            severity: 'blocking',
            blocking: true,
            summary: 'Representative localized public-route contracts failed',
            stats: { passed: false, exitCode: 1 },
          },
        ],
      } as any,
    });

    const summary = buildOperatorOpsSummaryReport({
      aiConfigReport: clearAiConfig(),
      remediationReport: remediation,
      handoffReport: buildOperatorRemediationHandoffReport({
        remediationReport: remediation,
        mode: 'none',
      }),
      aiHealthReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        gate: {
          failOnSeverity: 'critical',
          blocking: false,
          blockingAlertCount: 0,
          blockingAlertCodes: [],
          blockingAlertTitles: [],
        },
        alertSummary: { total: 0, warningCount: 0, criticalCount: 0, highestSeverity: 'none', status: 'clear' },
        alerts: [],
      } as any,
      contentGovernanceReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        severity: 'blocking',
        gate: { failOnSeverity: 'blocking', blocking: true, triggeredChecks: ['public_route_contracts'] },
        checks: [
          {
            code: 'public_route_contracts',
            title: 'Representative localized public-route contracts',
            severity: 'blocking',
            blocking: true,
            summary: 'Representative localized public-route contracts failed',
            stats: { passed: false, exitCode: 1 },
          },
        ],
      } as any,
    });

    expect(remediation.summary.blockingItems).toBe(1);
    expect(summary.overallStatus).toBe('blocking');
    expect(renderOperatorOpsSummaryReport(summary)).toContain('Overall status: blocking');
  });

  it('surfaces probe-trend findings in the operator summary for persistent provider pressure', () => {
    const remediation = buildOperatorRemediationReport({
      aiConfigReport: clearAiConfig(),
      aiThreshold: 'warning',
      governanceThreshold: 'warning',
      aiHealthReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        gate: {
          failOnSeverity: 'critical',
          blocking: false,
          blockingAlertCount: 0,
          blockingAlertCodes: [],
          blockingAlertTitles: [],
        },
        alertSummary: {
          total: 2,
          warningCount: 2,
          criticalCount: 0,
          highestSeverity: 'warning',
          status: 'soft warning',
        },
        alerts: [
          {
            severity: 'warning',
            code: 'probe_rate_limited_labels',
            title: 'Direct provider probe observed rate-limited labels',
            detail: 'O0:openrouter',
          },
          {
            severity: 'warning',
            code: 'probe_access_issues',
            title: 'Direct provider probe observed auth or billing issues',
            detail: 'S:siliconflow',
          },
        ],
        directProbe: {
          available: true,
          summary: {
            total: 3,
            healthy: 1,
            unhealthy: 2,
            nvidiaHealthy: 1,
            nvidiaUnhealthy: 0,
            backupHealthy: 0,
            backupUnhealthy: 2,
          },
          targets: {
            total: 3,
            nvidia: 1,
            siliconflow: 1,
            openrouter: 1,
          },
        },
        directProbeTrend: {
          sampleCount: 3,
          frequentRateLimitedLabels: [
            { label: 'O0', provider: 'openrouter', count: 3 },
            { label: 'N1', provider: 'nvidia', count: 2 },
          ],
          weakBackups: [
            {
              label: 'S',
              provider: 'siliconflow',
              appearances: 3,
              okCount: 0,
              failureCount: 3,
              rateLimitedCount: 0,
              authCount: 0,
              billingCount: 3,
              networkCount: 0,
              serverCount: 0,
              clientCount: 0,
              unknownCount: 0,
              avgLatencyMs: 320,
              lastLatencyMs: 300,
              lastStatus: 403,
              lastFailureClass: 'billing_error',
              lastError: 'insufficient balance',
              lastSeenAt: '2026-04-07T00:00:00.000Z',
            },
          ],
          stableNvidia: [
            {
              label: 'N0',
              provider: 'nvidia',
              appearances: 3,
              okCount: 3,
              failureCount: 0,
              rateLimitedCount: 0,
              authCount: 0,
              billingCount: 0,
              networkCount: 0,
              serverCount: 0,
              clientCount: 0,
              unknownCount: 0,
              avgLatencyMs: 210,
              lastLatencyMs: 220,
              lastStatus: 200,
              lastFailureClass: 'ok',
              lastError: null,
              lastSeenAt: '2026-04-07T00:00:00.000Z',
            },
          ],
        },
      } as any,
      contentGovernanceReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        severity: 'clear',
        gate: { failOnSeverity: 'blocking', blocking: false, triggeredChecks: [] },
        checks: [],
      } as any,
    });

    const summary = buildOperatorOpsSummaryReport({
      aiConfigReport: clearAiConfig(),
      remediationReport: remediation,
      handoffReport: buildOperatorRemediationHandoffReport({
        remediationReport: remediation,
        mode: 'none',
      }),
      aiHealthReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        gate: {
          failOnSeverity: 'critical',
          blocking: false,
          blockingAlertCount: 0,
          blockingAlertCodes: [],
          blockingAlertTitles: [],
        },
        alertSummary: {
          total: 2,
          warningCount: 2,
          criticalCount: 0,
          highestSeverity: 'warning',
          status: 'soft warning',
        },
        alerts: remediation.items
          .filter((item) => item.source === 'ai_health')
          .map((item) => ({
            severity: item.severity === 'blocking' ? 'critical' : 'warning',
            code: item.code,
            title: item.title,
            detail: item.summary,
          })),
        directProbe: {
          available: true,
          summary: {
            total: 3,
            healthy: 1,
            unhealthy: 2,
            nvidiaHealthy: 1,
            nvidiaUnhealthy: 0,
            backupHealthy: 0,
            backupUnhealthy: 2,
          },
          targets: {
            total: 3,
            nvidia: 1,
            siliconflow: 1,
            openrouter: 1,
          },
        },
        directProbeTrend: {
          sampleCount: 3,
          frequentRateLimitedLabels: [
            { label: 'O0', provider: 'openrouter', count: 3 },
            { label: 'N1', provider: 'nvidia', count: 2 },
          ],
          weakBackups: [
            {
              label: 'S',
              provider: 'siliconflow',
              appearances: 3,
              okCount: 0,
              failureCount: 3,
              rateLimitedCount: 0,
              authCount: 0,
              billingCount: 3,
              networkCount: 0,
              serverCount: 0,
              clientCount: 0,
              unknownCount: 0,
              avgLatencyMs: 320,
              lastLatencyMs: 300,
              lastStatus: 403,
              lastFailureClass: 'billing_error',
              lastError: 'insufficient balance',
              lastSeenAt: '2026-04-07T00:00:00.000Z',
            },
          ],
          stableNvidia: [
            {
              label: 'N0',
              provider: 'nvidia',
              appearances: 3,
              okCount: 3,
              failureCount: 0,
              rateLimitedCount: 0,
              authCount: 0,
              billingCount: 0,
              networkCount: 0,
              serverCount: 0,
              clientCount: 0,
              unknownCount: 0,
              avgLatencyMs: 210,
              lastLatencyMs: 220,
              lastStatus: 200,
              lastFailureClass: 'ok',
              lastError: null,
              lastSeenAt: '2026-04-07T00:00:00.000Z',
            },
          ],
        },
      } as any,
      contentGovernanceReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        severity: 'clear',
        gate: { failOnSeverity: 'blocking', blocking: false, triggeredChecks: [] },
        checks: [],
      } as any,
    });

    const markdown = renderOperatorOpsSummaryReport(summary);
    expect(summary.aiHealth.reportPaths).toEqual(
      expect.arrayContaining([
        'reports/seo/latest-ai-provider-probe.json',
        'reports/seo/latest-ai-provider-probe.md',
        'reports/seo/latest-ai-provider-probe-trend.json',
        'reports/seo/latest-ai-provider-probe-trend.md',
      ]),
    );
    expect(summary.aiHealth.keyFindings).toEqual(
      expect.arrayContaining([
        'Latest direct probe: NVIDIA healthy 1/1, backups healthy 0/2.',
        'Repeated direct-probe 429s: O0:openrouter x3, N1:nvidia x2.',
      ]),
    );
    expect(markdown).toContain('### AI Key Findings');
    expect(markdown).toContain('Weak backup trend: S:siliconflow (billing=3, fail=3).');
    expect(markdown).toContain('Most stable NVIDIA labels: N0:nvidia (ok=3/3).');
  });

  it('promotes ai config guard failures into blocking remediation and summary findings', () => {
    const aiConfigReport: AiConfigGuardReport = {
      ...clearAiConfig(),
      providerModels: {
        ...clearAiConfig().providerModels,
        runtime: {
          ...clearAiConfig().providerModels.runtime,
          openrouter: {
            model: 'google/gemma-3-27b-it:free',
            source: 'env',
            envKey: 'OPENROUTER_MODEL',
            rejectedOverride: null,
          },
        },
      },
      issues: [
        {
          code: 'openrouter_free_model_outside_skill_try',
          message:
            'OpenRouter resolves to a free-tier model outside skill_try: runtime.openrouter=google/gemma-3-27b-it:free (env:OPENROUTER_MODEL).',
        },
      ],
    };

    const remediation = buildOperatorRemediationReport({
      aiConfigReport,
      aiThreshold: 'warning',
      governanceThreshold: 'warning',
      aiHealthReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        gate: {
          failOnSeverity: 'critical',
          blocking: false,
          blockingAlertCount: 0,
          blockingAlertCodes: [],
          blockingAlertTitles: [],
        },
        alertSummary: { total: 0, warningCount: 0, criticalCount: 0, highestSeverity: 'none', status: 'clear' },
        alerts: [],
      } as any,
      contentGovernanceReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        severity: 'clear',
        gate: { failOnSeverity: 'blocking', blocking: false, triggeredChecks: [] },
        checks: [],
      } as any,
    });

    const summary = buildOperatorOpsSummaryReport({
      aiConfigReport,
      remediationReport: remediation,
      handoffReport: buildOperatorRemediationHandoffReport({
        aiConfigReport,
        remediationReport: remediation,
        mode: 'none',
      }),
      aiHealthReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        gate: {
          failOnSeverity: 'critical',
          blocking: false,
          blockingAlertCount: 0,
          blockingAlertCodes: [],
          blockingAlertTitles: [],
        },
        alertSummary: { total: 0, warningCount: 0, criticalCount: 0, highestSeverity: 'none', status: 'clear' },
        alerts: [],
      } as any,
      contentGovernanceReport: {
        generatedAt: '2026-04-07T00:00:00.000Z',
        severity: 'clear',
        gate: { failOnSeverity: 'blocking', blocking: false, triggeredChecks: [] },
        checks: [],
      } as any,
    });

    expect(remediation.items.map((item) => item.id)).toContain('ai-config:openrouter_free_model_outside_skill_try');
    expect(remediation.summary.blockingItems).toBe(1);
    expect(summary.aiConfig.status).toBe('blocking');
    expect(summary.overallStatus).toBe('blocking');
    expect(summary.aiConfig.keyFindings).toEqual(
      expect.arrayContaining([
        'Config issue: OpenRouter resolves to a free-tier model outside skill_try: runtime.openrouter=google/gemma-3-27b-it:free (env:OPENROUTER_MODEL).',
      ]),
    );

    const markdown = renderOperatorOpsSummaryReport(summary);
    expect(markdown).toContain('## AI Config');
    expect(markdown).toContain('runtime=google/gemma-3-27b-it:free');
    expect(markdown).toContain('AI config guard: openrouter_free_model_outside_skill_try');
  });
});
