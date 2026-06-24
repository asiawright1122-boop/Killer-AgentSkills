# Traffic Recovery Design: Index Slimdown + Authority Focus

**Date:** 2026-06-24
**Author:** Claude (ZCode)
**Status:** Approved — transitioning to implementation plan
**Approach:** 方案 A — 索引瘦身 + Authority 聚焦

---

## 1. Background & Diagnosis

### 1.1 Traffic Collapse Timeline

| Period | Page Impressions/wk | Distinct Queries | Clicks | State |
|--------|---------------------|------------------|--------|-------|
| Mar 11–Apr 7 (28d peak) | 3,154 | 148 | 14 | Visible |
| Apr 2–8 | 580 | 26-41 | 2 | Declining |
| Apr 9–15 | 266 | 20 | 0 | Collapse |
| Apr 22+ | 60-100 | 0-6 | 0-1 | Flatline |
| Jun 15–21 (latest) | 192* | 1 | 1 | Dead |

*Single-page anomaly (`/en/skills/atondwal/config` 114 impressions, 0 clicks).

The collapse coincided with a GSC API 403 permission error on April 9, 2026 (since resolved). However, the structural cause is likely a Google quality assessment downgrade, not just an indexing bug.

### 1.2 Root Cause Analysis

Google classifies killer-skills.com as a **large-scale GitHub-derived aggregation system with insufficient editorial added value**, consistent with:

- **Scaled Content Abuse** (Google Spam Policies, 2024)
- **Scraped Content with Insufficient Added Value** (Google Search Essentials)
- **Site Reputation Abuse** risk (if AI-generated overlays are perceived as "parasite" content on top of GitHub sources)

Evidence supporting this classification:

1. **5,308 "indexable" skill pages** whose main content body is a rendered GitHub README — the editorial overlay (agentAnalysis) is a compact summary atop bulk imported content.
2. **48,640 locale variants** of which only 9.4% have body content matching the URL locale — non-English URLs presenting English bodies with non-English canonicals/hreflang is a language-trust violation.
3. **10,783 GSC Coverage anomalies** dominated by known_skill_404 (5,499), source_file_path (4,011), and trailing_slash (971) — indicating Google discovered many URLs that were later removed or redirected, suggesting volatile URL patterns.
4. **0 of 35 authority surfaces** are promote-ready — the authority architecture exists in design but not in content depth.
5. **3,418 skills (55%) have zero stars** — the directory includes massive volumes of low-quality repos.

### 1.3 Why Previous Remediation Didn't Recover Traffic

v4.0–v4.7 (29 phases, 122-150) fixed the **technical layer** comprehensively:

- Crawl health: 100% 2xx, 0 4xx/5xx
- Index integrity: zero sitemap/cache drift
- Middleware: 410 Gone for source_file_path, 301 for trailing_slash, noindex for low-quality, locale governance enforcement
- Core Web Vitals: LCP/CLS/INP E2E audits passing
- Edge performance: Worker CPU optimization, cache warmup
- Originality filter: TF-IDF cosine similarity blocking duplicate repos

But **technical health ≠ editorial trust**. Google's quality algorithms evaluate content value, not just HTTP status codes. The site reads as technically healthy but editorially hollow — a well-engineered wrapper around other people's content.

---

## 2. Design

### 2.1 Index Tier System (Core Change)

Replace the binary indexable/reference_only system with a 3-tier system:

| Tier | Label | HTTP Robots | Sitemap | Eligibility |
|------|-------|-------------|---------|-------------|
| **Tier 1 — Indexable** | `index, follow` | `index, follow` | Included | `stars >= 50` AND `qualityScore >= 55` AND full agentAnalysis (recommendation >= 80 chars, useCases >= 2, limitations >= 1) AND `bodyEligible` for the locale |
| **Tier 2 — Support** | `noindex, follow` | `noindex, follow` | Excluded | Passes current indexability gate but fails Tier 1 (stars < 50 OR qualityScore < 55) |
| **Tier 3 — Reference** | `noindex, follow` | `noindex, follow` | Excluded | Fails current indexability gate entirely |

**Expected volumes:**

- Tier 1: ~300-500 skills (stars >= 50 narrows to ~945; qualityScore >= 55 further narrows to ~500-700; full agentAnalysis to ~300-500)
- Tier 2: ~4,000-4,800 skills (current indexable minus Tier 1)
- Tier 3: ~946 skills (current reference_only)

