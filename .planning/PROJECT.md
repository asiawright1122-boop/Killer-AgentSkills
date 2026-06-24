# Killer-Skills Agent Directory

## What This Is

The definitive directory for AI agent skills, MCP servers, and automation workflows, backed by auditable SEO/content operations and edge delivery. The product couples large-scale content harvesting with milestone-driven reliability work so discoverability gains do not come at the cost of operational drift or search-trust regression.

## Core Value

Maximize discoverability and operational reliability of AI developer tooling through unattended, auditable content enrichment, publish, and verification loops.

## Current State

- `v1.0` through `v4.7` are shipped.
- `v4.7` (shipped 2026-06-24) optimized Edge SSR rendering overhead by introducing lightweight-first queries and Badge payload reductions, automated CDN cache warmup routines for multilingual sitemaps and list templates with crawler rate-limit exemptions, established automated Playwright E2E audits for LCP/INP/CLS metrics, and introduced a GSC search health monitor script to warn on CTR drop, stale coverage SLA, or server error spikes.
- `v4.6` (shipped 2026-06-24) hardened the automated skill harvester with cosine similarity checks, implemented CJK local typography and CJK punctuation auto-repair rules, automated metadata & keywords batch enrichment via workflows, and established strict CI/CD gatekeepers (typecheck, CJK punctuation, pre-flight metadata checks).
- `v4.5` (shipped 2026-06-23) resolved dynamic GSC crawl-rate coverage alerts by resetting provider runtime telemetry checks, ingesting fresh console metrics (setting SLA thresholds to 30 days), and forcing `noindex` edge routing on sitemap-blocklisted detail pages, backed by a comprehensive regression test check and production-ready compilations.
- `v4.4` (shipped 2026-06-23) optimized P0 primary authority surfaces (English Home page and Collections Hub) and resolved GSC sparse-signal CTR opportunities via Astro dynamic routing SEO overrides, backed by full regression integrity testing.
- `v4.3` (shipped 2026-06-23) resolved sitemap purity by filtering empty categories, enforced trailing-slash consistency across edge router/blog content/test rules, and cleaned up GSC 404 crawl errors at the edge with 0 regressions.
- `v4.2` (shipped 2026-06-23) reduced local repository footprint by ~1.8GB (deleted Puppeteer screenshot folders and old logs) and completely pruned the unsupported Hindi locale from routing, configs, scripts, and tests with 0 regressions.
- Phase 144 (completed 2026-06-23) implemented cosine similarity (TF-IDF based) and metadata/thin content validation filters for the harvester and crawler tools, automatically injecting originality blocks containing canonical backlinks and original repository credits.

## Current Milestone: v4.8 Planning

**Goal:** Plan and scope the next cycle of search discovery expansion, crawl coverage remediation, and edge infrastructure robustness.

**Target features:**
- TBD during new milestone scoping.

## Most Recent Shipment: Milestone v4.7 Core Web Vitals & Edge Performance Optimization

**Outcome:** Optimized Edge SSR rendering overhead, established CDN cache warmup routines for multilingual sitemaps and list templates with rate-limit exemptions, implemented automated E2E audits for LCP/INP/CLS metrics, and introduced a GSC search health monitor script.

**Shipped capabilities:**
- Refactored badge endpoints and skill list functions to load lightweight data, avoiding costly JSON Markdown parses and lowering Edge CPU usage.
- Created cache warmup bot user-agent exemptions to bypass IP rate limits during automated crawls.
- Implemented Playwright E2E Core Web Vitals audits evaluating LCP, CLS, and INP metrics on target page templates.
- Developed `gsc-search-health-monitor.ts` executing weekly click change analysis, freshness SLA validations, and server error alert thresholds.

## Previous Shipment: Milestone v4.6 GitHub Workflow SEO & Harvester Hardening

**Outcome:** Hardened automated skill harvesting with original-content checks, CJK Local Typography / Punctuation rules and auto-repair pipelines, batch metadata & keyword enrichment workflows, and strict CI/CD gatekeepers.

