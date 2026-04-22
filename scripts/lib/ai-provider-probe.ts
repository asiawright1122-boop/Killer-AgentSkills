import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import {
  buildAIOnlineProviderPool,
  splitAIProviderKeys,
  type AIOnlineProviderName,
} from '../../src/lib/ai-online-provider-pool';
import { resolveAIProviderModel } from '../../src/lib/ai-provider-models';

export type AIProviderProbeProviderName = AIOnlineProviderName;
export type AIProviderProbeFailureClass =
  | 'ok'
  | 'rate_limited'
  | 'billing_error'
  | 'auth_error'
  | 'server_error'
  | 'client_error'
  | 'network_error'
  | 'empty_response'
  | 'unknown_error';

export type AIProviderProbeTarget = {
  provider: AIProviderProbeProviderName;
  label: string;
  apiKey: string;
  url: string;
  model: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

export type AIProviderProbeResult = {
  provider: AIProviderProbeProviderName;
  label: string;
  model: string;
  ok: boolean;
  status: number | null;
  latencyMs: number;
  failureClass: AIProviderProbeFailureClass;
  error: string | null;
};

export type AIProviderProbeReport = {
  generatedAt: string;
  targets: {
    total: number;
    nvidia: number;
    siliconflow: number;
    openrouter: number;
  };
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    nvidiaHealthy: number;
    nvidiaUnhealthy: number;
    backupHealthy: number;
    backupUnhealthy: number;
  };
  byProvider: Array<{
    provider: AIProviderProbeProviderName;
    configured: number;
    healthy: number;
    unhealthy: number;
  }>;
  workersAi: {
    probed: false;
    reason: string;
  };
  guidance: string[];
  results: AIProviderProbeResult[];
};

export type AIProviderProbeSample = {
  path: string;
  report: AIProviderProbeReport;
  timestamp: string;
  mtimeMs: number;
};

export type AIProviderProbeLabelTrend = {
  label: string;
  provider: AIProviderProbeProviderName;
  appearances: number;
  okCount: number;
  failureCount: number;
  rateLimitedCount: number;
  authCount: number;
  billingCount: number;
  networkCount: number;
  serverCount: number;
  clientCount: number;
  unknownCount: number;
  avgLatencyMs: number;
  lastLatencyMs: number | null;
  lastStatus: number | null;
  lastFailureClass: AIProviderProbeFailureClass | null;
  lastError: string | null;
  lastSeenAt: string | null;
};

export type AIProviderProbeTrend = {
  generatedAt: string;
  reportsDir: string;
  sampleCount: number;
  windowStart: string | null;
  windowEnd: string | null;
  latestReportPath: string | null;
  stableNvidia: AIProviderProbeLabelTrend[];
  weakBackups: AIProviderProbeLabelTrend[];
  frequentRateLimitedLabels: Array<{ label: string; provider: AIProviderProbeProviderName; count: number }>;
};

export type AIProviderProbeExitPolicy = 'none' | 'all-down' | 'nvidia-all-down' | 'any-failure';

export const DEFAULT_AI_PROVIDER_PROBE_JSON_PATH = 'reports/seo/latest-ai-provider-probe.json';
export const DEFAULT_AI_PROVIDER_PROBE_MD_PATH = 'reports/seo/latest-ai-provider-probe.md';
export const DEFAULT_AI_PROVIDER_PROBE_TREND_JSON_PATH = 'reports/seo/latest-ai-provider-probe-trend.json';
export const DEFAULT_AI_PROVIDER_PROBE_TREND_MD_PATH = 'reports/seo/latest-ai-provider-probe-trend.md';
export const DEFAULT_AI_PROVIDER_PROBE_HISTORY_DIR = 'reports/seo/ai-provider-probe-history';

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_PROBE_PROMPT = 'Reply with exactly: {"health":"ok"}';
const DEFAULT_WORKERS_AI_SKIP_REASON =
  'Workers AI is intentionally excluded to avoid spending the free-only budget on health probes.';
const PROVIDER_LABELS: AIProviderProbeProviderName[] = ['nvidia', 'siliconflow', 'openrouter'];

function sanitizeStatus(status: number | null | undefined): number | null {
  return typeof status === 'number' && Number.isFinite(status) ? status : null;
}

function walkJsonFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJsonFiles(entryPath));
      continue;
    }
    if (entry.isFile() && extname(entry.name).toLowerCase() === '.json') {
      files.push(entryPath);
    }
  }

  return files;
}

