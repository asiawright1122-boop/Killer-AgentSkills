import { describe, it, expect, vi } from 'vitest';
import {
  parseArgs,
  getKnownRepoList,
  executePerfTest,
  analyzeResults,
  type PerfTestConfig,
  type PerfTestResult,
} from './seo-directory-perf-test';

describe('seo-directory-perf-test', () => {
  describe('parseArgs', () => {
    it('correctly parses CLI arguments', () => {
      const args = ['--url=http://test-server:5000', '--concurrency=10', '--limit=30', '--max-avg-latency=150'];
      const parsed = parseArgs(args);
      expect(parsed.url).toBe('http://test-server:5000');
      expect(parsed.concurrency).toBe(10);
      expect(parsed.limit).toBe(30);
      expect(parsed.maxAvgLatencyMs).toBe(150);
    });

    it('returns empty object when no valid args are provided', () => {
      const parsed = parseArgs([]);
      expect(parsed).toEqual({});
    });
  });

  describe('getKnownRepoList', () => {
    it('extracts owner and repo and dedupes the list', () => {
      const mockSkills = [
        { owner: 'OwnerA', routePath: 'repo-1/skill-a' },
        { owner: 'OwnerA', routePath: 'repo-1/skill-b' }, // 相同 repo，需去重
        { owner: 'OwnerB', routePath: 'repo-2/skill-c' },
        { owner: '', routePath: 'repo-3/skill-d' }, // 无效 owner
        { owner: 'OwnerC', routePath: '' }, // 无效 routePath
      ];

      const list = getKnownRepoList(mockSkills);
      expect(list).toHaveLength(2);
      expect(list).toContainEqual({ owner: 'OwnerA', repo: 'repo-1' });
      expect(list).toContainEqual({ owner: 'OwnerB', repo: 'repo-2' });
    });
  });

  describe('executePerfTest', () => {
    it('requests directory pages and measures latencies', async () => {
      const mockRepos = [
        { owner: 'User1', repo: 'Repo1' },
        { owner: 'User2', repo: 'Repo2' },
      ];

      const config: PerfTestConfig = {
        url: 'http://localhost:4321',
        concurrency: 2,
        limit: 2,
        maxAvgLatencyMs: 200,
        reportPath: 'dummy.md',
      };

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        return {
          status: 200,
          url,
        };
      });

      const results = await executePerfTest(mockRepos, config, mockFetch);
      expect(results).toHaveLength(2);
      expect(results[0].status).toBe(200);
      expect(results[0].url).toContain('/zh/skills/User1/Repo1');
      expect(results[1].status).toBe(200);
      expect(results[1].url).toContain('/zh/skills/User2/Repo2');
      expect(results[0].latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('captures request errors correctly', async () => {
      const mockRepos = [{ owner: 'User1', repo: 'Repo1' }];
      const config: PerfTestConfig = {
        url: 'http://localhost:4321',
        concurrency: 1,
        limit: 1,
        maxAvgLatencyMs: 200,
        reportPath: 'dummy.md',
      };

      const mockFetch = vi.fn().mockImplementation(async () => {
        throw new Error('Connection refused');
      });

      const results = await executePerfTest(mockRepos, config, mockFetch);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe(0);
      expect(results[0].error).toBe('Connection refused');
    });
  });

  describe('analyzeResults', () => {
    const config: PerfTestConfig = {
      url: 'http://localhost:4321',
      concurrency: 5,
      limit: 10,
      maxAvgLatencyMs: 200,
      reportPath: 'dummy.md',
    };

    it('identifies passed status when latency is low and requests succeed', () => {
      const results: PerfTestResult[] = [
        { url: 'url1', status: 200, latencyMs: 50 },
        { url: 'url2', status: 200, latencyMs: 150 },
      ];

      const summary = analyzeResults(results, config);
      expect(summary.passed).toBe(true);
      expect(summary.totalTested).toBe(2);
      expect(summary.failedCount).toBe(0);
      expect(summary.averageLatencyMs).toBe(100);
      expect(summary.maxLatencyMs).toBe(150);
      expect(summary.p95LatencyMs).toBe(150);
      expect(summary.blockers).toHaveLength(0);
    });

    it('identifies failures when requests fail or latency is exceeded', () => {
      const results: PerfTestResult[] = [
        { url: 'url1', status: 500, latencyMs: 50 }, // 失败
        { url: 'url2', status: 200, latencyMs: 350 }, // 延迟高
      ];

      const summary = analyzeResults(results, config);
      expect(summary.passed).toBe(false);
      expect(summary.failedCount).toBe(1);
      expect(summary.averageLatencyMs).toBe(200); // 虽然平均值是 200，但依然通过？等下，阈值是 200，200 <= 200。但有 failedCount。
      expect(summary.blockers).toContain('Failed requests: 1/2 returned non-200 or errored');
    });

    it('identifies failures when average latency exceeds threshold', () => {
      const results: PerfTestResult[] = [
        { url: 'url1', status: 200, latencyMs: 250 },
        { url: 'url2', status: 200, latencyMs: 250 },
      ];

      const summary = analyzeResults(results, config);
      expect(summary.passed).toBe(false);
      expect(summary.blockers).toContain('Average latency regression: 250.0ms exceeded threshold of 200ms');
    });

    it('fails when results are empty', () => {
      const summary = analyzeResults([], config);
      expect(summary.passed).toBe(false);
      expect(summary.blockers).toContain('No repository paths tested');
    });
  });
});
