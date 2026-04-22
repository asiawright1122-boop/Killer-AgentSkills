# Phase 53: authority-surface-proof-and-install-bridge - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning
**Source:** Phase 52 authority-surface inventory, editorial queue `NOW` items, and the need to make the top recovery surfaces visibly more useful and trustworthy

<domain>
## Phase Boundary

This phase strengthens the top-priority authority surfaces so they carry first-party proof and conversion value, not just stronger internal-link placement.

This phase covers:

- adding explicit editorial trust signals and maintenance framing to the official/trusted collection
- adding workflow grouping logic and execution examples to the top workflow collection
- turning installation docs into a stronger bridge from discovery to CLI action and validation
- preserving the collections-first recovery posture while making those pages more obviously helpful

This phase does not cover:

- broad redesign of all collection pages
- refreshing every editorial guide in the authority queue
- automated authority experiments beyond the current manual recovery loop
</domain>

<decisions>
## Implementation Decisions

- **D-01:** The top authority collections should prove why they were selected, not only what they contain.
- **D-02:** Workflow authority pages need concrete execution patterns so they look like practical guidance, not grouped inventory.
- **D-03:** Installation docs should act as the main trust bridge from discovery pages into CLI setup and validation.
- **D-04:** The phase should reuse the Phase 52 authority inventory rather than creating a second competing source of truth.
</decisions>

<specifics>
## Specific Ideas

- The official collection should expose explicit trust signals, review posture, and maintenance cadence.
- The workflow collection should explain grouping logic and show stepwise execution examples that justify the bundle.
- Installation docs should route users into CLI action, validation, and trusted next-step pages with clearer intent.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/milestones/v1.5-phases/52-authority-surface-repositioning-and-editorial-rebuild/52-CONTEXT.md`
- `.planning/milestones/v1.5-phases/52-authority-surface-repositioning-and-editorial-rebuild/52-01-SUMMARY.md`
- `data/authority-surfaces.json`
- `reports/seo/latest-authority-surface-program.md`
- `src/pages/[locale]/collections/[...slug].astro`
- `src/pages/[locale]/docs/[...slug].astro`
- `src/content/collections/top-official-mcp-servers.json`
- `src/content/collections/top-workflow-mcp-servers.json`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/authority-surfaces.ts` already resolves the recovery inventory for public pages
- collection pages already support richer long-form sections and can be extended without changing route structure
- docs pages already support entry-link cards and FAQ framing

### Established Patterns
- curated browse surfaces now lead with authority-surface cards after Phase 52
- collections are already canonicalized and treated as safer public landing pages than raw skill detail pages
- docs already serve as step-by-step onboarding surfaces with strong schema markup

### Integration Points
- collection content schema in `src/content.config.ts`
- collection content JSON in `src/content/collections/`
- collection detail rendering in `src/pages/[locale]/collections/[...slug].astro`
- docs rendering in `src/pages/[locale]/docs/[...slug].astro`
</code_context>

<deferred>
## Deferred Ideas

- refresh the broader editorial queue beyond the `NOW` items
- create automated freshness monitoring for authority-surface content updates
- expand this proof layer to additional collections after the first three surfaces are validated
</deferred>

---

_Phase: 53-authority-surface-proof-and-install-bridge_
_Context gathered: 2026-04-16_
