# Phase 2: Re-Enrichment Pipeline Run - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning
**Source:** Auto-generated follow-on context after Phase 01.1 completion

<domain>
## Phase Boundary

This phase regenerates SEO data for the existing skill corpus that now fails the tightened theme-compliance gates, then publishes the corrected dataset through the canonical runtime path.

The phase covers:
- Re-enrichment of the currently flagged skill subset in `data/skills-cache.json`
- Theme-compliant title, keyword, description, and locale SEO regeneration
- Publish flow through the canonical skill runtime store
- Audit coverage for integrity, thin content, missing bodies, and drift
- Before/after reporting for the regenerated dataset

This phase does not cover:
- New frontend interaction or layout work
- Broad keyword-research expansion beyond the current theme contract
- New schema, internal-linking, or CTR experiments
- New harvesting/discovery scope outside the current indexed corpus
</domain>

<decisions>
## Implementation Decisions

### Rollout scope
- **D-01:** Re-enrich the already indexed corpus and its currently failing subset; do not expand GitHub discovery scope in this phase.
- **D-02:** Favor resumable, batch-safe execution over an opaque one-shot run so provider limits or intermittent failures do not force a full restart.
- **D-03:** Limit changes to SEO-relevant generated fields and publish artifacts; do not change public routing, taxonomy, or page templates in this phase.

### Multilingual SEO contract
- **D-04:** English SEO output is the source of truth for theme compliance; localized SEO should only publish after the English fields satisfy the new gates.
- **D-05:** Product names and ecosystem anchors such as Claude Code, Cursor, Windsurf, and MCP remain untranslated per glossary rules.
- **D-06:** Localized keyword/title generation should prefer glossary-consistent native theme anchors over ad-hoc mixed-language phrasing.

### Publish and rollback gates
- **D-07:** D1 is the canonical runtime store for skill-page data, so `npm run sync:d1:delta` is the primary publish gate for regenerated skills.
- **D-08:** `npm run sync:kv` remains a supporting asset sync step for docs and sitemap surfaces; it must not be treated as the canonical skill-data publish step.
- **D-09:** Do not push a partial production publish when integrity or quality audits fail; keep failures local and resumable until the dataset passes.

### Verification and observability
- **D-10:** Capture before/after counts for missing theme terms, missing title identifiers, sitemap/index drift, and locale coverage so this phase produces an auditable delta.
- **D-11:** Preserve a sample set of upgraded skills plus any blocked/skipped IDs in report artifacts for spot-checking.
- **D-12:** Completion requires both dataset quality checks and integrity checks, not just a successful build/publish command exit code.

### the agent's Discretion
- Batch size, concurrency, and checkpoint file shape
- Whether to run direct scripts or the pipeline wrapper for repeated local iterations
- Exact report filenames beyond the required audit artifacts
</decisions>

<specifics>
## Specific Ideas

- Start with a dry-run or report-first pass that quantifies how many skills will actually be regenerated before any publish step.
- Use `reports/seo/index-drift.json` as one of the spot-check inputs for sample validation after regeneration.
- Keep a short human-readable phase report that answers: how many skills changed, how many were skipped, why they were skipped, and whether multilingual outputs stayed glossary-safe.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project and phase state
- `.planning/PROJECT.md` — milestone intent and theme-integrity background
- `.planning/ROADMAP.md` — Phase 2 goal, sequence, and guardrails
- `.planning/STATE.md` — current project position after Phase 01.1 completion
- `.planning/milestones/v1.0-phases/01.1-stabilize-frontend-interactions-breadcrumbs-i18n-and-seo-contracts/01.1-06-SUMMARY.md` — most recent stabilization outcome and residual concerns

### Regeneration pipeline
- `package.json` — canonical pipeline, sync, audit, and smoke commands
- `scripts/build-skills-cache.ts` — main re-enrichment pipeline and theme-compliance gate behavior
- `scripts/lib/ai.ts` — SEO keyword sanitization, locale keyword injection, and provider orchestration
- `src/lib/shared/validation.ts` — positive theme gate and non-target exclusion logic

### Publish and verification
- `scripts/sync-d1-delta.ts` — canonical runtime publish path for skill data
- `scripts/sync-to-kv.ts` — supporting KV sync behavior and current scope limitations
- `scripts/seo-index-integrity.ts` — strict integrity, drift, thin-content, and missing-body audit path
- `reports/seo/index-drift.json` — current sitemap/indexable-cache drift evidence

### Terminology and locale consistency
- `data/terminology-glossary.json` — product-name and translation constraints for localized SEO output
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/build-skills-cache.ts`: already determines which skills are considered fully optimized and therefore which entries should be regenerated.
- `scripts/lib/ai.ts`: already injects theme anchors and locale-native keyword fallbacks, so Phase 2 should build on those guards instead of inventing a second SEO path.
- `scripts/seo-index-integrity.ts`: already writes drift artifacts and can be promoted from "reporting" to a hard verification gate for this phase.

### Established Patterns
- Skill SEO generation is script-driven and data-backed, not page-template-driven.
- Runtime skill data is published through D1; KV sync is now auxiliary for docs/sitemap concerns.
- Locale consistency work from Phase 01.1 established a "no mixed-language leakage on public surfaces" expectation that Phase 2 must preserve at the data layer.

### Integration Points
- Regenerated cache output feeds `scripts/sync-d1-delta.ts` for runtime publication.
- Integrity reports in `reports/seo/` provide the before/after evidence loop.
- Existing public SEO smoke coverage should remain a post-publish confidence check after data regeneration.
</code_context>

<deferred>
## Deferred Ideas

- Expand seed-keyword research and prompt strategy in Phase 4.
- Add structured data, related-skill linking, and broader technical SEO enhancements in Phase 3.
- Add GSC/CTR monitoring and experiment loops in Phase 5.
</deferred>

---

*Phase: 02-re-enrichment-pipeline-run*
*Context gathered: 2026-03-31*