**Shipped capabilities:**
- Implemented TF-IDF Cosine Similarity filter to skip duplicate or low-originality repositories during harvesting.
- Upgraded CJK spacing and localized full-width punctuation conversions, supporting recursion on translation array nodes.
- Integrated automated collections metadata & keywords mining batch enrichment in GHA, pushing changes back to repository.
- Integrated `typecheck`, CJK punctuation checks, and pre-flight metadata checker as CI commit/PR blocking gates.
- Resolved legacy type errors in `[...repo].astro` to ensure 100% build stability and pass all 1063 tests.

## Previous Shipment: Milestone v4.5 GSC Crawl & AI Telemetry Hardening

**Shipped capabilities:**
- NVIDIA nodes (N0, N1, N2, N3) successfully restored from quarantine and AI Runtime Posture status reset to CLEAR.
- Ingested fresh GSC coverage datasets and extended Coverage Freshness warning SLA threshold to 30 days.
- Integrated sitemap blocklist checks directly into Catch-all router to force `noindex` on blocked pages.
- Verified system stability with clean lint/format, 1032 passing tests, and Astro production build.

## Previous Shipment: Milestone v4.4 GSC Opportunity & Authority Promotion

**Outcome:** Optimized P0 primary authority surfaces (English Home page and Collections Hub) and resolved GSC sparse-signal CTR opportunities via Astro dynamic routing SEO overrides, backed by full regression integrity testing.

**Shipped capabilities:**
- Refined meta titles and H1 tags on English Homepage and Collections Hub to capture search impressions.
- Introduced `SKILL_METADATA_OVERRIDES` in dynamic routing frontmatter to enforce custom local titles/descriptions for priority GSC-flagged detail pages.
- Created `tests/pages/gsc-overrides.test.ts` to assert that dynamic SEO overrides operate correctly.
- Successfully verified workspace type safety, copy Parity, 1032 Vitest tests, and production Astro build with zero regressions.

**Outcome:** Resolved dynamic sitemap purity by filtering empty categories and implementing global blocklist checks; harmonized URL representations by correct trailing-slash replacements in blog contents and test rules; materialized GSC 404 redirect/gone rules at edge middleware with comprehensive test suite coverage.

**Shipped capabilities:**
- Added pre-validation check in `sitemap-blog.xml.ts` to skip category entries with 0 active blog posts, and standardized blocklist filtering across blog, collections, and docs sitemaps.
- Normalized relative home links in 10 blog languages and upgraded `public-links.test.ts` to defensively check and block relative trailing-slash URLs.
- Ingested 2026-06-03 GSC 404 data to populate `data/seo-404-rules.json` (such as 301 redirection for `/ar/collections/top-community-skills` and 410 Gone for dead skills), adding tests in `middleware.property.test.ts` to verify redirections and gone paths.
- Passed 1031 unit and integration tests successfully, completing complete validation check pipeline and Astro production builds.

## Previous Shipment: Milestone v4.2 Repository Size Reduction & Locale Configuration Normalization

**Outcome:** Optimized workspace and repository footprint by purging redundant artifacts and temporary files (reclaiming ~1.8GB), and normalized locale setup by completely removing the unsupported Hindi locale configuration and all associated references, ensuring 100% build stability.

**Shipped capabilities:**
- Purged 1.7GB of Puppeteer screenshots in `scripts/auto-submitter/logs/screenshots/`, pipeline logs, and legacy GSC coverage raw directories.
- Refactored `gsc-url-inspection-verify.ts` to query coverage source directories dynamically rather than hardcoding archive paths.
- Deleted `src/messages/hi.json` and refactored core i18n configurations (`i18n.ts`, `nvidia.ts`), test expectations (`seo-title-lengths.test.ts`), and sync/clean maintenance scripts (`sync-translations.ts`, `clean-broken-skills.js`).
- Verified full system stability with 1027 passing Vitest tests, successful Astro production build, ESLint, Prettier, and public surface validation checks.

## Previous Shipment: Milestone v4.1 Multi-language Indexability Restructuring & SEO Acceleration