**Note on `stars` data freshness**: The `stars` field is populated from the GitHub API during the harvester pipeline run (`harvest-github-skills.ts` → `build-skills-cache.ts`), which runs in CI on a schedule. Stars may be stale by up to 7 days. This is acceptable: a skill that recently dropped below 50 stars will appear as Tier 1 until the next cache refresh, then gracefully downgrade to Tier 2 (noindex). No immediate action needed — the noindex signal will propagate on the next Google crawl after the tier change. The `stars` field is available in the `UnifiedSkill` type and accessible via `skill.stars` in `buildSkillIndexabilityAssessment()`.

**Implementation changes:**

1. **`src/lib/skill-indexability.ts`**:
   - Add `TIER1_MIN_STARS = 50` constant for non-official skills
   - Add `TIER1_QUALITY_THRESHOLD = 55` constant
   - Extend `buildSkillIndexabilityAssessment()` to compute `tier: 1 | 2 | 3`
   - Tier 1 requires all existing gates PLUS `stars >= TIER1_MIN_STARS` (or `verified` for official repos) PLUS `qualityScore >= TIER1_QUALITY_THRESHOLD`
   - Official repos bypass stars threshold (they are inherently trusted)

2. **`src/pages/[locale]/skills/[owner]/[...repo].astro`**:
   - Use `tier` from indexability assessment instead of `isIndexable` boolean
   - Tier 1: `<meta name="robots" content="index, follow">`
   - Tier 2/3: `<meta name="robots" content="noindex, follow">`
   - Tier 2 pages: show amber "Support Reference" notice (not as severe as Tier 3's "Source Notes" warning)
   - Tier 3 pages: keep existing amber "Source Notes" warning

3. **`src/pages/sitemap-skills.xml.ts`**:
   - Only include Tier 1 skills in the sitemap
   - Apply locale governance: only body-eligible locales get hreflang entries

4. **`data/seo-sitemap-blocklist.json`**:
   - No structural change — the blocklist continues to exclude specific skill paths
   - Tier 2/3 skills are additionally excluded from sitemap at generation time

5. **`src/lib/kv.ts`**:
   - `isPublicSitemapSkillCandidate()` gains a tier check: only Tier 1 skills are sitemap candidates
   - `getSitemapSkillsFromKV()` filters by tier

### 2.2 Authority Surface Upgrade

The goal: move at least 2 of the 35 authority surfaces from `hold` to `promote` status within 6 weeks, unlocking the Discovery Expansion boundary.

#### 2.2.1 P0 Surfaces — Editorial Content Injection (5 surfaces)

| Surface | Current Gap | Upgrade |
|---------|-------------|---------|
| **home-root** | Flat listing of Collections + directory | Restructure: "Curated Picks → Collections → Solutions → Blog → Directory". Add editorial intro paragraph explaining the site's mission and curation criteria. |
| **collections-hub** | Template-rendered grid | Add "Why these collections matter" section. Each collection card gets `editorialRationale` (1-2 sentences explaining why these specific skills were selected). |
| **collection-official** | Named list without justification | Add "Official Selection Criteria" section explaining what makes these repos official. Each skill gets an `editorialNote` (1-2 sentences). |
| **docs-installation** | Generic install steps | Complete with real verification steps (e.g., "Run `killer-skills list` to confirm installation"), testing commands, and cross-links to relevant collections. |
| **blog** | 35 posts, mostly announcements | Add 5 navigational "Best Of" posts: (1) Best MCP Servers 2026, (2) Claude Code vs Cursor vs Windsurf Comparison, (3) Top 10 Workflow Skills, (4) How to Evaluate AI Agent Skills, (5) Getting Started with MCP Integration |

#### 2.2.2 P1 Surfaces — Smart Enhancement (17 surfaces)

- Each collection page gains an `editorialRationale` field in its JSON definition
- Collections add "What makes these [official/community/productivity]" explanation paragraph
- Solution pages gain cross-links to matching collection pages and blog posts
- Install docs linked from every collection page

#### 2.2.3 Authority Uplift Scorecard Gate Adjustment

Current `promote` requirements are too strict. New promote criteria:

A surface promotes when it has ALL of:
1. `editorialRationale` content (not template-generated)
2. At least 3 internal links to other authority surfaces
3. Page renders without on-page SEO errors (verified by crawl-health)
4. Indexable by Google (not noindex)

This replaces the previous requirement of visible click/impression data (which is impossible when traffic is flatlined).

### 2.3 Non-English URL Body-Content Alignment

**Problem**: 90.6% of non-English locale variants show English body content on non-English URLs. This violates Google's multilingual site guidelines and is a primary trust-damaging signal.

**Design**:

1. **Strict locale governance enforcement in skill detail pages**:
   - In `[...repo].astro`, if `!bodyEligible` for the request locale → `noindex, follow`
   - This already exists in `seo-locales.ts` but the page rendering layer needs to enforce it more strictly
   - Canonical for all non-body-eligible locales → `/en/skills/{owner}/{repo}`

2. **Sitemap locale pruning**:
   - `sitemap-skills.xml.ts` already uses `seo-skill-locale-governance.json` but needs to filter by `bodyEligible`, not just `metadataEligible`
   - Only body-eligible locales get `<xhtml:link hreflang="{locale}">` entries
   - Non-body-eligible locales still get a canonical pointing to the English version but are excluded from hreflang

3. **Stop automated locale expansion**:
   - The `build-ssr-translations.ts` and `translate-locales.ts` scripts should NOT create new non-English skill pages unless body content is actually translated
   - Existing non-body-eligible pages remain accessible (no 404) but with `noindex, follow` and canonical → English

4. **Thin locale content defense**:
   - Add `MIN_LOCALE_BODY_MATCH_RATIO = 0.3` to `skill-indexability.ts`
   - A non-English locale page where <= 30% of the visible body text matches the declared locale gets `noindex`

### 2.4 URL Cleanup Closure (v4.8 Phase 151)

**Objective**: Reduce GSC Coverage anomalies from 10,783 to < 500 within 4 weeks.

| Cluster | Volume | Current Status | Action |
|---------|--------|----------------|--------|
| known_skill_404 | 5,499 | Middleware 410 Gone | Batch GSC Removal Request |
| source_file_path | 4,011 | Middleware 410 Gone | Batch GSC Removal Request |
| trailing_slash | 971 | Middleware 301 Redirect | Verify redirect targets work; batch GSC Removal for old URLs |
| query_parameter | 129 | Middleware handled | Batch GSC Removal Request |
| repeated_segment | 86 | Middleware 410 Gone | Batch GSC Removal Request |
| deep_skill_path | 43 | Middleware 404/301 | Batch GSC Removal Request |
| other | 43 | Mixed | Manual review → classify → remediate |

**New script: `scripts/gsc-removal-batch-builder.ts`**

- Reads `data/seo-404-rules.json` (current 410/301 rules)
- Reads `reports/seo/latest-coverage-drilldown.json` (active anomalies)
- Cross-references with `data/seo-sitemap-blocklist.json`
- Outputs a ranked removal list: URLs that are (a) covered by middleware rules and (b) still indexed per GSC
- Supports batch submission via GSC URL Removal API (if available) or generates CSV for manual submission
- Priority order: source_file_path > known_skill_404 > trailing_slash > others

**Verification**:

- Post-removal: run `gsc-url-inspection-verify.ts` on sample URLs to confirm de-indexing
- Weekly tracking via `seo-recovery-scorecard.ts` Gate 2 (Coverage Freshness)
- Target: coverage anomalies < 500 within 4 weeks of bulk removal

### 2.5 Verification & Measurement

#### 2.5.1 Recovery Scorecard Updates

Add two new gates:

**Gate 6 — Index Quality Ratio**
- Metric: `tier1Skills / totalSkills`
- Current: approximately 4,580/6,190 = 74% of locale variants are indexable — this is the wrong ratio
- Better metric: `tier1Skills / totalCanonicalSkills` (canonical = English-only unique skill count)
- Target: Tier 1 ratio >= 8% (implies ~500 Tier 1 out of ~6,200 total)
- Threshold: `clear` if >= 5%, `warning` if 3-5%, `blocking` if < 3%

**Gate 7 — Language Alignment**
- Metric: `bodyEligibleNonEnVariants / totalNonEnVariants`
- Current: 9.4% (4,580 body-eligible out of 48,640 non-en variants — this data point is from governance report)
- Target: >= 80% body alignment among pages allowed to be indexable
- Threshold: `clear` if >= 80%, `warning` if 50-80%, `blocking` if < 50%

#### 2.5.2 GSC Monitoring Increments

- `gsc-search-health-monitor.ts`: Add tracking for Tier 1 page impressions (segmented by tier)
- Weekly CTR report: Add "Authority Surface Performance" section tracking impressions/clicks on P0/P1 surfaces
- New alert: `gsc_index_shrink_signal` — fires when Tier 1 page count drops below expected range

#### 2.5.3 E2E Test Coverage

New test files:

1. **`tests/e2e/index-tier.spec.ts`**:
   - Verify Tier 1 skill page returns `<meta name="robots" content="index, follow">`
   - Verify Tier 2/3 skill page returns `<meta name="robots" content="noindex, follow">`
   - Verify canonical correctness per tier
   - Verify sitemap contains only Tier 1 skill URLs

2. **`tests/pages/sitemaps.test.ts` (extend)**:
   - Test that no Tier 2/3 URLs appear in any skills sitemap
   - Test that Tier 1 URLs with bodyEligible=false for non-en locale are not in sitemap with that locale

3. **Unit tests for `skill-indexability.ts`**:
   - Test tier computation: given stars/qualityScore/agentAnalysis/verified → correct tier
   - Test edge cases: official repos with stars < 50 still get Tier 1
   - Test locale body alignment integration

---

## 3. Data Flow

### 3.1 Skill Indexability Assessment (Updated)

```
buildSkillIndexabilityAssessment(skill, locale)
  |
  |-- Check localeEligible (existing)
  |-- Check hasRecommendation >= 80 chars (existing)
  |-- Check hasUseCases >= 2 (existing)
  |-- Check hasLimitations >= 1 (existing)
  |-- Check hasStrongQualitySignal: verified OR qualityScore >= 35 (existing)
  |-- Check hasSupportingSourceEvidence >= 200 bytes (existing)
  |-- NEW: Check bodyLocaleAlignment (non-en only)
  |     |-- detectPrimaryContentLocale() from seo-locales.ts
  |     |-- If body locale != URL locale AND no high-quality translation → bodyEligible = false
  |
  |-- Compute composite score (existing + new body alignment signal)
  |
  |-- Determine tier:
  |     |-- Tier 1: score >= 7 AND (verified OR stars >= 50) AND qualityScore >= 55 AND bodyEligible
  |     |-- Tier 2: isIndexable (old definition) but NOT Tier 1
  |     |-- Tier 3: NOT isIndexable (old definition)
  |
  |-- Return: { tier, isIndexable: tier === 1, ...existing_fields }
```

### 3.2 Sitemap Generation (Updated)

```
getSitemapSkillsFromKV()
  |
  |-- Load skills from KV cache
  |-- Filter: isPublicSitemapSkillCandidate() (existing)
  |-- NEW: Filter by tier === 1
  |-- NEW: For each skill, only include body-eligible locales in hreflang
  |-- Emit <url> entries with:
        |-- <loc> = /{canonicalLocale}/skills/{owner}/{routePath}
        |-- <xhtml:link hreflang="{l}"> for each body-eligible locale
        |-- No xhtml:link for non-body-eligible locales
        |-- canonical points to canonicalLocale version
```

### 3.3 GSC Removal Flow (New)

```
gsc-removal-batch-builder.ts
  |
  |-- Load seo-404-rules.json (known 410/301 targets)
  |-- Load latest-coverage-drilldown.json (GSC anomalies)
  |-- Load seo-sitemap-blocklist.json (excluded skills)
  |-- Cross-reference: URLs that have middleware rules AND appear in GSC coverage
  |-- Rank by cluster priority (source_file_path > known_skill_404 > trailing_slash)
  |-- Output:
        |-- reports/seo/latest-gsc-removal-batch.md (human-readable)
        |-- reports/seo/latest-gsc-removal-batch.csv (for GSC UI bulk submission)
        |-- reports/seo/latest-gsc-removal-batch.json (machine-readable)
```

---

## 4. Error Handling

### 4.1 Tier Downgrade Fallback

If a skill loses Tier 1 eligibility (e.g., stars drop below 50, agentAnalysis removed):
- The page automatically returns `noindex, follow` on next SSR render
- The sitemap excludes it on next build
- No explicit GSC Removal needed — Google will de-index naturally as it crawls the noindex signal
- The page remains accessible to users and passes link equity via `follow`

### 4.2 GSC Removal API Limitations

The GSC URL Removal API has a 1000-URL/day limit. For the 10,783 coverage anomalies:
- Batch into daily chunks over 11 days
- Priority order: source_file_path (4,011) first, then known_skill_404 (5,499), then remaining
- Track removal status weekly
- Fall back to manual GSC UI submission if API is unavailable

### 4.3 Locale Governance Conflicts

If a skill has `metadataEligible` for a locale but `!bodyEligible`:
- Page renders with `noindex, follow`
- Canonical points to English version
- Sitemap omits this locale variant
- No hreflang entry for this locale
- Users can still access the page (it is not 404'd) — it just won't appear in Google

---

## 5. Configuration Changes

### 5.1 New Constants

| File | Constant | Value | Purpose |
|------|----------|-------|---------|
| `skill-indexability.ts` | `TIER1_MIN_STARS` | `50` | Non-official skills need 50+ stars for Tier 1 |
| `skill-indexability.ts` | `TIER1_QUALITY_THRESHOLD` | `55` | Quality score floor for Tier 1 |
| `skill-indexability.ts` | `MIN_LOCALE_BODY_MATCH_RATIO` | `0.3` | Minimum body locale match ratio for non-en indexability |

### 5.2 Modified Constants

| File | Constant | Old | New | Reason |
|------|----------|-----|-----|--------|
| `skill-indexability.ts` | `DEFAULT_QUALITY_THRESHOLD` | `35` | `35` (unchanged) | Tier 2 still uses 35 as the bar; Tier 1 uses its own threshold |
| `skill-indexability.ts` | `DEFAULT_SCORE_THRESHOLD` | `7` | `7` (unchanged) | Tier 2 still uses 7; Tier 1 uses a higher effective threshold via the tier check |

Note: The Tier 1 gate is implemented as a separate check (`TIER1_QUALITY_THRESHOLD = 55`, `TIER1_MIN_STARS = 50`) above and beyond the existing `DEFAULT_QUALITY_THRESHOLD` and `DEFAULT_SCORE_THRESHOLD`. The existing thresholds remain unchanged for Tier 2/3 classification.

### 5.3 Data Schema Changes

| Collection/File | Field | Type | Purpose |
|----------------|-------|------|---------|
| Collection JSON files | `editorialRationale` | `Record<string, string>` | Per-locale editorial justification for the collection |
| Skill data (in D1/KV) | `seo.tier` | `1 \| 2 \| 3` | Computed tier for the canonical (English) skill page |
| `reports/seo/latest-gsc-removal-batch.json` | New file | Object | GSC removal batch with ranked URL list |

---

## 6. Rollout Plan (High-Level)

**Phase A — Index Slimdown (Week 1-2)**:
1. Implement tier system in `skill-indexability.ts`
2. Update sitemap generation to filter by Tier 1
3. Update skill detail page rendering to use tier for robots meta
4. Deploy and verify: crawl-health should show correct robots headers on all tiers

**Phase B — URL Cleanup (Week 2-3)**:
5. Build and run `gsc-removal-batch-builder.ts`
6. Submit GSC removal requests in batches (first batch: source_file_path cluster)
7. Monitor coverage anomaly count declining

**Phase C — Authority Upgrade (Week 3-6)**:
8. Add editorial content to P0 surfaces (home, collections, docs, blog)
9. Add `editorialRationale` to P1 collection JSONs
10. Write and publish 5 new blog posts
11. Run authority-uplift-scorecard → target: 2 surfaces at `promote`

**Phase D — Measurement (Week 4-8)**:
12. Weekly GSC monitoring with new tier-segmented metrics
13. Track Tier 1 page impressions and Authority Surface impressions
14. Verify coverage anomaly count < 500
15. Expect initial traffic recovery signals by Week 4-8

---

## 7. Success Criteria

| Metric | Current | Target (6 weeks) | Target (12 weeks) |
|--------|---------|------------------|--------------------|
| Indexable Tier 1 skills | ~5,308 | ~300-500 | ~300-500 (stable) |
| GSC Coverage anomalies | 10,783 | < 2,000 | < 500 |
| Non-en body alignment | 9.4% | >= 50% | >= 80% |
| Authority surfaces at `promote` | 0 | 2 | 5 |
| Weekly page impressions | ~100 | 500+ | 1,000+ |
| Weekly clicks | 0-1 | 5+ | 15+ |
| Distinct query coverage | 1-6 | 20+ | 50+ |

---

## 8. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Google doesn't re-evaluate despite changes | Traffic stays flat | Continue authority building; consider Google reconsideration request after 8 weeks of clean signals |
| Index slimdown removes too many long-tail entries | Lose remaining 1 click/week | Tier 2 pages remain `follow`; can promote more Tier 2 pages to Tier 1 if needed |
| GSC Removal API unavailable | Manual cleanup slow | Use GSC UI manual submission; 410 Gone + noindex signals will eventually take effect |
| Editorial content flagged as AI-generated | E-E-A-T concern | Ensure editorial content is human-reviewed; add author bylines and editorial process page |
| Locale pruning creates 404s | Google discovers removed pages | No pages return 404 — they render with `noindex, follow` and canonical to English version |
