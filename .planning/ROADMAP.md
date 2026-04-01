# Roadmap — Killer-Skills v1.0

## Milestone Checklist

- [x] **Phase 1:** Theme Integrity Fixes (completed 2026-03-31)
- [x] **Phase 01.1:** Stabilize frontend interactions, breadcrumbs, i18n, and SEO contracts (completed 2026-03-31)
- [ ] **Phase 2:** Re-Enrichment Pipeline Run
- [ ] **Phase 3:** SEO Structure Improvements
- [ ] **Phase 4:** Keyword Research Integration
- [ ] **Phase 5:** Traffic Quality Monitoring

## Phase 1: Theme Integrity Fixes ✅ COMPLETE

**Goal**: Fix all code-level SEO theme compliance gaps.

All code fixes done. Next action: run AI regeneration pipeline.

**Impact**: ~1046+ skills will be re-enriched with theme-compliant SEO on next `npm run build:cache` run.

---

### Phase 01.1: Stabilize frontend interactions, breadcrumbs, i18n, and SEO contracts ✅ COMPLETE (INSERTED)

**Goal:** Restore reliable public-page interaction, eliminate leaked/mixed-language UI output, and unify breadcrumb/i18n/SEO contracts behind shared builders and tests.
**Status:** Completed 2026-03-31.
**Requirements**: [BASELINE-01, PUBLIC-CLICK-01, I18N-01, SEO-01, SEO-02, LOCALE-01, REGRESSION-01]
Requirement map:
- `BASELINE-01`: local dev baseline restored
- `PUBLIC-CLICK-01`: public pages clickable on desktop/mobile
- `I18N-01`: no raw translation keys on public pages
- `SEO-01`: breadcrumb UI and JSON-LD aligned
- `SEO-02`: canonical/hreflang logic unified
- `LOCALE-01`: locale definitions centralized
- `REGRESSION-01`: regression coverage added
**Depends on:** Phase 1
**Plans:** 6/6 plans complete

Plans:
- [x] 01.1-01-PLAN.md — Restore local Astro/Cloudflare reproducibility and add a reusable public-surface validation command
- [x] 01.1-02-PLAN.md — Normalize shared card click behavior and mobile overlay teardown with local E2E coverage
- [x] 01.1-03-PLAN.md — Centralize locale definitions and add explicit missing-translation helpers
- [x] 01.1-04-PLAN.md — Unify breadcrumb and metadata builders across layout and collections pages
- [x] 01.1-05-PLAN.md — Remove public-shell, homepage, and skills-index fallback leakage on the highest-traffic public surfaces
- [x] 01.1-06-PLAN.md — Clean remaining public route fallback leakage and add repo/local/post-deploy smoke guards

## Phase 2: Re-Enrichment Pipeline Run 🔲

**Goal**: Regenerate AI SEO for all skills failing theme checks.
**Plans:** 4 planned

**Steps**:
1. Run `npm run build:cache` (or `npm run pipeline:run`) so the new theme-compliance gates regenerate the flagged skill subset instead of treating them as already optimized
2. Audit local output quality before publish: `npm run audit:seo:index-quality`
3. Publish regenerated skill data to the canonical runtime store: `npm run sync:d1:delta`
4. Sync supporting KV assets only where needed: `npm run sync:kv`
5. Verify integrity and drift gates: `node --import tsx scripts/seo-index-integrity.ts --strict`

**Notes**:
- Skill page runtime data now treats D1 as the source of truth; `sync:kv` is supporting infrastructure for docs and sitemap assets, not the canonical publish gate for regenerated skill SEO.
- This phase should remain resumable and audit-first: prefer batch-safe reruns plus before/after metrics over one opaque "big bang" push.

Plans:
- [x] `02-01-PLAN.md` — Establish the flagged-skill baseline, dry-run reporting, and resumable batch inventory
- [ ] `02-02-PLAN.md` — Regenerate the flagged SEO dataset with checkpointed multilingual safeguards
- [ ] `02-03-PLAN.md` — Publish regenerated skill data through D1 and sync supporting KV assets
- [ ] `02-04-PLAN.md` — Run integrity audits, locale spot checks, and publish-ready reporting

**Expected outcome**: Skills with theme-compliant keywords increase from 2273 → 3319 (100%)

---

## Phase 3: SEO Structure Improvements 🔲

**Goal**: Improve technical SEO structure for all pages.

### 3a. JSON-LD Schema Markup
- Add `SoftwareApplication` schema to skill detail pages (`/[locale]/skills/[owner]/[repo]`)
- Add `ItemList` schema to collection pages
- **Impact**: Rich snippets in Google SERP → higher CTR

### 3b. Canonical Tag Enforcement
- Ensure `<link rel="canonical">` is set on all pages
- Cross-locale canonical pointing to `/en/` as default
- **Files to check**: `src/layouts/`, `src/pages/[locale]/`

### 3c. Internal Linking Strategy
- Collections pages → individual skill pages (already exists)
- Skill pages → related skills by category (missing)
- Blog posts → relevant skill pages (missing)
- **Impact**: PageRank distribution, crawl depth reduction

---

## Phase 4: Keyword Research Integration 🔲

**Goal**: Inject proven seed keywords into AI SEO pipeline for maximum organic traffic.

### 4a. Seed Keyword List
Create `data/seed-keywords.json` with high-intent, theme-aligned terms:
- "claude code skills" — navigational
- "cursor rules" / "cursorrules" — high volume
- "mcp server tools" — informational
- "ai coding agent workflow" — informational
- "windsurf skills" — navigational

### 4b. Prompt Enhancement
Feed seed keywords into AI SEO prompt as examples so generated keywords cluster around proven search terms.

### 4c. Long-tail Collection Expansion
- Generate collections for: `cursor-skills`, `windsurf-skills`, `mcp-servers`, `claude-code-extensions`
- Each collection = dedicated landing page with unique H1 and meta

---

## Phase 5: Traffic Quality Monitoring 🔲

**Goal**: Wire analytics and search console data into automated reporting.

- Wire GSC data (`scripts/gsc-fetch-report.ts`) to automated weekly report
- Track CTR by skill page, identify underperforming titles
- A/B test title formats: `[Skill] | AI Agent Skills` vs `[Skill] for Claude Code`
- Set up Core Web Vitals monitoring (LCP/CLS/INP)

---

## Guardrails (always enforce)
- Theme terms in ≥ 2 EN keywords per skill (enforced in `sanitizeSeoKeywordList`)
- Title must contain theme identifier (enforced in `isSkillFullyOptimized`)
- Non-official skills must reference AI ecosystem (enforced in `POSITIVE_THEME_KEYWORDS` gate)
- Product names never translated: Claude Code, Cursor, Windsurf, MCP (per `terminology-glossary.json`)