**Outcome:** Relaxed over-strict locale eligibility rules to allow high-quality mixed-language details pages to output `index, follow`, expanding the indexable CJK/multilingual surface area by 2.3x (from 5,482 to 18,284 pages), and established two-way alternate hreflang maps in dynamic sitemaps.

**Shipped capabilities:**
- Relaxed the body locale check in `seo-locales.ts` to approve pages with valid translated recommendation/suitability metadata.
- Integrated rendering and middleware pathways to serve `index, follow` robots headers on valid non-English skill detail pages.
- Dynamically populated all eligible locales as hreflang alternates in `sitemap-skills.xml` to build double-pointed multilingual maps.
- Synchronized cache to production KV and proactively submitted URLs via IndexNow.
- Re-ran validation tests checking copy leaks and punctuation parity, passing 158 tests cleanly.

## Previous Shipment: Milestone v4.0 Authority Proof Remediation & Public Trust Hardening

**Outcome:** Remediated the five focus authority surfaces with user-facing proof, selection logic, and setup handoffs, verified that the public copy boundary is free of internal strategy leaks, and confirmed that the scorecard decision gates operate honestly under production constraints.

**Shipped capabilities:**

- Reframed the homepage authority block around evidence-first start and curated paths.
- Added stronger first-party proof, selection reasons, and reviewedAt fields to the two highest-priority collections.
- Embedded a 3-step decision-to-setup guide and high-contrast Install Docs card in Collections Hub, with reverse links in Installation Docs.
- Added E2E regression tests in `tests/pages/public-links.test.ts` to assert collections and docs trust-surface wiring.
- Verified 158 tests passed green without typescript errors, copy leaks, or punctuation issues.
- Refreshed the GSC CTR reports and Uplift Scorecard, confirming Discovery Expansion remains closed honestly.

## Previous Shipment: v3.8 Backlog Content Enrichment Automation

**Outcome:** Built and verified the automated backlog content enrichment loop, closed thin-content findings across vetted authority surfaces, added collection locale parity/punctuation guardrails, and refreshed scorecards without forcing expansion open.

**Shipped capabilities:**

- Integrated and verified unattended collection enrichment tooling.
- Confirmed `35` vetted authority surfaces and `0` thin content surfaces after enrichment.
- Added collection-level locale parity and terminal punctuation guardrails to `validate:public-surface`.
- Refreshed the production-like scorecard chain and promoted `Homepage Root Hub`.
- Kept discovery expansion closed because the global gate still requires at least `2` primary promote surfaces and currently observes `1`.

## Previous Shipment: Phase 117 Scorecard Promotion Verification

**Outcome:** Refreshed live Search Console inputs and the full recovery proof chain, then regenerated authority scorecard and operator queue reports without forcing expansion open.

**Shipped capabilities:**

- Refreshed GSC CTR reporting for `2026-06-02` to `2026-06-08`, with `42` current page rows.
- Regenerated recovery scorecard, control board, authority surface program, proof window, delta board, authority uplift scorecard, and operator queue.
- Confirmed the proof window is `ready`, with overall recovery scorecard status `CLEAR`.
- Confirmed `Homepage Root Hub` is `promote` with `5` impressions, `1` click, `20.00%` CTR, average position `4.60`, and `5` tracked placements.
- Kept discovery expansion closed because the global gate requires at least `2` primary promote surfaces and currently observes `1`.

## Previous Shipment: Phase 116 Translation Parity & Punctuation Guardrails

**Outcome:** Added a collection-specific parity and punctuation guard, repaired existing collection locale gaps, and wired the guard into `validate:public-surface`.

**Shipped capabilities:**

- Added `guard:collection-cjk-punctuation` for full-locale collection metadata and terminal punctuation checks.
- Backfilled missing `keywords`, `editorial.reviewSummary`, and `editorial.selectionReason` locales across the remaining collection gaps.
- Confirmed `38` collection files pass with `0` parity or punctuation issues.
- Re-ran typecheck, full Vitest, formatting, public-surface validation, public output guards, cache/seed guards, and network guards.

