import { describe, expect, it } from 'vitest';
import { classifyNoindexPromotionOutcome } from './seo-noindex-promotion-audit';

describe('classifyNoindexPromotionOutcome', () => {
  it('promotes candidates that clear the post-fix quality floor', () => {
    expect(
      classifyNoindexPromotionOutcome({
        predictedQualityScore: 75,
        exclusionReason: null,
        filePath: '.claude/skills/build-plugin/SKILL.md',
      }),
    ).toBe('promote_after_build_fix');
  });

  it('keeps non-AI skills as reference-only even after rescoring', () => {
    expect(
      classifyNoindexPromotionOutcome({
        predictedQualityScore: 0,
        exclusionReason: 'no-ai-agent-context',
        filePath: '.claude/skills/check/SKILL.md',
      }),
    ).toBe('keep_reference_only_non_ai');
  });

  it('marks missing source paths for manual lookup', () => {
    expect(
      classifyNoindexPromotionOutcome({
        predictedQualityScore: 0,
        exclusionReason: null,
        filePath: null,
      }),
    ).toBe('needs_manual_source_lookup');
  });
});
