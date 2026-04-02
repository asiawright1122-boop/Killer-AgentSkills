# Roadmap: Killer-Skills Agent Directory

## Overview

This roadmap tracks the transition from stabilization work into durable growth operations: keep CI and public UX stable, complete the SEO re-enrichment publish loop, and institutionalize automation audits so pipeline quality does not regress as content scale increases.

## Milestones

- 🚧 **v1.0 Reliability and Growth Operations** — active execution and audit closure

## Phases

- [x] **Phase 1: resolve-ui** - Repair UI test drift and restore CI reliability.
- [x] **Phase 1.1: stabilize-frontend-interactions-breadcrumbs-i18n-and-seo-contracts** - Harden frontend interaction and locale/SEO contract consistency.
- [ ] **Phase 2: re-enrichment-pipeline-run** - Complete resumable regeneration, publish, and post-publish validation.
- [x] **Phase 2A: isolate-secrets** - Isolate CI secret injection side-effects in property tests.
- [x] **Phase 5: command-palette** - Ship Cmd+K search UX and backend integration.
- [x] **Phase 7: content-intelligence** - Build AI enrichment for thin skill content.
- [x] **Phase 8: tutorial-shells** - Deliver tutorial-shell rendering for expanded content.
- [x] **Phase 29: automation-audit** - Run full unattended pipeline audit and output closure summary.
- [ ] **Phase 30: audit-comprehensive** - Consolidate cross-phase findings and remediation backlog.

## 🚧 v1.0 Reliability and Growth Operations

### Phase 1: resolve-ui
**Goal**: Fix failing Vitest assertions around extracted UI components so CI can run unattended.
**Depends on**: Nothing (foundational stabilization)
**Requirements**: CI-UI-01
**Success Criteria** (what must be TRUE):
  1. UI extraction regressions no longer break CI test jobs.
  2. Component contract assertions are stable across local and CI environments.
**Plans**: 1/1 plans complete

Plans:
- [x] 01-01: Fix `SkillRelated` extraction and related i18n assertion drift.

### Phase 1.1: stabilize-frontend-interactions-breadcrumbs-i18n-and-seo-contracts
**Goal**: Stabilize click behavior, locale contracts, and breadcrumb/metadata consistency across high-traffic pages.
**Depends on**: Phase 1
**Requirements**: UX-INT-01, I18N-CORE-01, SEO-CONTRACT-01
**Success Criteria** (what must be TRUE):
  1. Primary public routes do not leak raw translation keys.
  2. Shared card/mobile interactions are reliable and test-covered.
  3. Breadcrumb and metadata generation share one tested contract.
**Plans**: 6/6 plans complete

Plans:
- [x] 01.1-01: Restore local Astro/Cloudflare baseline and deterministic startup checks.
- [x] 01.1-02: Normalize click behavior for cards and mobile nav teardown.
- [x] 01.1-03: Create shared locale and translation helper contract.
- [x] 01.1-04: Unify breadcrumb and metadata builders.
- [x] 01.1-05: Remove high-traffic public-shell key leakage.
- [x] 01.1-06: Finish route-level i18n cleanup and smoke-guard coverage.

### Phase 2: re-enrichment-pipeline-run
**Goal**: Regenerate flagged skill SEO content, publish via canonical runtime path, and verify post-publish quality.
**Depends on**: Phase 1.1, Phase 2A
**Requirements**: THEME-01, I18N-02, RESUME-01, PUBLISH-01, VERIFY-02
**Success Criteria** (what must be TRUE):
  1. Regeneration scope is resumable, checkpointed, and auditable.
  2. Published data is validated by strict quality/integrity checks.
  3. Public-surface smoke checks confirm no major locale/SEO regressions.
**Plans**: 3/4 plans executed

Plans:
- [x] 02-01: Build regeneration baseline report and batch scope.
- [ ] 02-02: Execute checkpointed regeneration with multilingual safeguards (pilot rerun validated; full queued scope pending).
- [x] 02-03: Publish through D1 canonical path and supporting KV sync.
- [x] 02-04: Run strict post-publish audits and produce phase summary.