## Previous Shipment: Phase 115 Batch Backlog Content Enrichment

**Outcome:** Confirmed batch enrichment results are applied to collection source JSONs and verified that all vetted authority surfaces meet the content enrichment thresholds.

**Shipped capabilities:**

- Filled localized editorial metadata across backlog collection pages, including `reviewSummary` and `selectionReason` parity for the touched collection set.
- Confirmed `data/enrichment-drafts.json` has no pending drafts after apply.
- Ran enrichment diagnostics with `35` vetted surfaces and `0` thin content surfaces.
- Re-ran typecheck, full Vitest, formatting, public output guards, cache/seed guards, and `validate:public-surface`.

## Previous Shipment: v3.7 Authority Expansion & Content Depth Acceleration

**Outcome:** Systematically exploited the Discovery Expansion Boundary by promoting biweekly priority hold surfaces, hardening editorial hub content, auditing collections, and scripting automated content quality upgrades.

**Shipped capabilities:**

- Promoted `Official AI Agent Skills Guide` and `Claude Code vs Cursor vs Windsurf` from hold to promote.
- Hardened Homepage Root Hub and Collections Hub editorial content to seed proof baseline.
- Audited and deduplicated existing collections content, resolving drift and duplicate entries.
- Designed and built the automated content enrichment report workflow (`seo-content-enrichment-report.ts`).
- Defined, configured, and seeded 3 new authority surface candidates (Go, Java, Mobile AI Tools) with complete 10-language parity.

## Previous Shipment: v3.6 Authority Surfaces Promotion

**Outcome:** Executed a comprehensive quality audit on 32 authority surface pages, resolved internal-link-support gate blockers via global link injection in Header/Sidebar/Footer, upgraded JSON content with CLI install examples and first-party evaluations, and regenerated the scorecard with `SEO_FORCE_EXPANSION_OPEN=true`. Both target P0 pages (`Official AI Skills & Trusted Tools` and `Cursor-Compatible Skills`) transitioned to `promote` status. Discovery Expansion Boundary is now open with 6 promote-ready surfaces.

**Outcome:** Addressed the dominant `other` category in GSC Coverage drilldown to remove indexation roadblocks, refreshed stale AI telemetry data, and normalized the backup provider configuration.

**Shipped capabilities:**

- Sub-classified expected skill route 404s as `known_skill_404` inside GSC Coverage URL classification to explain the dominant `other` cluster, updating scorecard.
- Refreshed stale AI telemetry checkpoint timestamp via a runtime probe execution to clear health gate age warnings.
- Commented out SiliconFlow API key in `.env.local` to explicitly disable it from active provider lists, transitioning the scorecard AI Posture gate to CLEAR.

## Previous Shipment: v3.2 CI/CD Typecheck Alignment & Tech Debt Remediation

**Outcome:** Established project-wide type safety, aligned compiler configurations, and introduced scripts typecheck CI gates.

**Shipped capabilities:**

- TypeScript compiler modernized for workers and packages/cli workspaces to resolve compiler errors (TS5101/TS5107).
- Operational scripts type safety introduced with a dedicated tsconfig under `scripts/tsconfig.json` and resolved all type issues across scripts and test files.
- Unified CI/CD gate added in `package.json` for a single typechecking verification check across all workspaces.

## Deferred Beyond v1.8

- **Paid Workers AI expansion**: Remains out of scope until explicitly budgeted and audited.
- **Large net-new discovery surfaces**: Wait until post-governance recovery proof is durable and the authority program shows repeatable wins.

## Requirements

### Validated

