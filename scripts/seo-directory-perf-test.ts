#!/usr/bin/env npx tsx

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

type SitemapSkillRecord = {
  owner?: string;
  repo?: string;
  routePath?: string;
};

export type PerfTestConfig = {
  url: string;
  concurrency: number;
  limit: number;
  maxAvgLatencyMs: number;
  reportPath: string;
};

export type PerfTestResult = {
  url: string;
  status: number;
  latencyMs: number;
  error?: string;
};

export type PerfReportSummary = {
  generatedAt: string;
  targetUrl: string;
  totalTested: number;
  successCount: number;
  failedCount: number;
  averageLatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  p95LatencyMs: number;
  passed: boolean;
  blockers: string[];
};

// 提取命令行参数
export function parseArgs(args: string[]): Partial<PerfTestConfig> {
  const config: Partial<PerfTestConfig> = {};
  for (const arg of args) {
    if (arg.startsWith('--url=')) {
      config.url = arg.slice('--url='.length);
    } else if (arg.startsWith('--concurrency=')) {
      config.concurrency = parseInt(arg.slice('--concurrency='.length), 10);
    } else if (arg.startsWith('--limit=')) {
      config.limit = parseInt(arg.slice('--limit='.length), 10);
    } else if (arg.startsWith('--max-avg-latency=')) {
      config.maxAvgLatencyMs = parseInt(arg.slice('--max-avg-latency='.length), 10);
    }
  }
  return config;
}

// 抽取 known repo keys 列表
export function getKnownRepoList(sitemapSkills: SitemapSkillRecord[]): Array<{ owner: string; repo: string }> {
  const knownRepoKeySet = new Set<string>();
  const list: Array<{ owner: string; repo: string }> = [];

  for (const skill of sitemapSkills) {
    const owner = typeof skill.owner === 'string' ? skill.owner.trim() : '';
    const rawRoutePath = typeof skill.routePath === 'string' ? skill.routePath.trim() : '';
    if (!owner || !rawRoutePath) continue;

    const repo = rawRoutePath.split('/').filter(Boolean)[0];
    if (!repo) continue;

    const repoKey = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
    if (knownRepoKeySet.has(repoKey)) continue;
    knownRepoKeySet.add(repoKey);

    list.push({ owner, repo });
  }

  return list;
}

