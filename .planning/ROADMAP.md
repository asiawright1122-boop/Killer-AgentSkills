# Roadmap: Killer-Skills Agent Directory

## Overview

Milestone v4.6 GitHub Workflow SEO & Harvester Hardening is active. Phases 144-147 are defined to refactor and harden the GitHub Actions workflow and scripts responsible for skill harvesting, localization, and automated enrichment.

## Immediate Next Actions

- [x] Plan Phase 144: Harvester SEO Compliance & Originality Filter. (completed 2026-06-23)

## Current Milestone: v4.6 GitHub Workflow SEO & Harvester Hardening

**Goal:** Refactor and harden the GitHub Actions workflow and scripts responsible for skill harvesting and localization to ensure generated content complies with search guidelines from the source.

**Requirements:**

- [ ] HARV-01: **Crawler & Harvester compliance**: Refactor automated crawler/harvester and submission workflows to enforce content originality filters, blocking low-value mirror content from source.
- [ ] GEO-01: **GEO-localized translation sync**: Enforce CJK terminal punctuation and formatting rules in dynamic translation workflows to ensure GEO-local typography compliance.
- [ ] GEO-02: **Semantic translation phrasing**: Modernize semantic phrasing translation policies to avoid simple machine translations and ensure SEO-appropriate descriptions.
- [ ] META-01: **Automated Backlog Metadata Enrichment**: Integrate automated batch enrichment pipelines in workflows to automatically discover keywords and populate missing editorial details.
- [ ] CI-01: **CI/CD validation loops**: Implement automated gate checking (copy leakages, Prettier formatting, translation parity, and CJK punctuation) in GitHub Actions on commit/PR.
- [ ] INTEG-01: **Build & Regression Integrity**: Enforce 100% build stability, clean TypeScript compile checks, and Vitest test suite regression checks.

### Phase 144: Harvester SEO Compliance & Originality Filter

- **Requirements:** HARV-01
- **Scope:** Refactor the crawler/harvester and submission workflows to enforce content originality filters, blocking low-value mirror content from source.
- **Status:** Complete (2026-06-23)
- **Plans:** 0/1 plans complete
- **Success Criteria:**
  - Harvester/crawler logic filters out source pages with a similarity score above 85% compared to existing skills.
  - Automated submission pipeline rejects posts that do not meet minimum originality and word count checks.
  - Integration tests added to assert that low-originality mirror pages are correctly identified and skipped during harvest.

### Phase 145: GEO-localized translation sync & CJK Punctuation

- **Requirements:** GEO-01, GEO-02
- **Scope:** Modernize translation sync workflow to conform with GEO-localized typographic rules (e.g. CJK terminal punctuation, spacing, and phrasing) and SEO-appropriate descriptions.
- **Status:** Complete (2026-06-24)
- **Plans:** 0/1 plans complete
- **Success Criteria:**
  - Translation sync script validates CJK character regions and replaces western punctuation with CJK full-width punctuation (e.g. `，`, `。`, `？`, `！`) and proper spacing.
  - Phrasing policy replaces literal machine translations with SEO-vetted localized terminologies.
  - Typographic compliance validated by tests asserting correct CJK terminal punctuation and formatting.

### Phase 146: Automated Backlog Metadata & Keyword Enrichment

- **Requirements:** META-01
- **Scope:** Integrate automated batch enrichment pipelines in workflows to automatically discover keywords and populate missing collection/skill details.
- **Status:** Not started
- **Plans:** 0/1 plans complete
- **Success Criteria:**
  - Batch metadata enrichment pipeline executes via GitHub Actions to discover relevant search keywords for untagged pages.
  - Automated workflow generates metadata descriptions containing target keywords to fill missing editorial details.
  - Pre-flight verification scripts assert no collection/skill is missing descriptions or keywords after pipeline execution.

### Phase 147: CI/CD Quality Gate & Regression Check

- **Requirements:** CI-01, INTEG-01
- **Scope:** Implement automated gate checking (copy leakages, Prettier formatting, translation parity, and CJK punctuation) in GitHub Actions on commit/PR, ensuring 100% build stability and zero regressions.
- **Status:** Not started
- **Plans:** 0/1 plans complete
- **Success Criteria:**
  - CI workflow blocks commits/PRs with copy leaks, formatting issues, or CJK punctuation errors.
  - Workspace typecheck and lint pipelines pass with zero errors.
  - Entire Vitest test suite executes successfully with 100% pass rate.
  - Astro production build compiles successfully.

