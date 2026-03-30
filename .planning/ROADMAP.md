# Roadmap — Killer-Skills v1.0

## Phase 1: Theme Integrity Fixes ✅ COMPLETE

**Goal**: Fix all code-level SEO theme compliance gaps.

All code fixes done. Next action: run AI regeneration pipeline.

**Impact**: ~1046+ skills will be re-enriched with theme-compliant SEO on next `npm run build:cache` run.

---

### Phase 01.1: Stabilize frontend interactions, breadcrumbs, i18n, and SEO contracts (INSERTED)

**Goal:** Restore reliable public-page interaction, eliminate leaked/mixed-language UI output, and unify breadcrumb/i18n/SEO contracts behind shared builders and tests.
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
**Plans:** 5 plans

Plans:
- [x] 01.1-01-PLAN.md — Restore local Astro/Cloudflare reproducibility and add a reusable public-surface validation command
- [ ] 01.1-02-PLAN.md — Normalize shared card click behavior and mobile overlay teardown with local E2E coverage
- [ ] 01.1-03-PLAN.md — Centralize locale definitions and add explicit missing-translation helpers
- [ ] 01.1-04-PLAN.md — Unify breadcrumb and metadata builders across layout and collections pages
- [ ] 01.1-05-PLAN.md — Remove remaining public-shell key leakage and add repo/live smoke guards

## Phase 2: Re-Enrichment Pipeline Run 🔲

**Goal**: Regenerate AI SEO for all skills failing theme checks.

**Steps**:
1. Run `npm run build:cache` (or `npm run pipeline:run`) — the new `isSkillFullyOptimized()` checks will flag ~1046+ skills for re-enrichment
2. Sync to D1: `npm run sync:d1:delta`
3. Sync to KV: `npm run sync:kv`
4. Verify: `node --import tsx scripts/seo-index-integrity.ts --strict`

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
