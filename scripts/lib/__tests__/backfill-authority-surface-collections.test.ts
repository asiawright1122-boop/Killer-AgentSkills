import { describe, expect, it } from 'vitest';
import { evaluateCollectionForBackfill } from '../backfill-authority-surface-collections';

describe('backfill quality gate', () => {
  it('admits a collection with editorial block and reviewedAt', () => {
    const result = evaluateCollectionForBackfill({
      canonicalSlug: 'top-foo',
      editorial: { selectionReason: { en: 'x' }, maintenance: { reviewedAt: '2026-06-01' } },
    } as any, { existingSlugs: new Set(['other']), driftIssues: {} });
    expect(result.admit).toBe(true);
  });

  it('rejects a collection already in manifest', () => {
    const result = evaluateCollectionForBackfill({
      canonicalSlug: 'top-foo',
      editorial: { maintenance: { reviewedAt: '2026-06-01' } },
    } as any, { existingSlugs: new Set(['top-foo']), driftIssues: {} });
    expect(result.admit).toBe(false);
    expect(result.reason).toBe('already_in_manifest');
  });

  it('rejects a collection missing editorial block', () => {
    const result = evaluateCollectionForBackfill({
      canonicalSlug: 'top-foo',
    } as any, { existingSlugs: new Set(), driftIssues: {} });
    expect(result.admit).toBe(false);
    expect(result.reason).toBe('missing_editorial');
  });

  it('rejects a collection missing reviewedAt', () => {
    const result = evaluateCollectionForBackfill({
      canonicalSlug: 'top-foo',
      editorial: { selectionReason: { en: 'x' }, maintenance: {} },
    } as any, { existingSlugs: new Set(), driftIssues: {} });
    expect(result.admit).toBe(false);
    expect(result.reason).toBe('missing_reviewed_at');
  });

  it('rejects a collection flagged in drift issues', () => {
    const result = evaluateCollectionForBackfill({
      canonicalSlug: 'top-foo',
      editorial: { selectionReason: { en: 'x' }, maintenance: { reviewedAt: '2026-06-01' } },
    } as any, { existingSlugs: new Set(), driftIssues: { 'top-foo': ['duplicate_mcp_slug_token'] } });
    expect(result.admit).toBe(false);
    expect(result.reason).toBe('drift_issue');
  });
});
