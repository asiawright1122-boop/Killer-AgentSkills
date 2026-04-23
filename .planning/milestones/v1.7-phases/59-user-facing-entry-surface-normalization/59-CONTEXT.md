# Phase 59: user-facing-entry-surface-normalization - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Source:** Phase `58` inventory, the confirmed homepage fix, and the need to normalize the next highest-impact public trust surfaces

<domain>
## Phase Boundary

This phase rewrites the highest-impact public entry surfaces so they read like product guidance for users instead of internal strategy, editorial process, or operator notes.

This phase covers:

- normalizing high-visibility public templates under `src/pages/` that currently render internal-style phrasing
- rewriting shared public collection copy in `src/content/collections/` that feeds many public pages at once
- cleaning shared authority-surface and locale strings that still frame pages as recovery lanes, operator workflows, or decision machinery
- adding regression coverage for the phrase families addressed during this normalization pass

This phase does not cover:

- a full style rewrite for every public page in the repository
- internal docs or planning artifacts that are intentionally operator-facing
- generalized automated leak detection rules beyond the surfaces touched in this pass
</domain>

<decisions>
## Implementation Decisions

- **D-01:** Preserve page information architecture and linking behavior while rewriting copy into plain user-facing guidance.
- **D-02:** High-traffic discovery and trust surfaces come first: `collections` hub, collection detail pages, solution entry pages, install/docs bridges, skill detail public framing, and shared collection sources.
- **D-03:** Shared collection JSON files should be treated as the main systemic source; when the same internal phrase family appears repeatedly, normalize it consistently across the whole set rather than patching individual pages ad hoc.
- **D-04:** Acceptable replacement language should describe what users can do next, what the page includes, and why it is helpful, without exposing editorial process, operator checkpoints, handoff governance, or internal decision choreography.
</decisions>

<specifics>
## Specific Ideas

- Replace wording like `trusted starter collection`, `editorial filter`, `operator handoff`, `operator checkpoint`, `sanity-check`, `收口`, `交叉核对`, and `落地路径` with plain install, compare, review, and next-step guidance.
- Keep data fields such as `editorial`, `trustSignals`, and `decisionTracks` if the templates rely on them, but rewrite the rendered labels and descriptions so users see helpful product copy rather than process language.
- Prefer user-facing framing such as `recommended next steps`, `good fit if`, `what this page covers`, `installation guide`, and `related collections`.
- Extend existing public-link regression tests with phrase-level bans for the public trust surfaces touched in this phase.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/58-public-copy-boundary-audit-and-inventory/58-01-SUMMARY.md`
- `src/pages/[locale]/collections/index.astro`
- `src/pages/[locale]/collections/[...slug].astro`
- `src/pages/[locale]/solutions/[topic].astro`
- `src/pages/[locale]/docs/[...slug].astro`
- `src/pages/[locale]/skills/[owner]/[...repo].astro`
- `src/lib/authority-surface-public-data.ts`
- `src/messages/zh.json`
- `src/content/collections/`
- `tests/pages/public-links.test.ts`
</canonical_refs>

<deferred>
## Deferred Ideas

- Repository-wide reusable detection utilities and broader copy-boundary automation belong in Phase `60`.
- Lower-traffic public pages that are not fed by the normalized shared sources can be audited after this phase if hotspots remain.
</deferred>

---

_Phase: 59-user-facing-entry-surface-normalization_
_Context gathered: 2026-04-23_