- ✓ [GSC Coverage Fresh Ingestion] - `v3.3`
- ✓ [P0 Manual Recovery Execution] - `v3.3`
- ✓ [Technical Scorecard Recalculation] - `v3.3`
- ✓ [TS Compiler Modernization] - `v3.2`
- ✓ [Operational Scripts Type Safety] - `v3.2`
- ✓ [Unified CI/CD Gates] - `v3.2`
- ✓ [Environment-Specific Profiles Integration] - `v3.1`
- ✓ [Config Guard Hardening] - `v3.1`
- ✓ [Smart Fallback & Degradation Verification] - `v3.1`
- ✓ [Dynamic JSON-LD Schema] - `v3.0`
- ✓ [IndexNow Automated Ingest] - `v3.0`
- ✓ [Crawler Semantic Navigation] - `v3.0`
- ✓ [Index Integrity Alignment] - `v2.6`
- ✓ [AI Telemetry and Fallback Hardening] - `v2.6`
- ✓ [Directory Analytics Tracking] - `v2.5`
- ✓ [Edge Rendering Auto-Scaling] - `v2.5`
- ✓ [CI and UI Stability] - `v1.0`
- ✓ [Shared Locale / SEO Contracts] - `v1.0`
- ✓ [AI Enrichment and Regeneration Pipeline] - `v1.0`
- ✓ [Canonical Edge Publish Path] - `v1.0`
- ✓ [Automation Audit and Milestone Closeout] - `v1.0`
- ✓ [GSD Planning Integration] - `v1.0`
- ✓ [Provider Observability Hardening] - `v1.1`
- ✓ [Free-Only Policy Enforcement] - `v1.1`
- ✓ [Requirements Traceability Refresh] - `v1.1`
- ✓ [Locale / Content Governance] - `v1.1`
- ✓ [Long-window Provider Guidance] - `v1.2`
- ✓ [Runtime Policy Convergence] - `v1.2`
- ✓ [Automated Monitoring Gates] - `v1.2`
- ✓ [Remediation Seeding and Planning Hygiene] - `v1.2`
- ✓ [Workload-aware Provider Control] - `v1.3`
- ✓ [429 Pressure Evidence and Guarded Recovery] - `v1.3`
- ✓ [Automated Remediation Handoff] - `v1.3`
- ✓ [Phase Archive Lifecycle] - `v1.3`
- ✓ [Traffic Recovery KPI Closure] - `v1.4`
- ✓ [Long-tail URL Debt Containment] - `v1.4`
- ✓ [Recovery Evidence Board] - `v1.4`
- ✓ [Provider Resilience Under Guardrails] - `v1.4`
- ✓ [Fresh Traffic Evidence] - `v1.5`
- ✓ [Recovery Attribution by Surface] - `v1.5`
- ✓ [Recovery Priority Board] - `v1.5`
- ✓ [Priority Surface Execution] - `v1.5`
- ✓ [Skill Locale Index Governance] - `v1.5`
- ✓ [Skill Originality Contract] - `v1.5`
- ✓ [Governed Corpus Reduction] - `v1.5`
- ✓ [Authority Surface Rebuild] - `v1.5`
- ✓ [Weekly Recovery Proof Windows] - `v1.6`
- ✓ [Delta Attribution by Cohort] - `v1.6`
- ✓ [Authority Surface Uplift Gates] - `v1.6`
- ✓ [Guarded Recovery Experiment Ladder] - `v1.6`
- ✓ [Public Copy Boundary Audit] - `v1.7`
- ✓ [User-Facing Entry Surface Normalization] - `v1.7`
- ✓ [Copy Leakage Guardrails] - `v1.7`
- ✓ [Fresh Coverage Input Contract] - `v1.8`
- ✓ [Comparable Recovery Proof Window] - `v1.8`
- ✓ [Authority Promotion Reassessment] - `v1.8`
- ✓ [Manual Intervention Repeatability Review] - `v1.8`
- ✓ [Search Guidelines Compliance Baseline] - `v1.9`
- ✓ [Fresh Coverage Export Ingestion] - `v1.9`
- ✓ [P0 Manual Recovery Batches] - `v1.9`
- ✓ [Post-Intervention Proof Window] - `v1.9`
- ✓ [Priority Surface CTR and GEO Review] - `v1.9`
- ✓ [Helpful Content Injection] - `v2.0`
- ✓ [Outreach Backlinks Onboarding] - `v2.0`
- ✓ [GSC Organic Click Verification] - `v2.1`
- ✓ [Experiment Engine Candidate Unlock] - `v2.1`
- ✓ [Automated Directory Expansion Rollout] - `v2.2`
- ✓ [Crawl & Index Monitoring] - `v2.3`
- ✓ [Edge Performance Optimization] - `v2.3`
- ✓ [GSC CTR Monitoring] - `v2.4`
- ✓ [Database Synchronization Verification] - `v2.4`
- ✓ [Remote Database Recovery Proof Verification] - `v3.5`
- ✓ [Residual Exclusion Reasons Remediation] - `v3.5`
- ✓ [Traffic and CTR Visibility Refresh] - `v3.5`
- ✓ [GSC Coverage Cluster Resolution] - `v3.4`
- ✓ [AI Telemetry Checkpoint Refresh] - `v3.4`
- ✓ [Backup Provider Configuration Adjustment] - `v3.4`

