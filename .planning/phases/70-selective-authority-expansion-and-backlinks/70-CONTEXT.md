---
phase: 70-selective-authority-expansion-and-backlinks
milestone: v2.0
created: 2026-06-01
---

# Phase 70 Context

## Goal

Selectively expand high-intent holding authority surfaces and acquire quality organic backlinks.

## Current Truth

- 32 authority surfaces defined in `data/authority-surfaces.json`
- P0 surfaces: `home-root`, `collections-hub`, `collection-official-trusted-tools`, `collection-agent-workflows`, `docs-installation`
- All surfaces currently in `hold` decision (no promote-ready surfaces)
- Discovery expansion gate is `closed` (requires >=2 primary surfaces with `promote` decision)
- Phase 69 completed: URL Inspection verified 404 persistence, middleware 410 Gone fix deployed
- GSC data is sparse (0 query rows, 32 page rows) — traffic recovery still early

## Decision Boundary

- **Promote** = surface clears all uplift gates (proof, freshness, visibility, ranking, linking, trajectory)
- **Hold** = surface stays in authority set but uplift remains gated
- **Stop** = surface explicitly outside lead recovery lane

Phase 70 focuses on surfaces that can realistically clear gates WITHOUT waiting for traffic:
1. Internal-link support (controllable — add placements)
2. Editorial priority (controllable — queue NOW surfaces)
3. Backlink acquisition (controllable — create linkable assets)

Traffic-dependent gates (visibility, ranking) will follow as Google re-crawls.

## Key Files

- `data/authority-surfaces.json` — surface registry with placements
- `scripts/lib/authority-uplift-scorecard.ts` — promotion gate logic
- `scripts/lib/recovery-experiment-ladder.ts` — automation policy
- `docs/seo-team/agent-04-content-authority.md` — editorial queue rules