function sanitizeTimestampForFile(timestamp: string): string {
  return timestamp.replace(/[:.]/g, '-');
}

function compareIso(a: string, b: string): number {
  return a.localeCompare(b);
}

function classifyProbeFailure(status: number | null, error: string | null): AIProviderProbeFailureClass {
  if (status == null && !error) return 'unknown_error';
  if (/insufficient balance|balance is insufficient|quota exceeded|insufficient credits/i.test(error || '')) {
    return 'billing_error';
  }
  if (status === 402) return 'billing_error';
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 402 || status === 403) return 'auth_error';
  if (typeof status === 'number' && status >= 500) return 'server_error';
  if (typeof status === 'number' && status >= 400) return 'client_error';
  if (/empty/i.test(error || '')) return 'empty_response';
  if (/abort|timeout|network|fetch failed|socket|econnreset|etimedout|enotfound/i.test(error || '')) {
    return 'network_error';
  }
  return 'unknown_error';
}

function trimErrorText(text: string | null | undefined): string | null {
  if (typeof text !== 'string') return null;
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 240) : null;
}

function getProviderUrl(provider: AIProviderProbeProviderName): string {
  switch (provider) {
    case 'nvidia':
      return 'https://integrate.api.nvidia.com/v1/chat/completions';
    case 'siliconflow':
      return 'https://api.siliconflow.cn/v1/chat/completions';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1/chat/completions';
  }
}

function buildProbeBody(provider: AIProviderProbeProviderName, prompt: string, model: string): Record<string, unknown> {
  return {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 40,
    ...(provider !== 'openrouter' ? { stream: false } : {}),
  };
}

function buildProbeHeaders(provider: AIProviderProbeProviderName, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://killer-skills.com';
    headers['X-Title'] = 'Killer-Skills Provider Probe';
  }
  return headers;
}

export function buildAIProviderProbeTargets(
  env: Record<string, string | undefined> = process.env,
  prompt: string = DEFAULT_PROBE_PROMPT,
): AIProviderProbeTarget[] {
  const onlinePool = buildAIOnlineProviderPool({
    nvidiaKeys: splitAIProviderKeys(
      env.NVIDIA_API_KEYS,
      env.NVIDIA_API_KEY,
      env.NVIDIA_API_KEYS_2,
      env.NVIDIA_API_KEYS_3,
      env.NVIDIA_API_KEYS_4,
      env.NVIDIA_API_KEYS_5,
    ),
    siliconFlowKey: env.SILICONFLOW_API_KEY,
    openRouterKeys: splitAIProviderKeys(env.OPENROUTER_API_KEYS, env.OPENROUTER_API_KEY),
  });

  return [...onlinePool.primaryCandidates, ...onlinePool.backupCandidates].map((candidate) => {
    const model = resolveAIProviderModel(candidate.provider, {
      scope: 'probe',
      env,
    }).model;

    return {
      provider: candidate.provider,
      label: candidate.label,
      apiKey: candidate.key,
      url: getProviderUrl(candidate.provider),
      model,
      headers: buildProbeHeaders(candidate.provider, candidate.key),
      body: buildProbeBody(candidate.provider, prompt, model),
    };
  });
}