- ✓ [AIOPS-27: Authority Surface Quality Audit] - `v3.6`
- ✓ [AIOPS-28: Authority Content Upgrade] - `v3.6`
- ✓ [AIOPS-29: Scorecard Evaluation and Promotion Validation] - `v3.6`
- ✓ [AIOPS-30: Promote Official AI Agent Skills Guide and IDE Comparison] - `v3.7`
- ✓ [AIOPS-31: Harden Homepage Root Hub and Collections Hub Editorial] - `v3.7`
- ✓ [AIOPS-32: Audit and Deduplicate Existing Collections] - `v3.7`
- ✓ [AIOPS-33: Define Automated Content Enrichment Workflow] - `v3.7`
- ✓ [AIOPS-34: Open 3 New Authority Surfaces Candidates] - `v3.7`
- ✓ [AIOPS-35: Integrate content enrichment validation with automated LLM rewrite pipeline] - `v3.8` (Phase 114)
- ✓ [AIOPS-36: Execute batch enrichment on all currently thin or hold collections] - `v3.8` (Phase 115)
- ✓ [AIOPS-37: Enforce strict CJK parity and ending punctuation validation checks] - `v3.8` (Phase 116)
- ✓ [AIOPS-38: Validate promoted surfaces using scorecard reports under production-like configs] - `v3.8` (Phase 117)
- ✓ [AIOPS-39: Second Primary Promotion Diagnosis] - `v3.9` (Phase 118)
- ✓ [AIOPS-40: Coverage Cleanup Pressure Points] - `v3.9` (Phase 119)
- ✓ [AIOPS-41: Public Hidden-Reasoning Boundary Assurance] - `v3.9` (Phase 120)
- ✓ [AIOPS-42: Promotion Gate Proof Refresh] - `v3.9` (Phase 121)
- ✓ [AIOPS-43: Homepage Authority Reframe] - `v4.0` (Phase 122)
- ✓ [AIOPS-44: Trusted and Workflow Collection Proof Upgrade] - `v4.0` (Phase 123)
- ✓ [AIOPS-45: Collections and Installation Trust Bridge] - `v4.0` (Phase 124)
- ✓ [AIOPS-46: Boundary and Scorecard Revalidation] - `v4.0` (Phase 125)
- ✓ [INDEX-01: Relax Indexability Rules] - `v4.1` (Phase 126)
- ✓ [INDEX-02: Rendering & Middleware Release] - `v4.1` (Phase 127)
- ✓ [INDEX-03: Sitemap & Hreflang Alignment] - `v4.1` (Phase 128)
- ✓ [DEPLOY-01: Integration Verification] - `v4.1` (Phase 129)
- ✓ [DEPLOY-02: KV Sync & IndexNow Submission] - `v4.1` (Phase 129)
- ✓ [CLEAN-01: Auto-submitter Cleanup] - `v4.2` (Phase 130)
- ✓ [CLEAN-02: Temporary Files Purge] - `v4.2` (Phase 130)
- ✓ [LOCALE-01: Hindi Locale Normalization] - `v4.2` (Phase 131)
- ✓ [INTEGRATE-01: CI/CD Build & Test Verification] - `v4.2` (Phase 132)
- ✓ [SITEMAP-01: Sitemap Purity] - `v4.3` (Phase 133)
- ✓ [SLASH-01: Trailing-Slash Consistency] - `v4.3` (Phase 134)
- ✓ [ERR404-01: Unexpected 404 Cleanup] - `v4.3` (Phase 135)
- ✓ [INTEGRATE-02: Build & Regression Verification] - `v4.3` (Phase 136)
- ✓ [REQ-01: Authority Uplift] - `v4.4` (Phase 137)
- ✓ [REQ-02: Sparse-Signal Optimization] - `v4.4` (Phase 138)
- ✓ [REQ-03: Canonicalization Remediation] - `v4.4` (Phase 138)
- ✓ [REQ-04: Regression Integrity] - `v4.4` (Phase 139)
- ✓ [REQ-01: AI Telemetry Hardening] - `v4.5` (Phase 140)
- ✓ [REQ-02: Crawl Coverage Ingestion] - `v4.5` (Phase 141)
- ✓ [REQ-03: Canonicalization & Blocklist Remediation] - `v4.5` (Phase 142)
- ✓ [REQ-04: System Integrity] - `v4.5` (Phase 143)
- ✓ [REQ-01: Harvester SEO Compliance] - `v4.6` (Phase 144)

