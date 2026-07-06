export type BackfillVerdict = {
  admit: boolean;
  reason: 'already_in_manifest' | 'missing_editorial' | 'missing_reviewed_at' | 'drift_issue' | 'ok';
};

export type EvaluateArgs = {
  existingSlugs: Set<string>;
  driftIssues: Record<string, string[]>;
};

const DRIFT_CODES_THAT_BLOCK = new Set([
  'duplicate_mcp_slug_token',
  'duplicate_server_slug_token',
  'canonical_map_mismatch',
]);

export function evaluateCollectionForBackfill(
  collection: { canonicalSlug?: string; editorial?: { selectionReason?: unknown; trustSignals?: unknown; maintenance?: { reviewedAt?: string } } },
  args: EvaluateArgs,
): BackfillVerdict {
  const slug = collection.canonicalSlug;
  if (!slug) return { admit: false, reason: 'missing_editorial' };
  if (args.existingSlugs.has(slug)) return { admit: false, reason: 'already_in_manifest' };

  const issues = args.driftIssues[slug] ?? [];
  if (issues.some((code) => DRIFT_CODES_THAT_BLOCK.has(code))) {
    return { admit: false, reason: 'drift_issue' };
  }

  const editorial = collection.editorial;
  const hasEditorialContent =
    editorial &&
    ((editorial.selectionReason && Object.values(editorial.selectionReason as Record<string, string>).some(Boolean)) ||
      (editorial.trustSignals && Object.values(editorial.trustSignals as Record<string, string[]>).some((v) => v && v.length)));
  if (!hasEditorialContent) return { admit: false, reason: 'missing_editorial' };
  if (!editorial?.maintenance?.reviewedAt) return { admit: false, reason: 'missing_reviewed_at' };

  return { admit: true, reason: 'ok' };
}
