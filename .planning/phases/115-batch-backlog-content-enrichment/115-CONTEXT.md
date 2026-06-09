# Phase 115: Batch Backlog Content Enrichment - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute batch enrichment on all currently thin or hold collections under `src/content/collections/` which are referenced in `data/authority-surfaces.json`, generating drafts to `data/enrichment-drafts.json`, applying them to collection source JSONs, and ensuring complete alignment with local CJK parity and punctuation rules.
</domain>

<decisions>
## Implementation Decisions

### Target Scope
- **D-01:** Limit batching to pages in `data/authority-surfaces.json` of class `collection` that fail the enrichment/locale check. Do not perform generic bulk updates on all collection JSONs.

### Model Routing & LLM Fallback
- **D-02:** Prioritize OpenRouter `google/gemini-2.5-flash` for high-quality multilingual translations (specifically targeting CJK parity and proper locale-specific trailing punctuation). Fall back to NVIDIA and Workers AI in case of rate limiting.

### Execution Pacing
- **D-03:** Run the batch generator script with a high limit (e.g. `--limit=40`) to generate all drafts in a single command run, storing results in `data/enrichment-drafts.json`.

### Stage & Apply Flow
- **D-04:** Merge generated drafts via `npm run enrichment:apply` once the batch runner finishes.

### Post-Apply Quality Guardrails
- **D-05:** After applying changes, execute `node --import tsx scripts/verify-cjk.js` for punctuation verification, alongside `npm run typecheck` and public surface smoke validation tests to confirm zero regressions.

### Copy Boundaries & Punctuation
- **D-06:** Enforce strict copy boundaries: generated content must avoid forbidden keywords (`review`, `validation`, `checklist`, `checkpoint`, `trusted next`) in all localized variants.
- **D-07:** Enforce mandatory locale-appropriate trailing punctuation (e.g., "。" for `zh`/`ja`, and "." for Western languages).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auditing & Quality Specs
- `scripts/seo-content-enrichment-report.ts` — Defines thin content thresholds.
- `docs/collections-quality-checklist.md` — Defines strict schema, locales parity, and copy boundary constraints.
- `scripts/enrich-collections-batch.ts` — Implements the batch translation and generation logic.
- `scripts/enrich-collections-apply.ts` — Implements the merge-back logic.
</canonical_refs>
