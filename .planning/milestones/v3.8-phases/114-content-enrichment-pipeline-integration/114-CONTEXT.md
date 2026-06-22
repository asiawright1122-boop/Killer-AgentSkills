# Phase 114: Content Enrichment Pipeline Integration - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Build and integrate the automated content enrichment script (`scripts/enrich-collections-batch.ts`) that consumes diagnostics from `seo-content-enrichment-report.ts` and uses LLM routing to batch-generate enriched descriptions for thin authority surfaces.
</domain>

<decisions>
## Implementation Decisions

### LLM Provider
- **D-01:** Prioritize free models from NVIDIA, SiliconFlow, or OpenRouter. Fall back to free Workers AI models to ensure zero API cost.

### Batch & Retry Strategy
- **D-02:** Execute up to 3 exponential backoff retries on API request failures.
- **D-03:** Log errors on individual page generation failures and skip to the next page without aborting the batch script execution.

### Overwrite & Review Workflow
- **D-04:** Draft-First mode: Write all generated localized descriptions to `data/enrichment-drafts.json` first, keeping it isolated from collections JSON files.
- **D-05:** Implement a separate apply command (e.g. `npm run enrichment:apply`) to merge drafts into target collection files after review.

### Translation & Localization Flow
- **D-06:** Hybrid mode: Generate the primary English metadata first, then translate it into the remaining 9 locales (`zh`, `ja`, `ko`, `es`, `fr`, `de`, `pt`, `ru`, `ar`).
- **D-07:** Incremental Skip: Preserve existing localized descriptions if they are already rich (not thin) and non-empty. Only run AI translation for missing or thin locales.

### Prompt Constraints
- **D-08:** Defended-Hybrid prompt design: Embed public copy boundary instructions explicitly in LLM system instructions to avoid generating forbidden words (e.g., *review*, *validation*, *checklist*, *checkpoint*, *trusted next*).
- **D-09:** Target practical workflow benefits and technical clarity, and enforce trailing punctuation for all generated localized descriptions.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auditing & Quality Specs
- `scripts/seo-content-enrichment-report.ts` — Defines thin content conditions, character thresholds, and priority scores.
- `docs/collections-quality-checklist.md` — Defines strict schema, locales parity, and copy boundary constraints.
</canonical_refs>
