import { describe, expect, it } from 'vitest';
import {
  buildCanonicalizeVerificationResult,
  normalizeRedirectLocation,
  parseCanonicalizeFollowupMarkdown,
  renderCanonicalizeVerificationMarkdown,
} from './gsc-canonicalize-verification';

describe('gsc canonicalize verification helpers', () => {
  it('parses follow-up markdown entries with spaces in urls', () => {
    const entries = parseCanonicalizeFollowupMarkdown(`
# GSC Canonicalize Follow-up

- https://killer-skills.com/en/skills/MeganHarrison/alleato-pm
  - category: skill_repo_root_single_target
  - target: https://killer-skills.com/en/skills/MeganHarrison/alleato-pm/Writing Hookify Rules
  - reason: Repo-root URL should resolve to the repo's single public skill route.
`);

    expect(entries).toEqual([
      {
        sourceUrl: 'https://killer-skills.com/en/skills/MeganHarrison/alleato-pm',
        category: 'skill_repo_root_single_target',
        targetUrl: 'https://killer-skills.com/en/skills/MeganHarrison/alleato-pm/Writing Hookify Rules',
        reason: "Repo-root URL should resolve to the repo's single public skill route.",
      },
    ]);
  });

  it('normalizes relative redirects against the source url', () => {
    const normalized = normalizeRedirectLocation(
      'https://killer-skills.com/en/skills/MeganHarrison/alleato-pm',
      '/en/skills/MeganHarrison/alleato-pm/Writing%20Hookify%20Rules',
    );

    expect(normalized).toBe(
      'https://killer-skills.com/en/skills/MeganHarrison/alleato-pm/Writing%20Hookify%20Rules',
    );
  });

  it('marks redirects as verified after url normalization', () => {
    const result = buildCanonicalizeVerificationResult({
      entry: {
        sourceUrl: 'https://killer-skills.com/en/skills/MeganHarrison/alleato-pm',
        category: 'skill_repo_root_single_target',
        targetUrl: 'https://killer-skills.com/en/skills/MeganHarrison/alleato-pm/Writing Hookify Rules',
        reason: 'Repo-root URL should resolve to the repo root single target.',
      },
      statusCode: 301,
      locationHeader: '/en/skills/MeganHarrison/alleato-pm/Writing%20Hookify%20Rules',
    });

    expect(result.matched).toBe(true);
    expect(result.failureReason).toBeNull();
  });

  it('renders a failure section when mismatches remain', () => {
    const markdown = renderCanonicalizeVerificationMarkdown({
      generatedAt: '2026-04-19T00:00:00.000Z',
      inputPath: 'reports/seo/gsc-removal-canonicalize-followup-2026-04-19.md',
      checkedCount: 1,
      verifiedCount: 0,
      failureCount: 1,
      results: [
        {
          sourceUrl: 'https://killer-skills.com/en/docs/development/create-skill',
          category: 'docs_legacy_slug',
          expectedTargetUrl: 'https://killer-skills.com/en/docs/creating-skills',
          reason: 'Docs page uses a legacy slug and should redirect to the canonical docs URL.',
          statusCode: 404,
          locationHeader: null,
          normalizedLocationUrl: null,
          matched: false,
          failureReason: 'Expected a redirect status, got 404.',
        },
      ],
    });

    expect(markdown).toContain('## Failures');
    expect(markdown).toContain('Expected a redirect status, got 404.');
  });
});
