# Roadmap: Killer-Skills Agent Directory

## Overview

Milestone v5.1 First Impression & Coverage Closure is active. Phases 159-161 will complete the REMOV-01 submission cycle, earn the first measurable organic impressions on P0 authority surfaces, and harden the SEO pipeline so compliance gaps surface automatically.

## Immediate Next Actions

- [x] Plan Phase 161: Pipeline & Compliance Hardening ✅
- [ ] Plan Phase 160: First Impression Earners
- [ ] Plan Phase 159: REMOV-01 Completion & Second-Pass Submission (blocked on operator)

## Current Milestone: v5.1 First Impression & Coverage Closure

**Goal:** Close the REMOV-01 submission cycle (reduce coverage affected pages below 5,000), earn the first measurable organic impressions and clicks on at least 2 P0 authority surfaces, and harden the SEO CI pipeline so compliance gaps surface automatically.

**Requirements:**

- [ ] COV-01: **Coverage Closure**: Complete REMOV-01 submission and second-pass batch to reduce coverage affected pages below 5,000.
- [ ] IMPR-01: **First Impression Earners**: Earn first measurable impressions and clicks on at least 2 primary authority surfaces (target: ≥3 impressions, ≥1 click each).
- [x] PIPE-01: **Pipeline & Compliance Hardening**: Wire structured data validation into daily CI, add API credential rotation alerting, and add blocklisted-URL-in-GSC detection so pipeline gaps surface automatically.

### Phase 159: REMOV-01 Completion & Second-Pass Submission

- **Requirements:** COV-01
- **Scope:** Operator submits 975-URL REMOV-01 batch (GitHub issue #19), run post-submission verification + delta, submit 191-URL second-pass batch, measure coverage reduction.
- **Status:** Planned
- **Plans:** 0/1 plans complete
- **Success Criteria:**
  - REMOV-01 submission completed (975/975 URLs submitted in GSC UI)
  - Post-submission verification executed (run verify + delta commands)
  - Second-pass batch submitted (191 URLs)
  - Coverage affected pages reduced from 10,783 toward <5,000

### Phase 160: First Impression Earners

- **Requirements:** IMPR-01
- **Scope:** Resolve GitHub issue #20 (takedown for scraped content at `/en/skills/atondwal/config`), run structured data production validation, execute the 5 editorial queue items from authority operator queue (homepage, collections hub, official AI skills, workflow tools, installation docs).
- **Status:** Planned
- **Plans:** 0/1 plans complete
- **Success Criteria:**
  - At least 2 primary authority surfaces earn ≥3 impressions and ≥1 click in GSC
  - GitHub issue #20 takedown resolved (blocklisted URL no longer earning impressions)
  - Structured data validation run against production (0 critical schema errors)
  - 5 editorial queue items executed for P0 surfaces

### Phase 161: Pipeline & Compliance Hardening

- **Requirements:** PIPE-01 ✅
- **Scope:** Wire structured-data-validate into SEO monitoring CI, add GSC API credential rotation alert, add blocklisted-URL-in-GSC detection, upgrade 2 compliance matrix lanes.
- **Status:** ✅ Complete
- **Plans:** 1/1 plans complete
- **Success Criteria:**
  - [x] Structured data validation runs daily in CI
  - [x] GSC API credential rotation creates an alert/issue (not silently skipped)
  - [x] Blocklisted URLs detected proactively in GSC crawl data
  - [x] 2+ compliance matrix lanes move from watch → pass (structured-data-validity and ctr-search-appearance)

## Milestones

- 🟩 **v5.1 First Impression & Coverage Closure** — phases 159-161 (active)
- ✅ **v5.0 Traffic Activation & Index Health Closure** — phases 156-158 (shipped 2026-06-27; [archive](./milestones/v5.0-ROADMAP.md), [requirements](./milestones/v5.0-REQUIREMENTS.md), [audit](./milestones/v5.0-MILESTONE-AUDIT.md))
- ✅ **v4.9 Authority Surface Uplift & Coverage Freshness** — phases 153-155 (shipped 2026-06-26; [archive](./milestones/v4.9-ROADMAP.md), [requirements](./milestones/v4.9-REQUIREMENTS.md), [audit](./milestones/v4.9-MILESTONE-AUDIT.md))
- ✅ **v4.8 Crawl Remediation & Discovery Expansion** — phases 151-152 (shipped 2026-06-26; [archive](./milestones/v4.8-ROADMAP.md), [requirements](./milestones/v4.8-REQUIREMENTS.md), [audit](./milestones/v4.8-MILESTONE-AUDIT.md))
- ✅ **v4.7 Core Web Vitals & Edge Performance Optimization** — phases 148-150 (shipped 2026-06-24; [archive](./milestones/v4.7-ROADMAP.md), [requirements](./milestones/v4.7-REQUIREMENTS.md), [audit](./milestones/v4.7-MILESTONE-AUDIT.md))

## Carry-Forward Themes

- **REMOV-01 completion is the single biggest coverage lever:** 9,177 of 10,783 coverage anomalies are addressed by the first-pass batch. Without submission, the gap persists indefinitely.
- **Zero impressions on all 34 promote surfaces:** Authority surfaces are structurally ready but no organic demand has been activated. Title/description and structured data optimizations are deployed but need time and measurement.
- **Pipeline gaps surface silently:** GSC API credential rotation, structured-data-validate, and blocklisted-URL-in-GSC detection are not yet in CI. These gaps only surface when manually checked.
- **Promotion proof before expansion:** discovery expansion stays open until at least two primary authority surfaces earn measurable impressions.
- **Public boundary is a release gate:** internal reasoning, operator-only process notes, raw provider diagnostics, and caught exception internals must never become frontend or public API copy.

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|---|---|---|---|---|
| v5.1 First Impression & Coverage Closure | 159-161 | 0/3 | In progress | Active |
| v5.0 Traffic Activation & Index Health Closure | 156-158 | 3/3 | Complete | 2026-06-27 |
| v4.9 Authority Surface Uplift & Coverage Freshness | 153-155 | 3/3 | Complete | 2026-06-26 |
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
*Last updated: 2026-06-27 after archiving v5.0 and initializing v5.1*
