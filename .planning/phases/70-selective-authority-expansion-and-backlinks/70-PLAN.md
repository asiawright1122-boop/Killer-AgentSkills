---
phase: 70-selective-authority-expansion-and-backlinks
milestone: v2.0
plan_id: 70-01
status: active
created: 2026-06-01
---

# Phase 70 Plan 70-01

Promote up to 5 authority surfaces and acquire 3+ external backlinks.

## Steps

### 1. Strengthen internal-link support for P0 surfaces
- Audit current placements in `data/authority-surfaces.json`
- Add missing cross-links between P0 surfaces (home→collections→docs→guides)
- Verify each P0 surface has >=4 placements
- **Verify**: `placements.length >= 4` for all 5 P0 surfaces

### 2. Set editorial queue to NOW for top-3 surfaces
- Move `collection-official-trusted-tools`, `collection-agent-workflows`, `docs-installation` to NOW queue
- Add freshness signals (last-maintained timestamps) to each
- **Verify**: editorial priority reflects in surface metadata

### 3. Create backlink-worthy assets
- Add "Killer-Skills in 60 seconds" summary block to homepage (linkable snippet)
- Create a comparison matrix JSON (`data/ide-comparison-matrix.json`) for dev.to/GitHub embedding
- Add canonical share URLs with OG tags to key surfaces
- **Verify**: at least 3 surfaces have share-ready OG metadata

### 4. Backlink acquisition targets
- GitHub README: add Killer-Skills badge/link to a relevant open-source repo
- dev.to: publish IDE comparison summary as a community article
- Social: ensure Twitter/OG cards render correctly for sharing
- **Verify**: 3+ external backlinks confirmed

### 5. Run authority uplift scorecard
- Execute `npx tsx scripts/authority-uplift-scorecard.ts` (if exists) or manually evaluate gates
- Document which surfaces are closest to promote-ready
- **Verify**: scorecard report generated

## Success Criteria (from ROADMAP)

1. Up to 5 top-performing holding authority surfaces promoted to active status
2. At least 3 organic, non-paid external backlinks point to active canonical pages
