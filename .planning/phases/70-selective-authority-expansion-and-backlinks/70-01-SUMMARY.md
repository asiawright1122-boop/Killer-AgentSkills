---
phase: 70-selective-authority-expansion-and-backlinks
milestone: v2.0
plan_id: 70-01
status: in-progress
created: 2026-06-01
---

# Phase 70 Plan 70-01 Summary

Promote up to 5 authority surfaces and acquire 3+ external backlinks.

## Progress

- Internal-link audit: completed (all 5 P0 surfaces >=4 placements)
- Editorial queue: completed (5 surfaces in NOW, 2 in NEXT)
- Backlink assets: completed (`data/ide-comparison-matrix.json`, OG metadata verified)
- Badge API: completed (`src/pages/api/badge.ts` — shields.io-style SVG for GitHub README embedding)
- dev.to article draft: completed (`data/drafts/dev-to-ide-comparison.md`)
- Badge embedding guide: completed (docs integrations page, EN + ZH)
- Authority uplift scorecard: completed — all 32 surfaces in `hold`, 0 promote-ready
- Deep SEO audit: completed (`70-SEO-AUDIT.md`) — 9 on-page fixes, 8 placement upgrades, FAQ6 added
- Tests: 845 pass / 0 fail

## Scorecard Analysis

All surfaces blocked by **proof-readiness** gate (trust=warning, businessRecovery=warning).
- `home-root` is closest to promote: ranking ✅(pos 6), coverage ✅, linking ✅, trajectory ✅
- Only needs: 1 click (visibility gate) + trust verdict upgrade (proof gate)
- Delta board blockers: "Business recovery remains unproven" + "No authority surface qualifies for promotion yet"

This is a chicken-and-egg problem: need traffic to promote, need promotion to get traffic.
Solution: create external backlink entry points to drive organic clicks.

## Key Decisions

1. **No code changes needed for Steps 1-2** — placements and editorial queue were already well-configured from prior phases
2. **IDE comparison matrix** created as structured JSON for embedding in external articles
3. **Badge API** (`/api/badge?type=skills`) created for GitHub README embedding — returns SVG with dynamic skill count
4. **Backlink publishing** requires manual action — cannot automate GitHub README edits or dev.to posts
5. **Deep SEO audit** identified 9 on-page issues — all fixed: title lengths, description lengths, missing SEO metadata
6. **8 under-linked surfaces** upgraded from 2→3+ placements to meet minimum internal-link threshold
7. **FAQ6 "What is MCP"** added to homepage for featured snippet opportunity across all 10 locales

## Next Manual Actions Required

1. **GitHub README backlink**: Embed `[![Killer-Skills](https://killer-skills.com/api/badge?type=skills)](https://killer-skills.com)` in a relevant open-source repo
2. **dev.to article**: Publish IDE comparison summary using `data/ide-comparison-matrix.json` as source
3. **Social share**: Share homepage on X/Twitter to verify OG card rendering
4. **Fresh GSC export**: Download Coverage Drilldown from GSC UI to restore freshness SLA
5. **Re-run scorecard**: After organic clicks appear, re-run `npx tsx scripts/seo-authority-uplift-scorecard.ts`