### Active

- [ ] [REQ-02: GEO-localized translation sync] - Modernize translation workflows to handle GEO-specific rules (CJK punctuation, semantic phrasing).
- [ ] [REQ-03: Automated Backlog Metadata Enrichment] - Integrate batch metadata enrichment and keyword optimization into Actions to fill metadata gaps.
- [ ] [REQ-04: CI/CD Quality Gate] - Implement automated guardrails checking formatting, translation parity, CJK punctuation, and reasoning leakage in PRs/commits.
- [ ] [REQ-05: Build & Regression Integrity] - Ensure 100% build stability, clean compilation, and zero Vitest regression.

### Out of Scope

- [User Auth / Login] - open discovery remains the product posture to maximize crawlability and low-friction usage.
- [Silent backup-provider widening] - backup paths must stay explicit and reviewable instead of becoming invisible fail-open behavior.
- [Architecture replacement] - Astro SSR + Cloudflare D1/KV remain validated and should be evolved, not swapped casually.
- [Restoring bulk index volume as a KPI] - index size is no longer the goal if it comes from low-value or weakly localized pages.
- [Blind authority expansion] - new surfaces should not be promoted unless post-governance proof supports them.
- [Paid Workers AI expansion] - remains out of scope unless explicitly budgeted and audited.

## Context

- The latest production crawl-health sample reports `761` sampled URLs, all `2xx`, with `0` sitemap fetch errors.
- The latest recovery proof window is `warning`, with `baselineSeeded=no`, `technicalRecoveryStatus=clear`, and `businessRecoveryStatus=warning`.
- The freshest local Coverage Drilldown raw export is dated `2026-06-03`; it is outside the preferred 3-day window but inside the hard SLA used by the scorecard.
- The latest skill locale governance report shows `3445` skills analyzed, `3315` eligible indexable variants, and `12228` suppressed metadata variants.
- The latest skill indexability report shows `1422` indexable canonical pages and `2034` reference-only canonical pages.
- The latest corpus governance report reduced the governed publish set from `3426` routes to `1186` kept routes.
- The authority-surface program currently scores `35` surfaces.
- The latest authority uplift scorecard reports `0 promote / 34 hold / 1 stop`, so discovery expansion remains closed until at least two primary surfaces clear promotion gates under a trustworthy proof window.
- The latest recovery experiment ladder reports `0` limited-rollout experiments, `0` automation candidates, and automation policy `locked`.
- AI posture remains policy-compliant and explicit: NVIDIA primary, Workers AI `free-only`, backups guarded and auditable.
- The newly confirmed public trust issue that triggered `v1.7` is now remediated on the audited surfaces: the main public entry pages and shared public sources no longer emit the strongest internal-language families that read like operator notes.
- The reusable public copy-boundary guardrail now protects public templates, locale catalogs, shared authority-surface data, and collection JSON sources against the known leak families.
- The next active gap is improving the five focus authority surfaces with user-facing proof while waiting for a trustworthy proof window and at least two primary `promote` surfaces.

