import { describe, expect, it } from 'vitest';
import {
  clusterProgress,
  extractRepoPrefix,
  findSafePrefixes,
  type Batch,
  type Tracker,
} from './seo-gsc-removal-tracker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeBatch(urls: Array<{ url: string; cluster: string }>): Batch {
  const byCluster: Batch['byCluster'] = {};
  for (const u of urls) {
    byCluster[u.cluster] = byCluster[u.cluster] || { count: 0, sample: [] };
    byCluster[u.cluster].count++;
    if (byCluster[u.cluster].sample.length < 5) {
      byCluster[u.cluster].sample.push(u.url);
    }
  }
  return {
    generatedAt: '2026-06-25T00:00:00.000Z',
    totalUrls: urls.length,
    byCluster,
    urls: urls.map((u, i) => ({ ...u, priority: i + 1 })),
  };
}

function emptyTracker(batch: Batch): Tracker {
  return {
    batchGeneratedAt: batch.generatedAt,
    batchTotalUrls: batch.totalUrls,
    submissions: [],
    lastUpdated: '2026-06-26T00:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// extractRepoPrefix
// ---------------------------------------------------------------------------
describe('extractRepoPrefix', () => {
  it('extracts the /{locale}/skills/{owner}/{repo} segment from a skill URL', () => {
    expect(
      extractRepoPrefix(
        'https://killer-skills.com/pt/skills/kindfi-org/kindfi/docs/setup.md',
      ),
    ).toBe('https://killer-skills.com/pt/skills/kindfi-org/kindfi');
  });

  it('handles the core locale', () => {
    expect(
      extractRepoPrefix('https://killer-skills.com/core/skills/owner/repo/sub'),
    ).toBe('https://killer-skills.com/core/skills/owner/repo');
  });

  it('returns null for non-skill paths', () => {
    expect(
      extractRepoPrefix('https://killer-skills.com/en/collections/top-tools'),
    ).toBeNull();
  });

  it('returns null for external URLs', () => {
    expect(extractRepoPrefix('https://example.com/en/skills/a/b')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findSafePrefixes — the critical safety guarantee
//
// A prefix is "safe" only when the repo landing page itself is in the removal
// batch. Otherwise GSC prefix removal would collateral-remove a live page.
// ---------------------------------------------------------------------------
describe('findSafePrefixes', () => {
  it('recommends a prefix when the landing page is itself a removal target', () => {
    const batch = makeBatch([
      // Landing page IS in batch → prefix removal is safe
      { url: 'https://killer-skills.com/en/skills/acme/tool', cluster: 'skill_blocklisted' },
      { url: 'https://killer-skills.com/en/skills/acme/tool/docs/readme.md', cluster: 'source_file' },
      { url: 'https://killer-skills.com/en/skills/acme/tool/src/main.py', cluster: 'source_file' },
    ]);

    const safe = findSafePrefixes(batch, 2);
    expect(safe).toHaveLength(1);
    expect(safe[0].prefix).toBe('https://killer-skills.com/en/skills/acme/tool/');
    expect(safe[0].urlCount).toBe(3); // landing page + 2 source files
    // cluster is the first-encountered URL's cluster (the landing page here)
    expect(safe[0].cluster).toBe('skill_blocklisted');
  });

  it('rejects a prefix whose landing page is NOT in the batch (no collateral removal)', () => {
    // Two source-file URLs under a repo, but the landing page is live (not in batch).
    const batch = makeBatch([
      { url: 'https://killer-skills.com/en/skills/acme/tool/docs/readme.md', cluster: 'source_file' },
      { url: 'https://killer-skills.com/en/skills/acme/tool/src/main.py', cluster: 'source_file' },
    ]);

    const safe = findSafePrefixes(batch, 2);
    expect(safe).toHaveLength(0);
  });

  it('respects the minCount threshold', () => {
    const batch = makeBatch([
      { url: 'https://killer-skills.com/en/skills/acme/tool', cluster: 'skill_blocklisted' },
      { url: 'https://killer-skills.com/en/skills/acme/tool/docs/readme.md', cluster: 'source_file' },
    ]);

    // 2 URLs under prefix, but minCount=3 → excluded
    expect(findSafePrefixes(batch, 3)).toHaveLength(0);
    // minCount=2 → included
    expect(findSafePrefixes(batch, 2)).toHaveLength(1);
  });

  it('sorts candidates by urlCount descending', () => {
    const batch = makeBatch([
      // Large cluster
      { url: 'https://killer-skills.com/en/skills/big/repo', cluster: 'skill_blocklisted' },
      { url: 'https://killer-skills.com/en/skills/big/repo/a.md', cluster: 'source_file' },
      { url: 'https://killer-skills.com/en/skills/big/repo/b.md', cluster: 'source_file' },
      { url: 'https://killer-skills.com/en/skills/big/repo/c.md', cluster: 'source_file' },
      // Small cluster
      { url: 'https://killer-skills.com/en/skills/small/repo', cluster: 'skill_blocklisted' },
      { url: 'https://killer-skills.com/en/skills/small/repo/a.md', cluster: 'source_file' },
    ]);

    const safe = findSafePrefixes(batch, 2);
    expect(safe).toHaveLength(2);
    expect(safe[0].urlCount).toBeGreaterThanOrEqual(safe[1].urlCount);
    expect(safe[0].prefix).toBe('https://killer-skills.com/en/skills/big/repo/');
  });

  it('returns an empty array when no URLs have a repo prefix', () => {
    const batch = makeBatch([
      { url: 'https://killer-skills.com/en/collections/top-tools', cluster: 'trailing_slash' },
      { url: 'https://killer-skills.com/fr/skills?q=ai', cluster: 'query_param' },
    ]);
    expect(findSafePrefixes(batch, 1)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// clusterProgress
// ---------------------------------------------------------------------------
describe('clusterProgress', () => {
  it('reports zero submitted for an empty tracker', () => {
    const batch = makeBatch([
      { url: 'https://killer-skills.com/en/skills/a/b', cluster: 'source_file' },
      { url: 'https://killer-skills.com/en/skills/c/d', cluster: 'skill_blocklisted' },
    ]);

    const progress = clusterProgress(batch, emptyTracker(batch));
    expect(progress).toHaveLength(2);
    for (const c of progress) {
      expect(c.submitted).toBe(0);
      expect(c.remaining).toBe(c.batchCount);
      expect(c.complete).toBe(false);
    }
  });

  it('marks a cluster complete when submitted count meets the batch count', () => {
    const batch = makeBatch([
      { url: 'https://killer-skills.com/en/skills/a/b', cluster: 'source_file' },
      { url: 'https://killer-skills.com/en/skills/c/d', cluster: 'source_file' },
    ]);

    const tracker = emptyTracker(batch);
    tracker.submissions.push({
      cluster: 'source_file',
      urlCount: 2,
      submittedAt: '2026-06-26T00:00:00.000Z',
      method: 'individual',
    });

    const progress = clusterProgress(batch, tracker);
    const sourceFile = progress.find((c) => c.cluster === 'source_file');
    expect(sourceFile?.submitted).toBe(2);
    expect(sourceFile?.remaining).toBe(0);
    expect(sourceFile?.complete).toBe(true);
  });

  it('aggregates multiple submissions for the same cluster', () => {
    const batch = makeBatch([
      { url: 'https://killer-skills.com/en/skills/a/b', cluster: 'source_file' },
      { url: 'https://killer-skills.com/en/skills/c/d', cluster: 'source_file' },
      { url: 'https://killer-skills.com/en/skills/e/f', cluster: 'source_file' },
    ]);

    const tracker = emptyTracker(batch);
    tracker.submissions.push(
      {
        cluster: 'source_file',
        urlCount: 1,
        submittedAt: '2026-06-26T00:00:00.000Z',
        method: 'individual',
      },
      {
        cluster: 'source_file',
        urlCount: 1,
        submittedAt: '2026-06-26T00:01:00.000Z',
        method: 'individual',
      },
    );

    const progress = clusterProgress(batch, tracker);
    expect(progress[0].submitted).toBe(2);
    expect(progress[0].remaining).toBe(1);
    expect(progress[0].complete).toBe(false);
  });

  it('clamps remaining at zero when over-submitted', () => {
    const batch = makeBatch([
      { url: 'https://killer-skills.com/en/skills/a/b', cluster: 'source_file' },
    ]);
    const tracker = emptyTracker(batch);
    tracker.submissions.push({
      cluster: 'source_file',
      urlCount: 5, // exceeds batch count of 1
      submittedAt: '2026-06-26T00:00:00.000Z',
      method: 'individual',
    });

    const progress = clusterProgress(batch, tracker);
    expect(progress[0].remaining).toBe(0);
    expect(progress[0].complete).toBe(true);
  });
});
