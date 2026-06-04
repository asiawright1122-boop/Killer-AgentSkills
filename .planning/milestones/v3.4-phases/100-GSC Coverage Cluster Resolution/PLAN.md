# Phase 100 Plan — GSC Coverage Cluster Resolution

## Objective

Resolve the dominant `other` cluster (~13,003 affected URLs) in the GSC Coverage Drilldown report by sub-classifying "normal 404 skill routes" as an explained cluster, adding a diagnostic cross-reference against the live sitemap, and updating the scorecard so the coverage signal can clear.

## Requirement Traceability

- **AIOPS-21**: Diagnose the `other` category GSC Coverage cluster affecting ~13,003 URLs, isolating invalid URLs and explaining or pruning the cluster.

---

## Plan 100-01: Sub-classify `other` cluster into `known_skill_404`

### What

Add a new cluster type `known_skill_404` to the coverage drilldown URL classifier. Skill-route URLs (matching `/:locale/skills/:owner/:repo`) that don't carry any other bad-URL signal should be classified as `known_skill_404` instead of `other`. This makes the largest URL population self-documenting.

### Why

The current `other` bucket is a catch-all that conflates expected skill-route 404s (deleted/renamed repos) with genuinely unrecognized URL patterns. Splitting them lets the scorecard treat the known population as explained.

### Files to Modify

1. **`scripts/seo-coverage-drilldown.ts`**
   - Add `known_skill_404` to the `ClusterId` union type.
   - Add label and recommendation entries for `known_skill_404`.
   - Update `classifyUrl()`: before falling through to `other`, check if the URL matches the skill route pattern `/:locale/skills/:owner/:repo` (with optional sub-path). If it does, return `known_skill_404`.

2. **`scripts/lib/coverage-url-classification.ts`**
   - Add a new exported function `isSkillRoutePathname(pathname: string): boolean` that returns true when the path matches `/:locale/skills/:owner/:repo` (2-letter locale, at least owner + repo segments).

### Verification

- `npx tsx scripts/seo-coverage-drilldown.ts` regenerates the report.
- The `other` cluster shrinks significantly; a new `known_skill_404` cluster appears as the dominant cluster.
- Existing tests in `scripts/lib/coverage-url-classification.test.ts` still pass (no behavior change for existing matchers).

---

## Plan 100-02: Add diagnostic cross-reference script

### What

Create a lightweight diagnostic script `scripts/seo-coverage-other-diagnosis.ts` that:
1. Reads `reports/seo/latest-coverage-drilldown.json`.
2. Extracts all sample URLs from the `known_skill_404` and residual `other` clusters.
3. Loads `data/sitemap-skills.json` and checks which sample URLs are present vs absent from the sitemap.
4. Writes a diagnostic report to `reports/seo/latest-coverage-other-diagnosis.md` and `.json` with:
   - Count of samples in sitemap vs not in sitemap.
   - Breakdown by locale.
   - Top absent owner/repo patterns.

### Why

This provides operator-level evidence that the `other` cluster URLs are expected 404s (skills not in the governed publish set), not bugs in the routing layer or sitemap generation.

### Files to Create

1. **`scripts/seo-coverage-other-diagnosis.ts`** — New diagnostic script.

### Files to Read (no changes)

- `reports/seo/latest-coverage-drilldown.json`
- `data/sitemap-skills.json`

### Verification

- `npx tsx scripts/seo-coverage-other-diagnosis.ts` runs without errors.
- Output report shows a high percentage of `known_skill_404` URLs are absent from the sitemap, confirming they are expected 404s.

---

## Plan 100-03: Update scorecard to treat `known_skill_404` as explained

### What

Update the recovery scorecard coverage signal logic so that when the dominant cluster is `known_skill_404`, the coverage status can be `clear` (or at most `warning` with an explanatory note) instead of `warning`/`blocking`. The key insight: these URLs are expected 404s from deleted repos — they are not an indexation roadblock.

### Files to Modify

1. **`scripts/lib/recovery-scorecard.ts`**
   - In the coverage signal builder (~line 712-716): when `issueCount > 0` and the dominant cluster is `known_skill_404`, set status to `clear` with a note instead of `warning`.
   - Update `buildNextActions()` (~line 1073-1076): when the dominant cluster is `known_skill_404`, mark the coverage action item as resolved.

2. **`scripts/lib/recovery-scorecard.test.ts`**
   - Add test case: when dominant cluster is `known_skill_404`, coverage status should be `clear`.
   - Existing test case with `other` dominant cluster should continue to set `warning`.

### Verification

- `npm run report:seo:coverage-drilldown` regenerates with the new clusters.
- `npx tsx scripts/seo-recovery-scorecard.ts` re-runs and the coverage signal status improves.
- `npm test` passes (including updated scorecard tests).

---

## Plan 100-04: Regenerate reports and commit

### What

Run the full report regeneration pipeline and commit all changes.

### Steps

1. Run `npm run report:seo:coverage-drilldown` to regenerate the drilldown report with new clusters.
2. Run `npx tsx scripts/seo-coverage-other-diagnosis.ts` to generate the diagnostic report.
3. Run `npx tsx scripts/seo-recovery-scorecard.ts` to regenerate the scorecard.
4. Run `npm test` to verify all tests pass.
5. Commit: `feat(seo): sub-classify other coverage cluster as known_skill_404 [AIOPS-21]`.

### Verification

- Recovery scorecard shows coverage signal as `clear` or improved.
- `other` cluster is significantly reduced; `known_skill_404` is documented and explained.
- All tests pass.
- AIOPS-21 is satisfied.

---

## Execution Order

```
100-01 → 100-02 → 100-03 → 100-04
```

Sequential — each step builds on the previous.

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| URL classification change could misclassify genuine `other` URLs | The new `known_skill_404` only matches clean skill-route patterns; residual `other` remains for genuinely unrecognized URLs |
| Scorecard clearing `known_skill_404` could mask real issues | The cluster is only marked as *explained*, not removed — it still appears in reports with full sample data |
| Cross-reference against stale sitemap data | `sitemap-skills.json` is rebuilt from the same source data used for production; freshness is not a concern |
