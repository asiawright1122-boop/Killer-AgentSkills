# Phase 134: Trailing-Slash Consistency - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning
**Source:** Codebase scan and trailing-slash research

<domain>
## Phase Boundary

This phase corrects relative link path variations ending in trailing slashes to guarantee URL consistency under `trailingSlash: 'never'`, eliminating crawl-waste 301 redirects.

</domain>

<decisions>
## Implementation Decisions

### Blog relative links correction
- Update `automating-i18n-workflows-with-llms.md` home link targets across all 10 language directories to use `/ar`, `/de`, `/en`, `/es`, `/fr`, `/ja`, `/ko`, `/pt`, `/ru`, and `/zh` without trailing slashes.

### Test suite enhancement
- Add strict regexp patterns in `tests/pages/public-links.test.ts` to scan for relative trailing slashes (e.g. `href="/..."` and `(/.../)`), making sure any future occurrences trigger test failures during PR builds.

</decisions>

<canonical_refs>
## Canonical References

- [public-links.test.ts](file:///Users/kaka/Dev/Killer-Skills/tests/pages/public-links.test.ts)
- `src/content/blog/*/automating-i18n-workflows-with-llms.md`

</canonical_refs>