async function timeoutFetch(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function probeAIProviderTarget(
  target: AIProviderProbeTarget,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<AIProviderProbeResult> {
  const startedAt = Date.now();
  try {
    const response = await timeoutFetch(
      target.url,
      {
        method: 'POST',
        headers: target.headers,
        body: JSON.stringify(target.body),
      },
      timeoutMs,
    );
    const latencyMs = Date.now() - startedAt;
    const text = trimErrorText(await response.text());

    if (!response.ok) {
      return {
        provider: target.provider,
        label: target.label,
        model: target.model,
        ok: false,
        status: sanitizeStatus(response.status),
        latencyMs,
        failureClass: classifyProbeFailure(response.status, text),
        error: text,
      };
    }

    if (!text) {
      return {
        provider: target.provider,
        label: target.label,
        model: target.model,
        ok: false,
        status: sanitizeStatus(response.status),
        latencyMs,
        failureClass: 'empty_response',
        error: 'empty response body',
      };
    }

    return {
      provider: target.provider,
      label: target.label,
      model: target.model,
      ok: true,
      status: sanitizeStatus(response.status),
      latencyMs,
      failureClass: 'ok',
      error: null,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const message = trimErrorText(error instanceof Error ? error.message : String(error));
    return {
      provider: target.provider,
      label: target.label,
      model: target.model,
      ok: false,
      status: null,
      latencyMs,
      failureClass: classifyProbeFailure(null, message),
      error: message,
    };
  }
}

async function runWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  const normalizedConcurrency = Math.max(1, Math.floor(concurrency));
  const results = new Array<TOutput>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(normalizedConcurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

function buildProviderGuidance(results: AIProviderProbeResult[]): string[] {
  const guidance: string[] = [];
  const nvidiaResults = results.filter((entry) => entry.provider === 'nvidia');
  const healthyNvidia = nvidiaResults.filter((entry) => entry.ok);
  const rateLimitedNvidia = nvidiaResults.filter((entry) => entry.failureClass === 'rate_limited');
  const healthyBackups = results.filter((entry) => entry.provider !== 'nvidia' && entry.ok);

  if (nvidiaResults.length === 0) {
    guidance.push('No NVIDIA keys are configured in this environment.');
  } else if (healthyNvidia.length === 0) {
    guidance.push(
      `All NVIDIA labels are unhealthy${healthyBackups.length > 0 ? '; backups are currently reachable.' : '.'}`,
    );
  } else if (healthyNvidia.length < nvidiaResults.length) {
    guidance.push(
      `Only ${healthyNvidia.length}/${nvidiaResults.length} NVIDIA labels are healthy. Prefer ${healthyNvidia.map((entry) => entry.label).join(', ')} while investigating the rest.`,
    );
  } else {
    guidance.push(`All ${healthyNvidia.length} configured NVIDIA labels responded successfully.`);
  }

  if (rateLimitedNvidia.length > 0) {
    guidance.push(
      `NVIDIA labels returning 429: ${rateLimitedNvidia.map((entry) => entry.label).join(', ')}. Rotate traffic away or cool them down before reusing them.`,
    );
  }

  const authFailures = results.filter((entry) => entry.failureClass === 'auth_error');
  if (authFailures.length > 0) {
    guidance.push(
      `Auth failures detected on ${authFailures.map((entry) => `${entry.label}:${entry.provider}`).join(', ')}. Verify secrets before treating these as quota issues.`,
    );
  }

  const billingFailures = results.filter((entry) => entry.failureClass === 'billing_error');
  if (billingFailures.length > 0) {
    guidance.push(
      `Billing or balance issues detected on ${billingFailures.map((entry) => `${entry.label}:${entry.provider}`).join(', ')}. Those backups will stay unavailable until credits are restored.`,
    );
  }

  const networkFailures = results.filter((entry) => entry.failureClass === 'network_error');
  if (networkFailures.length > 0) {
    guidance.push(
      `Network/timeouts affected ${networkFailures.map((entry) => `${entry.label}:${entry.provider}`).join(', ')}. Re-run the probe to distinguish transient network noise from provider pressure.`,
    );
  }

  if (healthyBackups.length === 0 && results.some((entry) => entry.provider !== 'nvidia')) {
    guidance.push(
      'No backup provider responded successfully. Guarded fallback may still have nowhere to go if NVIDIA exhausts.',
    );
  }

  guidance.push(DEFAULT_WORKERS_AI_SKIP_REASON);
  return guidance;
}

export function buildAIProviderProbeReport(
  results: AIProviderProbeResult[],
  generatedAt: string = new Date().toISOString(),
): AIProviderProbeReport {
  const totals = {
    total: results.length,
    nvidia: results.filter((entry) => entry.provider === 'nvidia').length,
    siliconflow: results.filter((entry) => entry.provider === 'siliconflow').length,
    openrouter: results.filter((entry) => entry.provider === 'openrouter').length,
  };

  const summary = {
    total: results.length,
    healthy: results.filter((entry) => entry.ok).length,
    unhealthy: results.filter((entry) => !entry.ok).length,
    nvidiaHealthy: results.filter((entry) => entry.provider === 'nvidia' && entry.ok).length,
    nvidiaUnhealthy: results.filter((entry) => entry.provider === 'nvidia' && !entry.ok).length,
    backupHealthy: results.filter((entry) => entry.provider !== 'nvidia' && entry.ok).length,
    backupUnhealthy: results.filter((entry) => entry.provider !== 'nvidia' && !entry.ok).length,
  };

  return {
    generatedAt,
    targets: totals,
    summary,
    byProvider: PROVIDER_LABELS.map((provider) => ({
      provider,
      configured: results.filter((entry) => entry.provider === provider).length,
      healthy: results.filter((entry) => entry.provider === provider && entry.ok).length,
      unhealthy: results.filter((entry) => entry.provider === provider && !entry.ok).length,
    })),
    workersAi: {
      probed: false,
      reason: DEFAULT_WORKERS_AI_SKIP_REASON,
    },
    guidance: buildProviderGuidance(results),
    results: [...results].sort((a, b) => {
      if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
      return a.label.localeCompare(b.label);
    }),
  };
}

export function renderAIProviderProbeReport(report: AIProviderProbeReport): string {
  const lines = [
    '# AI Provider Probe',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Targets: total=${report.targets.total}, nvidia=${report.targets.nvidia}, siliconflow=${report.targets.siliconflow}, openrouter=${report.targets.openrouter}`,
    `- Summary: healthy=${report.summary.healthy}, unhealthy=${report.summary.unhealthy}, nvidia healthy=${report.summary.nvidiaHealthy}/${report.targets.nvidia}, backups healthy=${report.summary.backupHealthy}/${report.targets.siliconflow + report.targets.openrouter}`,
    `- Workers AI: skipped`,
    `- Workers AI reason: ${report.workersAi.reason}`,
    '',
    '## Results',
    '',
  ];

  for (const result of report.results) {
    const status = result.status != null ? String(result.status) : '-';
    const health = result.ok ? 'OK' : `ERR/${result.failureClass}`;
    const errorText = result.error ? ` | ${result.error}` : '';
    lines.push(
      `- ${result.label} (${result.provider}) | ${health} | status=${status} | latency=${result.latencyMs}ms | model=${result.model}${errorText}`,
    );
  }

  lines.push('', '## Guidance', '');
  for (const item of report.guidance) {
    lines.push(`- ${item}`);
  }

  return lines.join('\n');
}

export function listAIProviderProbeSamples(
  reportsDir: string = resolve(process.cwd(), 'reports/seo'),
  latestPath?: string,
): AIProviderProbeSample[] {
  const resolvedReportsDir = resolve(process.cwd(), reportsDir);
  const historyDir = resolve(resolvedReportsDir, 'ai-provider-probe-history');
  const resolvedLatestPath = latestPath
    ? resolve(process.cwd(), latestPath)
    : resolve(resolvedReportsDir, 'latest-ai-provider-probe.json');
  const candidates = new Set<string>();

  try {
    for (const filePath of walkJsonFiles(historyDir)) {
      candidates.add(filePath);
    }
  } catch {
    // History is optional.
  }

  candidates.add(resolvedLatestPath);

  const deduped = new Map<string, AIProviderProbeSample>();
  for (const candidate of candidates) {
    try {
      const report = JSON.parse(readFileSync(candidate, 'utf-8')) as AIProviderProbeReport;
      if (!report.generatedAt || !Array.isArray(report.results)) continue;
      const sample: AIProviderProbeSample = {
        path: candidate,
        report,
        timestamp: report.generatedAt,
        mtimeMs: statSync(candidate).mtimeMs,
      };
      const fingerprint = [
        report.generatedAt,
        report.summary?.healthy ?? '',
        report.summary?.unhealthy ?? '',
        report.results
          .map(
            (entry) =>
              `${entry.label}:${entry.provider}:${entry.ok ? '1' : '0'}:${entry.failureClass}:${entry.status ?? ''}`,
          )
          .join('|'),
      ].join('::');
      const existing = deduped.get(fingerprint);
      if (!existing || existing.mtimeMs < sample.mtimeMs) {
        deduped.set(fingerprint, sample);
      }
    } catch {
      continue;
    }
  }

  return Array.from(deduped.values()).sort((a, b) => {
    const timeCompare = compareIso(a.timestamp, b.timestamp);
    if (timeCompare !== 0) return timeCompare;
    return a.path.localeCompare(b.path);
  });
}

function createProbeLabelTrend(result: AIProviderProbeResult): AIProviderProbeLabelTrend {
  return {
    label: result.label,
    provider: result.provider,
    appearances: 0,
    okCount: 0,
    failureCount: 0,
    rateLimitedCount: 0,
    authCount: 0,
    billingCount: 0,
    networkCount: 0,
    serverCount: 0,
    clientCount: 0,
    unknownCount: 0,
    avgLatencyMs: 0,
    lastLatencyMs: null,
    lastStatus: null,
    lastFailureClass: null,
    lastError: null,
    lastSeenAt: null,
  };
}

function applyProbeSample(
  trend: AIProviderProbeLabelTrend,
  result: AIProviderProbeResult,
  timestamp: string,
): AIProviderProbeLabelTrend {
  trend.appearances += 1;
  trend.avgLatencyMs = Number(
    ((trend.avgLatencyMs * (trend.appearances - 1) + result.latencyMs) / trend.appearances).toFixed(2),
  );
  trend.lastLatencyMs = result.latencyMs;
  trend.lastStatus = result.status;
  trend.lastFailureClass = result.failureClass;
  trend.lastError = result.error;
  trend.lastSeenAt = timestamp;

  if (result.ok) {
    trend.okCount += 1;
    return trend;
  }

  trend.failureCount += 1;
  if (result.failureClass === 'rate_limited') trend.rateLimitedCount += 1;
  else if (result.failureClass === 'auth_error') trend.authCount += 1;
  else if (result.failureClass === 'billing_error') trend.billingCount += 1;
  else if (result.failureClass === 'network_error') trend.networkCount += 1;
  else if (result.failureClass === 'server_error') trend.serverCount += 1;
  else if (result.failureClass === 'client_error') trend.clientCount += 1;
  else trend.unknownCount += 1;
  return trend;
}

function renderProbeTrendLine(entry: AIProviderProbeLabelTrend): string {
  return `- ${entry.label} (${entry.provider}) | ok=${entry.okCount}/${entry.appearances} | rate_limited=${entry.rateLimitedCount} | auth=${entry.authCount} | billing=${entry.billingCount} | network=${entry.networkCount} | last=${entry.lastFailureClass || 'ok'}${entry.lastStatus != null ? `/${entry.lastStatus}` : ''}`;
}

export function buildAIProviderProbeTrend(
  samples: AIProviderProbeSample[],
  reportsDir: string = resolve(process.cwd(), 'reports/seo'),
  generatedAt: string = new Date().toISOString(),
): AIProviderProbeTrend {
  const trends = new Map<string, AIProviderProbeLabelTrend>();

  for (const sample of samples) {
    for (const result of sample.report.results || []) {
      const key = `${result.provider}:${result.label}`;
      const current = trends.get(key) || createProbeLabelTrend(result);
      trends.set(key, applyProbeSample(current, result, sample.timestamp));
    }
  }

  const entries = Array.from(trends.values());
  const stableNvidia = entries
    .filter((entry) => entry.provider === 'nvidia')
    .sort((a, b) => {
      const successRateA = a.appearances > 0 ? a.okCount / a.appearances : 0;
      const successRateB = b.appearances > 0 ? b.okCount / b.appearances : 0;
      if (successRateA !== successRateB) return successRateB - successRateA;
      return a.label.localeCompare(b.label);
    })
    .slice(0, 6);
  const weakBackups = entries
    .filter((entry) => entry.provider !== 'nvidia')
    .sort((a, b) => {
      if (a.failureCount !== b.failureCount) return b.failureCount - a.failureCount;
      return a.label.localeCompare(b.label);
    })
    .slice(0, 6);
  const frequentRateLimitedLabels = entries
    .filter((entry) => entry.rateLimitedCount > 0)
    .sort((a, b) => {
      if (a.rateLimitedCount !== b.rateLimitedCount) return b.rateLimitedCount - a.rateLimitedCount;
      return a.label.localeCompare(b.label);
    })
    .slice(0, 6)
    .map((entry) => ({ label: entry.label, provider: entry.provider, count: entry.rateLimitedCount }));

  return {
    generatedAt,
    reportsDir: resolve(process.cwd(), reportsDir),
    sampleCount: samples.length,
    windowStart: samples[0]?.timestamp || null,
    windowEnd: samples.at(-1)?.timestamp || null,
    latestReportPath: samples.at(-1)?.path || null,
    stableNvidia,
    weakBackups,
    frequentRateLimitedLabels,
  };
}

export function renderAIProviderProbeTrendReport(trend: AIProviderProbeTrend): string {
  return [
    '# AI Provider Probe Trend',
    '',
    `- Generated at: ${trend.generatedAt}`,
    `- Reports dir: ${trend.reportsDir}`,
    `- Samples analyzed: ${trend.sampleCount}`,
    `- Window: ${trend.windowStart || 'n/a'} -> ${trend.windowEnd || 'n/a'}`,
    `- Latest sample: ${trend.latestReportPath || 'n/a'}`,
    '',
    '## Stable NVIDIA Labels',
    '',
    ...(trend.stableNvidia.length > 0
      ? trend.stableNvidia.map(renderProbeTrendLine)
      : ['- No NVIDIA probe history found']),
    '',
    '## Weak Backup Providers',
    '',
    ...(trend.weakBackups.length > 0
      ? trend.weakBackups.map(renderProbeTrendLine)
      : ['- No backup probe history found']),
    '',
    '## Frequent Rate Limits',
    '',
    ...(trend.frequentRateLimitedLabels.length > 0
      ? trend.frequentRateLimitedLabels.map(
          (entry) => `- ${entry.label} (${entry.provider}) | rate_limited_count=${entry.count}`,
        )
      : ['- No repeated rate limits observed across the current probe window']),
    '',
  ].join('\n');
}

export function resolveAIProviderProbeExitCode(
  report: AIProviderProbeReport,
  policy: AIProviderProbeExitPolicy = 'nvidia-all-down',
): number {
  if (policy === 'none') return 0;
  if (policy === 'any-failure') return report.summary.unhealthy > 0 ? 1 : 0;
  if (policy === 'all-down') return report.summary.healthy === 0 ? 1 : 0;
  if (policy === 'nvidia-all-down') {
    if (report.targets.nvidia === 0) {
      return report.summary.healthy === 0 ? 1 : 0;
    }
    return report.summary.nvidiaHealthy === 0 ? 1 : 0;
  }
  return 0;
}

export async function runAIProviderProbe(options?: {
  env?: Record<string, string | undefined>;
  prompt?: string;
  timeoutMs?: number;
  concurrency?: number;
  generatedAt?: string;
}): Promise<AIProviderProbeReport> {
  const targets = buildAIProviderProbeTargets(options?.env || process.env, options?.prompt || DEFAULT_PROBE_PROMPT);
  const results = await runWithConcurrency(targets, options?.concurrency || DEFAULT_CONCURRENCY, (target) =>
    probeAIProviderTarget(target, options?.timeoutMs || DEFAULT_TIMEOUT_MS),
  );
  return buildAIProviderProbeReport(results, options?.generatedAt || new Date().toISOString());
}

export function writeAIProviderProbeArtifacts(
  report: AIProviderProbeReport,
  options?: { jsonPath?: string; mdPath?: string; archiveDir?: string; archive?: boolean },
): {
  jsonPath: string;
  mdPath: string;
  archiveJsonPath: string | null;
  archiveMdPath: string | null;
} {
  const jsonPath = resolve(process.cwd(), options?.jsonPath || DEFAULT_AI_PROVIDER_PROBE_JSON_PATH);
  const mdPath = resolve(process.cwd(), options?.mdPath || DEFAULT_AI_PROVIDER_PROBE_MD_PATH);
  const archiveDir = resolve(process.cwd(), options?.archiveDir || DEFAULT_AI_PROVIDER_PROBE_HISTORY_DIR);
  const archiveEnabled = options?.archive !== false;
  const archiveBaseName = `ai-provider-probe-${sanitizeTimestampForFile(report.generatedAt)}`;
  const archiveJsonPath = archiveEnabled ? resolve(archiveDir, `${archiveBaseName}.json`) : null;
  const archiveMdPath = archiveEnabled ? resolve(archiveDir, `${archiveBaseName}.md`) : null;

  mkdirSync(dirname(jsonPath), { recursive: true });
  mkdirSync(dirname(mdPath), { recursive: true });

  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(mdPath, renderAIProviderProbeReport(report));

  if (archiveJsonPath && archiveMdPath) {
    mkdirSync(dirname(archiveJsonPath), { recursive: true });
    writeFileSync(archiveJsonPath, JSON.stringify(report, null, 2));
    writeFileSync(archiveMdPath, renderAIProviderProbeReport(report));
  }

  return { jsonPath, mdPath, archiveJsonPath, archiveMdPath };
}
