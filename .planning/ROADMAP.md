# Roadmap: Killer-Skills Agent Directory

## Overview

Milestone v4.9 Authority Surface Uplift & Coverage Freshness is active. Phases 153-155 are defined to execute editorial uplift on promote-ready P0 authority surfaces, establish a fresh GSC Coverage pipeline to open the discovery expansion boundary, and submit the 975-URL GSC removal batch.

## Immediate Next Actions

- [x] Plan Phase 153: P0 Authority Surface Editorial Uplift.
- [ ] Plan Phase 154: Coverage Freshness Pipeline & Expansion Boundary Opening.
- [ ] Plan Phase 155: GSC Removal Batch Submission & Index Verification.

## Current Milestone: v4.9 Authority Surface Uplift & Coverage Freshness

**Goal:** Execute editorial uplift on the 8 promote-ready P0 authority surfaces, refresh the GSC Coverage Drilldown pipeline to open the discovery expansion boundary, and submit the 975-URL removal batch to resolve the 10,783 coverage anomaly count.

**Requirements:**

- [ ] UPLIFT-01: **P0 Editorial Uplift**: Apply first-party selection logic, install guidance, comparisons, and operational context to the 8 promote-ready P0 authority surfaces.
- [ ] COV-01: **Coverage Freshness Pipeline**: Establish a repeatable GSC Coverage Drilldown refresh workflow so coverage age stays ≤7 days.
- [ ] REMOV-01: **Removal Batch Execution**: Submit the 975-URL GSC removal batch and verify index reduction.

### Phase 153: P0 Authority Surface Editorial Uplift

- **Requirements:** UPLIFT-01
- **Scope:** Apply "Proof Over Wrapper" principles to the 8 promote-ready P0 authority surfaces.
- **Status:** Complete
- **Plans:** 1/1 plans complete
- **Success Criteria:**
  - All 8 P0 surfaces have non-template editorial rationale, install guidance, and comparison context. ✓ (verified rendering: homepage "Why These Tools First" + "Selection Criteria", collections have selectionReason/trustSignals/executionExamples, solutions have useCases/limitations, comparison blog posts in 10+ locales)
  - Internal-link placements verified live (≥3 per surface). ✓ (homepage→collections 11 links, collections hub→3 P0 collections linked, all nav paths resolve)
  - Crawl health remains clean (4xx ≤0.2%, 5xx=0) after content changes. ✓ (build clean, 436 Tier 1 URLs unchanged, 1075 tests pass)

### Phase 154: Coverage Freshness Pipeline & Expansion Boundary Opening

- **Requirements:** COV-01
- **Scope:** Ingest a fresh GSC Coverage Drilldown CSV export, refresh all downstream reports (delta-board, proof-window, authority-uplift, compliance-matrix), and verify the discovery expansion boundary opens from `closed` to `open`.
- **Status:** Not started
- **Plans:** 0/1 plans complete
- **Success Criteria:**
  - Coverage Drilldown source age ≤7 days.
  - Discovery expansion boundary status = `open`.
  - Search compliance matrix overall verdict = `pass` (not `block` or `unavailable`).
  - Automation policy status moves from `locked` to `unlocked` (or explicitly documented why it remains locked).

### Phase 155: GSC Removal Batch Submission & Index Verification

- **Requirements:** REMOV-01
- **Scope:** Submit the 975-URL GSC removal batch via the Google Search Console URL Removal tool, then verify index reduction through coverage anomaly count and crawl health monitoring.
- **Status:** Not started
- **Plans:** 0/1 plans complete
- **Success Criteria:**
  - 975 URLs submitted to GSC URL Removal tool.
  - Coverage anomaly count reduced from 10,783 (target: <5,000 within 4 weeks of submission).
  - Recovery scorecard Gate 2 (coverage-drilldown) remains `clear` after submission.

## Milestones

- 🟩 **v4.9 Authority Surface Uplift & Coverage Freshness** — phases 153-155 (active; [requirements](./REQUIREMENTS.md))
- ✅ **v4.8 Crawl Remediation & Discovery Expansion** — phases 151-152 (shipped 2026-06-26; [archive](./milestones/v4.8-ROADMAP.md), [requirements](./milestones/v4.8-REQUIREMENTS.md), [audit](./milestones/v4.8-MILESTONE-AUDIT.md))
- ✅ **v4.7 Core Web Vitals & Edge Performance Optimization** — phases 148-150 (shipped 2026-06-24; [archive](./milestones/v4.7-ROADMAP.md), [requirements](./milestones/v4.7-REQUIREMENTS.md), [audit](./milestones/v4.7-MILESTONE-AUDIT.md))

## Carry-Forward Themes

- **Promotion proof before expansion:** discovery expansion stays closed until at least two primary authority surfaces earn `promote` under fresh evidence. (Now satisfied: 34 surfaces promote-ready, but coverage freshness gate still blocks the boundary.)
- **User-facing proof before promotion:** authority surfaces need visible selection criteria, maintained proof, and clear setup handoffs before scorecard emphasis increases.
- **Coverage cleanup before scale:** expected 404s, source-path URLs, and trailing-slash drift should be contained before broadening indexable inventory.
- **Public boundary is a release gate:** internal reasoning, operator-only process notes, raw provider diagnostics, and caught exception internals must never become frontend or public API copy.
- **Automation after repeatability:** no experiment should move into automation until proof, authority, and measurement gates all clear.

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|---|---|---|---|---|
| v4.9 Authority Surface Uplift & Coverage Freshness | 153-155 | 1/3 | Phase 153 Complete | Active |
| v4.8 Crawl Remediation & Discovery Expansion | 151-152 | 2/2 | Complete | 2026-06-26 |
| v4.7 Core Web Vitals & Edge Performance Optimization | 148-150 | 3/3 | Complete | 2026-06-24 |
| v4.6 GitHub Workflow SEO & Harvester Hardening | 144-147 | 4/4 | Complete | 2026-06-24 |
| v4.5 GSC Crawl & AI Telemetry Hardening | 140-143 | 4/4 | Complete | 2026-06-23 |
| v4.4 GSC Opportunity & Authority Promotion | 137-139 | 3/3 | Complete | 2026-06-23 |
| v4.3 Sitemap Purity & Search Coverage Consolidation | 133-136 | 4/4 | Complete | 2026-06-23 |
| v4.2 Repository Size Reduction & Locale Configuration Normalization | 130-132 | 3/3 | Complete | 2026-06-23 |
| v4.1 Multi-language Indexability Restructuring & SEO Acceleration | 126-129 | 4/4 | Complete | 2026-06-23 |
| v4.0 Authority Proof Remediation & Public Trust Hardening | 122-125 | 4/4 | Complete | 2026-06-22 |

---
*Last updated: 2026-06-26 after initializing v4.9*
