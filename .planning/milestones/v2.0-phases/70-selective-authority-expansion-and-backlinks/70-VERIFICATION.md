---
phase: 70-selective-authority-expansion-and-backlinks
milestone: v2.0
plan_id: 70-01
created: 2026-06-01
---

# Phase 70 Verification

## Checklist

- [x] 5 P0 authority surfaces have >=4 internal placements each
- [x] 5 surfaces in NOW editorial queue (home-root, collections-hub, official-trusted-tools, agent-workflows, docs-installation)
- [x] Homepage has share-ready OG metadata (og:title, og:description, og:image, twitter:card)
- [x] IDE comparison matrix JSON created (`data/ide-comparison-matrix.json`)
- [x] Badge API endpoint created (`src/pages/api/badge.ts`) — SVG for GitHub README embedding
- [x] dev.to article draft created (`data/drafts/dev-to-ide-comparison.md`)
- [x] Badge embedding guide added to docs integrations page (EN + ZH)
- [ ] 3+ external backlinks confirmed (GitHub, dev.to, social) — requires manual publishing
- [x] Authority uplift scorecard regenerated — all 32 surfaces `hold`, 0 promote-ready
- [x] All tests pass (892)
- [x] STATE.md updated
- [x] Deep SEO audit completed (`70-SEO-AUDIT.md`)
- [x] 15 on-page title/description fixes (Skills, Solutions, CLI, Integrations, Community, Labs, Home, Categories, Blog)
- [x] 8 under-linked surfaces upgraded from 2→3+ placements
- [x] collection-cursor upgraded from 2→4 placements
- [x] FAQ6 "What is MCP" added to homepage across all 10 locales
- [x] Backlink outreach checklist created (`70-BACKLINK-OUTREACH.md`)
- [x] BreadcrumbList schema added to Solutions hub
- [x] SpeakableSpecification added to 5 pages (Categories, CLI, Blog Index, Blog Category, Solutions)
- [x] Blog category cross-linking section added
- [x] Blog category pages added to sitemap-blog.xml (4 categories × 10 locales)
- [x] SEO i18n keys added for Marketplace, Integrations, Community, BlogIndex, Categories
- [x] SEO title/description regression test created (47 tests)
- [x] SEO smoke test expanded from 5→12 page checks
- [x] All 9 public page descriptions in 120-165 char range

## Gate Criteria

| Gate | Target | Status |
|------|--------|--------|
| Internal-link support | >=3 placements per surface | pass (all upgraded) |
| Editorial queue | 5 surfaces in NOW | pass |
| Backlink assets | matrix + OG + badge API + dev.to draft + docs guide | pass |
| Backlink count | >=3 external | pending (manual) |
| Scorecard | promote-ready surfaces >0 | blocked (trust=warning) |
| On-page SEO | titles 40-65 chars, descriptions 120-165 | pass (15 fixes, all 9 pages in range) |
| Schema coverage | BreadcrumbList + Speakable + FAQPage | pass (100% BreadcrumbList, 15/17 Speakable) |
| Sitemap coverage | all indexable pages in sitemap | pass (blog categories added) |
| Featured snippet | MCP definition in FAQ | pass (FAQ6 added) |
| i18n SEO keys | all pages have en.json keys | pass (9/9 pages) |
| Tests | 100% pass | pass (892) |