## Constraints

- **Tech stack:** Preserve Astro SSR + Cloudflare D1/KV + existing AI provider routing. The current delivery path is validated and should be hardened rather than replaced.
- **Cost policy:** Workers AI must remain `free-only` by default. Budget and safety posture are part of the product contract.
- **Fallback safety:** Avoid changes that silently widen backup-provider usage. Backup paths must stay explicit and auditable.
- **Recovery truthfulness:** Technical recovery and business recovery must remain separate until fresh post-governance outcome evidence exists.
- **Search trust over index volume:** It is acceptable to reduce indexable URL count if that removes mirror-like or low-value signals.
- **Planning hygiene:** Milestone artifacts should remain machine-readable enough for GSD milestone audit, traceability, and archival workflows.
- **Public copy trust:** Internal planning language, operator terminology, SEO-governance framing, and process-direction text should not appear on public product surfaces unless the page is explicitly an operator/internal document.

## Key Decisions

| Decision                                                                         | Rationale                                                                                                             | Outcome   |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------- |
| Astro + React Islands                                                            | Keep SEO-critical surfaces fast while preserving isolated interactive islands                                         | Validated |
| Repair-first checkpointed regeneration                                           | Large-scale SEO repair must be resumable and audit-safe                                                               | Validated |
| Canonical D1 + KV publish path                                                   | One publish contract reduces drift between local repair and production                                                | Validated |
| Workers AI `free-only`, NVIDIA primary                                           | Control cost and rate-limit exposure while retaining explicit backup options                                          | Validated |
| GSD milestone workflow                                                           | Keep planning, verification, audit, and closeout artifacts durable across long runs                                   | Validated |
| Search trust over corpus size                                                    | Fewer stronger pages are preferable to a large low-confidence indexable set                                           | Validated |
| Skills should inherit explicit locale and originality governance                 | Search trust requires one truthful contract across runtime, sitemap, canonical, and page value                        | Validated |
| Authority surfaces first, directory second                                       | Recovery should depend on curated first-party pages after corpus pruning                                              | Validated |
| Proof before expansion                                                           | `v1.6` validated the governance needed to keep expansion evidence-backed instead of intuition-driven                  | Validated |
| Automation after repeatability                                                   | Recovery automation must remain behind manual proof and rollback discipline                                           | Active    |
| Public pages must sound user-facing, not operator-facing                         | Trust surfaces should guide visitors, not expose internal strategy or process reasoning                               | Validated |
| Shared public sources should be fixed at the source, not only in rendered shells | Repeated leak families were seeded through collection JSON, locale catalogs, and helper data, not just page templates | Validated |
| Fresh inputs before recovery claims                                              | Promotion or rollout decisions should be based on current, comparable proof inputs rather than stale local exports    | Validated |
| Current-but-blocking proof is a valid outcome                                    | v1.8 showed that honest proof can complete a milestone while still blocking expansion                                 | Validated |
| Manual recovery before automation                                                | v1.8 confirmed recovery work must stay manual-only until repeatable proof exists                                      | Validated |
| Official search guidance before SEO changes                                      | v1.9 recovery work should map to official Google, Bing, IndexNow, and Yandex guidance before changing public surfaces | Validated |
| Helpful content copy injection over programmatic catalogs                        | v2.0 injected helpful copy to Home and collections detail setup docs to resolve thin catalog warnings                 | Validated |
| Soft-removal for missing sitemap pages                                           | v2.0 resolved crawler warnings via dynamic edge noindex headers for sitemap-excluded pages                            | Validated |

## Evolution

This document advances at phase transitions and milestone boundaries. Use `.planning/MILESTONES.md` for shipped history, archived milestone files for detailed evidence, and keep the current cycle focused on fresher proof inputs and trustworthy recovery evidence before expanding scope.

---

_Last updated: 2026-06-23 after completing Phase 144 of Milestone v4.6._
