# Milestone v4.3 Requirements — Sitemap Purity & Search Coverage Consolidation

## 1. Active Requirements

### Sitemap Purity (SITEMAP)
- [x] **SITEMAP-01**: Ensure sitemap generation excludes redirects, dead links, or dynamic drafts.

### Trailing-Slash Consistency (SLASH)
- [x] **SLASH-01**: Resolve trailing-slash inconsistencies across the edge router, pages, and sitemaps.

### Unexpected 404 Cleanup (ERR404)
- [x] **ERR404-01**: Investigate and fix root causes of unexpected 404 crawl errors reported in GSC.

### Build & Integration Verification (INTEGRATE)
- [x] **INTEGRATE-02**: Verify global build, type safety, and all tests pass with zero regressions.

## 2. Out of Scope
- Redefining general crawler indexation rules or revising keyword translation algorithm parameters.
- Restructuring D1 database schema or migrating Cloudflare bindings unless strictly required by sitemap generation fixes.

## 3. Traceability Matrix

| Req ID | Mapped Phase | Verification File | Status |
|---|---|---|---|
| SITEMAP-01 | Phase 133 | `.planning/phases/133-sitemap-purity/133-VERIFICATION.md` | [x] |
| SLASH-01 | Phase 134 | `.planning/phases/134-trailing-slash-consistency/134-VERIFICATION.md` | [x] |
| ERR404-01 | Phase 135 | `.planning/phases/135-unexpected-404-cleanup/135-VERIFICATION.md` | [x] |
| INTEGRATE-02 | Phase 136 | `.planning/phases/136-system-build-regression-check/136-VERIFICATION.md` | [x] |