### Phase 2A: isolate-secrets
**Goal**: Remove CI secret injection side-effects from middleware property tests.
**Depends on**: Phase 1
**Requirements**: SEC-TEST-01
**Success Criteria** (what must be TRUE):
  1. Property tests are deterministic and isolated from runner-level env secrets.
  2. Auth-related false negatives are no longer triggered by injected credentials.
**Plans**: 1/1 plans complete

Plans:
- [x] 02A-01: Explicitly clear sensitive env keys in property-test setup.

### Phase 5: command-palette
**Goal**: Deliver command palette UX with search backend wiring.
**Depends on**: Phase 1.1
**Requirements**: UX-SEARCH-01
**Success Criteria** (what must be TRUE):
  1. Users can open palette with keyboard shortcut and navigate results.
  2. Palette search is connected to `/api/search.ts` with debounce behavior.
**Plans**: 2/2 plans complete

Plans:
- [x] 05-01: Implement modal palette and keyboard navigation.
- [x] 05-02: Connect palette to search API and expose trigger in header.

### Phase 7: content-intelligence
**Goal**: Build AI enrichment pipeline for thin skill content.
**Depends on**: Phase 5
**Requirements**: CONTENT-AI-01
**Success Criteria** (what must be TRUE):
  1. Thin content can be detected and enriched programmatically.
  2. Enrichment output preserves schema compatibility.
**Plans**: 1/1 plans complete

Plans:
- [x] 07-01: Create `ai-enrich-thin-skills.ts` enrichment workflow.

### Phase 8: tutorial-shells
**Goal**: Render enriched long-form tutorial content reliably in Astro SSR pages.
**Depends on**: Phase 7
**Requirements**: UX-TUTORIAL-01
**Success Criteria** (what must be TRUE):
  1. Skill detail pages can render large enriched content with stable layout.
  2. Tutorial shell supports TOC and markdown code rendering patterns.
**Plans**: 1/1 plans complete

Plans:
- [x] 08-01: Integrate tutorial-shell rendering for skill detail surfaces.

### Phase 29: automation-audit
**Goal**: Audit unattended automation chain from ingest to SEO/public surface.
**Depends on**: Phase 2
**Requirements**: AUDIT-PIPELINE-01
**Success Criteria** (what must be TRUE):
  1. SEO guard, data writers, and frontend fallback paths are reviewed end-to-end.
  2. Audit leaves machine-readable closure artifacts (summary + verification).
**Plans**: 1/1 plans executed

Plans:
- [x] 29-01: Execute automation audit matrix and produce closure evidence.

### Phase 30: audit-comprehensive
**Goal**: Consolidate findings into a cross-phase remediation backlog and execution order.
**Depends on**: Phase 29
**Requirements**: AUDIT-COMP-01
**Success Criteria** (what must be TRUE):
  1. Gaps are grouped by severity, owner, and execution order.
  2. Follow-up phases are explicit and ready for planning/execution.
**Plans**: 0/1 plans executed

Plans:
- [ ] 30-01: Consolidate cross-phase gaps into a prioritized remediation matrix and follow-up phase set.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. resolve-ui | 1/1 | Complete | 2026-04-01 |
| 1.1. stabilize-frontend-interactions-breadcrumbs-i18n-and-seo-contracts | 6/6 | Complete | 2026-04-01 |
| 2. re-enrichment-pipeline-run | 3/4 | In progress | - |
| 2A. isolate-secrets | 1/1 | Complete | 2026-04-01 |
| 5. command-palette | 2/2 | Complete | 2026-04-01 |
| 7. content-intelligence | 1/1 | Complete | 2026-04-01 |
| 8. tutorial-shells | 1/1 | Complete | 2026-04-01 |
| 29. automation-audit | 1/1 | Complete | 2026-04-02 |
| 30. audit-comprehensive | 0/1 | In progress | - |
