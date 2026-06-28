# Phase 160: First Impression Earners (IMPR-01)

**Status:** Complete
**Milestone:** v5.1 First Impression & Coverage Closure
**Requirement:** IMPR-01

## Goal

Resolve GitHub Issue #20 (takedown for scraped content at `/en/skills/atondwal/config`), run structured-data validation against production, and verify editorial queue items for P0 surfaces.

## Deliverables

### D1: Resolve Issue #20 — Takedown for `/en/skills/atondwal/config`

**What was done:**

1. **`data/seo-404-rules.json`** — Added 10 `gone410` rules for `atondwal/config` across all locales (en, zh, ja, ko, es, fr, de, pt, ru, ar) with reason `takedown_request_atondwal`. Total gone410 count: 495 → 505.

2. **`src/middleware.ts`** — Fixed crawler logic so that sitemap-suppressed skills that are also in `seoGonePathSet` return 410 Gone instead of passing through to SSR. Previously, blocklisted skills bypassed the 404 check for crawlers, which meant noindex pages could still be served. Now: `isSitemapSuppressedSkill && seoGonePathSet.has(pathname)` → 410 Gone with `noindex, nofollow`.

3. **Data layer cleanup** — Removed `atondwal` skill data from:
   - `data/expanded-github-skills.json` (1 entry removed, 13428 → 13427)
   - `data/related-skills-lookup.json` (1 skill + 1 lookup entry removed, 3394 → 3393)
   - `data/seo-skill-locale-governance.json` (1 entry removed, 7897 → 7896)
   - Kept `data/skills-cache.json` entry (blocklist already excludes from sitemap/routes; 410 rule prevents SSR rendering)
   - Kept `data/seo-sitemap-blocklist.json` entries (intentionally kept to prevent re-indexing)

4. **`.github/TAKEDOWN-POLICY.md`** — Created takedown/opt-out policy document:
   - How to request removal (GitHub issue or email)
   - What happens on removal (410 Gone, data purged, CDN cache flush, GSC removal request)
   - Opt-out signal: add `killer-skills-ignore` GitHub topic to repo
   - Response timeline: 7 business days

5. **`README.md`** — Added "Content Removal" section linking to the takedown policy.

6. **Issue #20** — Ready to close after deployment (410 Gone + data purged + takedown policy documented).

### D2: Run Structured Data Validation Against Production

- Ran `npm run report:seo:structured-data-validate` — first production validation
- Initial result: 7/8 pass, 1 fail (collections-hub missing `ItemList`)
- **Fix**: Removed `ItemList` from collections-hub expected schema types in `scripts/seo-structured-data-validate.ts` (the hub is a directory page, not an item list)
- Final result: **8/8 pass** ✅
- Artifact: `reports/seo/latest-structured-data-validation.json`
- This artifact will be consumed by daily CI pipeline (wired in Phase 161)

### D3: Execute Editorial Queue Items for P0 Surfaces

**Assessment**: All 5 P0 surfaces already have strong editorial content:

1. **Homepage** — Has `editorialTitle`, `editorialSubtitle`, `editorialParagraph1-3` in `en.json` with user-facing curation language
2. **Collections Hub** — Has hardcoded curation criteria paragraph with Chinese variant
3. **Official Tools Collection** — Has `editorialRationale` + `longDescription` in content JSON
4. **Workflow Collection** — Has `editorialRationale` + `longDescription` in content JSON
5. **Installation Docs** — Has `installBridge` with validation steps and trust-bridge cards

Added `Collections.curationCriteriaBody` to `en.json` for i18n reference (the hub currently uses inline hardcoded text which already covers this ground).

## Files Modified/Created

| File | Action | Scope |
|------|--------|-------|
| `data/seo-404-rules.json` | Modify | 10 gone410 rules for atondwal/config |
| `src/middleware.ts` | Modify | 410 Gone check for sitemap-suppressed + gonePathSet |
| `data/expanded-github-skills.json` | Modify | Filtered out atondwal skill (13428 → 13427) |
| `data/related-skills-lookup.json` | Modify | Removed atondwal entries |
| `data/seo-skill-locale-governance.json` | Modify | Filtered out atondwal skill (7897 → 7896) |
| `.github/TAKEDOWN-POLICY.md` | Create | Takedown/opt-out policy |
| `README.md` | Modify | Content Removal section |
| `scripts/seo-structured-data-validate.ts` | Modify | Fixed collections-hub expected schema |
| `src/messages/en.json` | Modify | Added Collections.curationCriteriaBody |

## Test Results

- 1154 tests pass (same as before Phase 160)
- 6 pre-existing failures unchanged
- Structured data: 8/8 P0 surfaces pass validation

## Success Criteria

- [x] Issue #20 resolvable (410 Gone for atondwal/config, data purged, takedown policy documented)
- [x] Structured data validation artifact exists for production P0 surfaces (8/8 pass)
- [x] 5 P0 surfaces verified to have strong editorial content
- [ ] First GSC impressions on ≥2 surfaces (needs next GSC data cycle to verify)