## Milestones

- 🟩 **v4.6 GitHub Workflow SEO & Harvester Hardening** — phases 144-147 (active; [requirements](./REQUIREMENTS.md))
- ✅ **v4.5 GSC Crawl & AI Telemetry Hardening** — phases 140-143 (shipped 2026-06-23; [archive](./milestones/v4.5-ROADMAP.md), [requirements](./milestones/v4.5-REQUIREMENTS.md), [audit](./milestones/v4.5-MILESTONE-AUDIT.md))
- ✅ **v4.4 GSC Opportunity & Authority Promotion** — phases 137-139 (shipped 2026-06-23; [archive](./milestones/v4.4-ROADMAP.md), [requirements](./milestones/v4.4-REQUIREMENTS.md))
- ✅ **v4.3 Sitemap Purity & Search Coverage Consolidation** — phases 133-136 (shipped 2026-06-23; [archive](./milestones/v4.3-ROADMAP.md), [requirements](./milestones/v4.3-REQUIREMENTS.md), [audit](./milestones/v4.3-MILESTONE-AUDIT.md))
- ✅ **v4.2 Repository Size Reduction & Locale Configuration Normalization** — phases 130-132 (shipped 2026-06-23; [archive](./milestones/v4.2-ROADMAP.md), [requirements](./milestones/v4.2-REQUIREMENTS.md), [audit](./milestones/v4.2-MILESTONE-AUDIT.md))
- ✅ **v4.1 Multi-language Indexability Restructuring & SEO Acceleration** — phases 126-129 (shipped 2026-06-23; [archive](./milestones/v4.1-ROADMAP.md), [requirements](./milestones/v4.1-REQUIREMENTS.md), [audit](./milestones/v4.1-MILESTONE-AUDIT.md))
- ✅ **v4.0 Authority Proof Remediation & Public Trust Hardening** — phases 122-125 (shipped 2026-06-22; [archive](./milestones/v4.0-ROADMAP.md), [requirements](./milestones/v4.0-REQUIREMENTS.md), [audit](./milestones/v4.0-MILESTONE-AUDIT.md), [bootstrap](./milestones/v4.0-BOOTSTRAP.md), [closeout](./milestones/v4.0-CLOSEOUT.md))

## Carry-Forward Themes

- **Promotion proof before expansion:** discovery expansion stays closed until at least two primary authority surfaces earn `promote` under fresh evidence.
- **User-facing proof before promotion:** authority surfaces need visible selection criteria, maintained proof, and clear setup handoffs before scorecard emphasis increases.
- **Coverage cleanup before scale:** expected 404s, source-path URLs, and trailing-slash drift should be contained before broadening indexable inventory.
- **Public boundary is a release gate:** internal reasoning, operator-only process notes, raw provider diagnostics, and caught exception internals must never become frontend or public API copy.
- **Automation after repeatability:** no experiment should move into automation until proof, authority, and measurement gates all clear.

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|---|---|---|---|---|
| v4.6 GitHub Workflow SEO & Harvester Hardening | 144-147 | 2/4 | In Progress | Active |
| v4.5 GSC Crawl & AI Telemetry Hardening | 140-143 | 4/4 | Complete | 2026-06-23 |
| v4.4 GSC Opportunity & Authority Promotion | 137-139 | 3/3 | Complete | 2026-06-23 |
| v4.3 Sitemap Purity & Search Coverage Consolidation | 133-136 | 4/4 | Complete | 2026-06-23 |
| v4.2 Repository Size Reduction & Locale Configuration Normalization | 130-132 | 3/3 | Complete | 2026-06-23 |
| v4.1 Multi-language Indexability Restructuring & SEO Acceleration | 126-129 | 4/4 | Complete | 2026-06-23 |
| v4.0 Authority Proof Remediation & Public Trust Hardening | 122-125 | 4/4 | Complete | 2026-06-22 |

---
*Last updated: 2026-06-24 after completing Phase 145*
