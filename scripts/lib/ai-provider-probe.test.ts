import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  buildAIProviderProbeTrend,
  buildAIProviderProbeReport,
  buildAIProviderProbeTargets,
  listAIProviderProbeSamples,
  renderAIProviderProbeReport,
  renderAIProviderProbeTrendReport,
  resolveAIProviderProbeExitCode,
  writeAIProviderProbeArtifacts,
} from './ai-provider-probe';

describe('ai provider probe', () => {
  it('expands all configured NVIDIA and OpenRouter keys into labeled probe targets', () => {
    const targets = buildAIProviderProbeTargets({
      NVIDIA_API_KEYS: 'n0,n1',
      NVIDIA_API_KEYS_2: 'n2',
      SILICONFLOW_API_KEY: 's0',
      OPENROUTER_API_KEYS: 'o0,o1',
    });

    expect(targets.map((entry) => `${entry.label}:${entry.provider}`)).toEqual([
      'N0:nvidia',
      'N1:nvidia',
      'N2:nvidia',
      'S:siliconflow',
      'O0:openrouter',
      'O1:openrouter',
    ]);
    expect(targets.find((entry) => entry.label === 'O0')?.headers['X-Title']).toBe('Killer-Skills Provider Probe');
  });

  it('summarizes rate-limited NVIDIA labels and auth or billing failures in guidance', () => {
    const report = buildAIProviderProbeReport(
      [
        {
          provider: 'nvidia',
          label: 'N0',
          model: 'meta/llama-3.3-70b-instruct',
          ok: false,
          status: 429,
          latencyMs: 800,
          failureClass: 'rate_limited',
          error: 'too many requests',
        },
        {
          provider: 'nvidia',
          label: 'N1',
          model: 'meta/llama-3.3-70b-instruct',
          ok: true,
          status: 200,
          latencyMs: 520,
          failureClass: 'ok',
          error: null,
        },
        {
          provider: 'siliconflow',
          label: 'S',
          model: 'Qwen/Qwen2.5-72B-Instruct',
          ok: false,
          status: 403,
          latencyMs: 450,
          failureClass: 'billing_error',
          error: 'account balance is insufficient',
        },
        {
          provider: 'openrouter',
          label: 'O0',
          model: 'google/gemini-2.5-flash',
          ok: false,
          status: 401,
          latencyMs: 410,
          failureClass: 'auth_error',
          error: 'invalid api key',
        },
      ],
      '2026-04-08T12:00:00.000Z',
    );

    expect(report.summary.nvidiaHealthy).toBe(1);
    expect(report.guidance).toEqual(
      expect.arrayContaining([
        'Only 1/2 NVIDIA labels are healthy. Prefer N1 while investigating the rest.',
        'NVIDIA labels returning 429: N0. Rotate traffic away or cool them down before reusing them.',
        'Auth failures detected on O0:openrouter. Verify secrets before treating these as quota issues.',
        'Billing or balance issues detected on S:siliconflow. Those backups will stay unavailable until credits are restored.',
      ]),
    );

    const markdown = renderAIProviderProbeReport(report);
    expect(markdown).toContain('# AI Provider Probe');
    expect(markdown).toContain('N0 (nvidia) | ERR/rate_limited | status=429');
    expect(markdown).toContain('Workers AI: skipped');
  });

  it('fails by default when all configured NVIDIA labels are unhealthy even if a backup survives', () => {
    const report = buildAIProviderProbeReport(
      [
        {
          provider: 'nvidia',
          label: 'N0',
          model: 'meta/llama-3.3-70b-instruct',
          ok: false,
          status: 429,
          latencyMs: 1000,
          failureClass: 'rate_limited',
          error: 'too many requests',
        },
        {
          provider: 'openrouter',
          label: 'O0',
          model: 'google/gemini-2.5-flash',
          ok: true,
          status: 200,
          latencyMs: 300,
          failureClass: 'ok',
          error: null,
        },
      ],
      '2026-04-08T12:00:00.000Z',
    );

    expect(resolveAIProviderProbeExitCode(report)).toBe(1);
    expect(resolveAIProviderProbeExitCode(report, 'all-down')).toBe(0);
    expect(resolveAIProviderProbeExitCode(report, 'any-failure')).toBe(1);
    expect(resolveAIProviderProbeExitCode(report, 'none')).toBe(0);
  });

  it('builds historical probe trends from archived samples without double-counting the latest report', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-provider-probe-trend-'));
    const reportsDir = join(root, 'reports', 'seo');
    const jsonPath = join(reportsDir, 'latest-ai-provider-probe.json');
    const mdPath = join(reportsDir, 'latest-ai-provider-probe.md');
    const historyDir = join(reportsDir, 'ai-provider-probe-history');

    const firstReport = buildAIProviderProbeReport(
      [
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
          latencyMs: 560,
          failureClass: 'billing_error',
          error: 'account balance is insufficient',
        },
        {
          provider: 'openrouter',
          label: 'O0',
          model: 'google/gemini-2.5-flash',
          ok: false,
          status: 429,
          latencyMs: 630,
          failureClass: 'rate_limited',
          error: 'rate limited',
        },
      ],
      '2026-04-08T12:00:00.000Z',
    );

    const secondReport = buildAIProviderProbeReport(
      [
        {
          provider: 'nvidia',
          label: 'N0',
          model: 'meta/llama-3.3-70b-instruct',
          ok: true,
          status: 200,
          latencyMs: 390,
          failureClass: 'ok',
          error: null,
        },
        {
          provider: 'nvidia',
          label: 'N1',
          model: 'meta/llama-3.3-70b-instruct',
          ok: false,
          status: 429,
          latencyMs: 710,
          failureClass: 'rate_limited',
          error: 'too many requests',
        },
        {
          provider: 'siliconflow',
          label: 'S',
          model: 'Qwen/Qwen2.5-72B-Instruct',
          ok: false,
          status: 403,
          latencyMs: 540,
          failureClass: 'billing_error',
          error: 'account balance is insufficient',
        },
        {
          provider: 'openrouter',
          label: 'O0',
          model: 'google/gemini-2.5-flash',
          ok: false,
          status: 429,
          latencyMs: 680,
          failureClass: 'rate_limited',
          error: 'rate limited',
        },
      ],
      '2026-04-08T12:05:00.000Z',
    );

    writeAIProviderProbeArtifacts(firstReport, { jsonPath, mdPath, archiveDir: historyDir });
    writeAIProviderProbeArtifacts(secondReport, { jsonPath, mdPath, archiveDir: historyDir });

    const samples = listAIProviderProbeSamples(reportsDir);
    expect(samples).toHaveLength(2);
    expect(samples.map((entry) => entry.timestamp)).toEqual(['2026-04-08T12:00:00.000Z', '2026-04-08T12:05:00.000Z']);

    const trend = buildAIProviderProbeTrend(samples, reportsDir, '2026-04-08T12:06:00.000Z');
    expect(trend.sampleCount).toBe(2);
    expect(trend.stableNvidia[0]).toMatchObject({
      label: 'N0',
      provider: 'nvidia',
      okCount: 2,
      failureCount: 0,
    });
    expect(trend.weakBackups.map((entry) => `${entry.label}:${entry.provider}:${entry.failureCount}`)).toEqual(
      expect.arrayContaining(['O0:openrouter:2', 'S:siliconflow:2']),
    );
    expect(trend.frequentRateLimitedLabels).toEqual(
      expect.arrayContaining([
        { label: 'O0', provider: 'openrouter', count: 2 },
        { label: 'N1', provider: 'nvidia', count: 1 },
      ]),
    );

    const markdown = renderAIProviderProbeTrendReport(trend);
    expect(markdown).toContain('# AI Provider Probe Trend');
    expect(markdown).toContain('O0 (openrouter) | rate_limited_count=2');
    expect(markdown).toContain('S (siliconflow) | ok=0/2');
  });
});
