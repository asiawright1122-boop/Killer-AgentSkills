# Phase 58: public-copy-boundary-audit-and-inventory - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Source:** `GOV-13`, the confirmed homepage copy leak, and the need to separate public product guidance from internal strategy/process language

<domain>
## Phase Boundary

This phase inventories and classifies where public-facing copy leaks internal strategy, planning, SEO-governance, or operator/process framing.

This phase covers:

- auditing public route templates under `src/pages/`
- auditing public shared content/messages under `src/messages/`, `src/content/`, and public-facing data consumed by templates
- classifying findings by severity, surface type, and remediation priority
- identifying the shared copy patterns that make these leaks likely to recur

This phase does not cover:

- fully rewriting every affected public page
- introducing final automated guardrails for future leaks
- changing internal/operator documents that are intentionally not public-facing
</domain>

<decisions>
## Implementation Decisions

- **D-01:** A finding only counts if the language is user-visible on a public product surface or comes from a content source that feeds a public product surface.
- **D-02:** Internal-strategy leakage includes operator language, SEO-governance framing, decision-framework phrasing, roadmap/process wording, and meta-instructions that read like internal notes.
- **D-03:** The audit should distinguish between direct template copy, shared messages, and content/data-source copy so downstream fixes target the real source.
- **D-04:** High-traffic entry surfaces should be prioritized above deep long-tail pages when ranking remediation urgency.
</decisions>

<specifics>
## Specific Ideas

- Seed the audit from the confirmed homepage example, then fan out into `collections`, `solutions`, `docs`, and shared authority-surface copy.
- Treat phrases like `trusted entry paths`, `narrow the choice`, `turn discovery into installation`, `authority surface`, `promotion`, `hold`, and similar internal framing as likely indicators rather than the only valid matches.
- The final inventory should call out which sources are safe to keep as internal/operator docs versus which must be rewritten for public routes.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `src/pages/[locale]/index.astro`
- `src/pages/[locale]/collections/`
- `src/pages/[locale]/solutions/`
- `src/pages/[locale]/docs/`
- `src/lib/authority-surface-public-data.ts`
- `src/content/collections/`
- `src/messages/`
</canonical_refs>

<deferred>
## Deferred Ideas

- Automated prevention belongs in Phase `60` after the inventory clarifies the real pattern set.
- Broad copy/style refreshes that are unrelated to internal-language leakage should wait until after the audit identifies true hotspots.
</deferred>

---

_Phase: 58-public-copy-boundary-audit-and-inventory_
_Context gathered: 2026-04-23_