// 性能测试核心执行逻辑
export async function executePerfTest(
  repos: Array<{ owner: string; repo: string }>,
  config: PerfTestConfig,
  fetchFn = fetch,
): Promise<PerfTestResult[]> {
  const results: PerfTestResult[] = [];
  const queue = [...repos];

  const worker = async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      const targetPath = `zh/skills/${item.owner}/${item.repo}`;
      const targetUrl = `${config.url.replace(/\/+$/, '')}/${targetPath}`;

      const start = Date.now();
      try {
        const response = await fetchFn(targetUrl);
        const latencyMs = Date.now() - start;
        results.push({
          url: targetUrl,
          status: response.status,
          latencyMs,
        });
      } catch (error) {
        const latencyMs = Date.now() - start;
        results.push({
          url: targetUrl,
          status: 0,
          latencyMs,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };

  const workers = Array.from({ length: Math.min(config.concurrency, queue.length) }, worker);
  await Promise.all(workers);
  return results;
}

// 指标汇总结算
export function analyzeResults(results: PerfTestResult[], config: PerfTestConfig): PerfReportSummary {
  const totalTested = results.length;
  if (totalTested === 0) {
    return {
      generatedAt: new Date().toISOString(),
      targetUrl: config.url,
      totalTested: 0,
      successCount: 0,
      failedCount: 0,
      averageLatencyMs: 0,
      maxLatencyMs: 0,
      minLatencyMs: 0,
      p95LatencyMs: 0,
      passed: false,
      blockers: ['No repository paths tested'],
    };
  }

  const successResults = results.filter((r) => r.status === 200);
  const successCount = successResults.length;
  const failedCount = totalTested - successCount;

  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const sum = latencies.reduce((a, b) => a + b, 0);
  const averageLatencyMs = sum / totalTested;
  const maxLatencyMs = latencies[totalTested - 1];
  const minLatencyMs = latencies[0];

  const p95Index = Math.min(Math.floor(totalTested * 0.95), totalTested - 1);
  const p95LatencyMs = latencies[p95Index];

  const blockers: string[] = [];
  if (failedCount > 0) {
    blockers.push(`Failed requests: ${failedCount}/${totalTested} returned non-200 or errored`);
  }
  if (averageLatencyMs > config.maxAvgLatencyMs) {
    blockers.push(
      `Average latency regression: ${averageLatencyMs.toFixed(1)}ms exceeded threshold of ${config.maxAvgLatencyMs}ms`,
    );
  }

  const passed = blockers.length === 0;

  return {
    generatedAt: new Date().toISOString(),
    targetUrl: config.url,
    totalTested,
    successCount,
    failedCount,
    averageLatencyMs,
    maxLatencyMs,
    minLatencyMs,
    p95LatencyMs,
    passed,
    blockers,
  };
}

export function renderMarkdownReport(summary: PerfReportSummary): string {
  const blockerSection = summary.passed
    ? '✓ Performance checks passed. No edge SSR latency or status regressions.'
    : summary.blockers.map((b) => `- ✗ ${b}`).join('\n');

  return [
    '# Repository Directory Crawl Performance Report',
    '',
    `- Generated: ${summary.generatedAt}`,
    `- Base URL: ${summary.targetUrl}`,
    `- Passed: ${summary.passed ? 'Yes' : 'No'}`,
    '',
    '## Test Metrics',
    `- Total paths tested: ${summary.totalTested}`,
    `- Success requests (200 OK): ${summary.successCount}`,
    `- Failed requests: ${summary.failedCount}`,
    `- Average latency: ${summary.averageLatencyMs.toFixed(1)} ms`,
    `- Max latency: ${summary.maxLatencyMs} ms`,
    `- Min latency: ${summary.minLatencyMs} ms`,
    `- P95 latency: ${summary.p95LatencyMs} ms`,
    '',
    '## Verification Status',
    blockerSection,
    '',
  ].join('\n');
}

// CLI 执行入口
async function main() {
  // 只在脚本作为主入口运行时执行
  if (process.argv[1] !== __filename) {
    return;
  }

  const dataDir = resolve(process.cwd(), 'data');
  const reportsDir = resolve(process.cwd(), 'reports/seo');
  const sitemapSkillsPath = resolve(dataDir, 'sitemap-skills.json');

  if (!existsSync(sitemapSkillsPath)) {
    console.error(`Error: ${sitemapSkillsPath} does not exist`);
    process.exit(1);
  }

  const sitemapSkillsRaw = JSON.parse(readFileSync(sitemapSkillsPath, 'utf8'));
  const sitemapSkills = Array.isArray(sitemapSkillsRaw) ? sitemapSkillsRaw : sitemapSkillsRaw.skills || [];
  const repos = getKnownRepoList(sitemapSkills);

  const cliConfig = parseArgs(process.argv.slice(2));
  const config: PerfTestConfig = {
    url: cliConfig.url || 'http://localhost:4321',
    concurrency: cliConfig.concurrency || 20,
    limit: cliConfig.limit !== undefined ? cliConfig.limit : 50, // 默认限制 50 次请求
    maxAvgLatencyMs: cliConfig.maxAvgLatencyMs || 400,
    reportPath: resolve(reportsDir, 'latest-directory-perf-report.md'),
  };

  const targetRepos = config.limit > 0 ? repos.slice(0, config.limit) : repos;
  console.log(
    `[perf-test] starting directory perf test. target=${config.url}, concurrency=${config.concurrency}, count=${targetRepos.length}`,
  );

  const results = await executePerfTest(targetRepos, config);
  const summary = analyzeResults(results, config);

  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(config.reportPath, renderMarkdownReport(summary), 'utf8');

  console.log(renderMarkdownReport(summary));

  if (!summary.passed) {
    console.error('[perf-test] Failed checking latency constraints!');
    process.exit(1);
  } else {
    console.log('[perf-test] All checks passed successfully.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
