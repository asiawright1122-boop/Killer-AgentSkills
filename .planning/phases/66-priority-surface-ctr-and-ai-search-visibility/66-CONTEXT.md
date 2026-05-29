---
phase: 66-priority-surface-ctr-and-ai-search-visibility
milestone: v1.9
requirements:
  - CTR-02
  - GEO-04
status: active
created: 2026-05-29
---

# Phase 66 Context: Priority Surface CTR and AI Search Visibility

## Goal

Improve click-facing priority authority surfaces and capture AI-search visibility evidence without adding manipulative or internal-facing copy, satisfying requirements `CTR-02` and `GEO-04`.

## Current Truth

- **Phase 65 status**: Completed and deployed. High-priority URL recovery is live.
- **Google Search Console CTR**:
  - Live-api backed for `2026-04-08` to `2026-05-05` (from `reports/gsc/latest-ctr-report.json`).
  - `26` query rows, `507` page rows, `2` query precision risks (réusinage de code react native, refactorisation react native).
- **Core target surfaces**:
  - Selected from GSC opportunities, GSC opportunity board (`npm run report:gsc:opportunities`), or authority uplift scorecard (`npm run report:seo:authority-uplift-scorecard`).
- **IndexNow submissions**: Active via `npm run submit:indexnow`.
- **Traceability**: `CTR-02` and `GEO-04` are currently `pending`.

## Decision Boundary

- No speculative or "search-engine-first" copy changes (all text must read like product guidance and comply with helpful-content/snippet policies).
- No synthetic or invented citations for AI-search; if verified evidence (e.g. Bing Webmaster / GSC AI-search) is unavailable, it must be recorded explicitly.

## Next Required Actions

1. Run GSC opportunity board and authority uplift scorecard scripts to identify the exact priority surfaces needing CTR/GEO improvements.
2. Formulate and apply user-facing metadata/schema improvements.
3. Submit URLs via IndexNow.
4. Capture search / AI visibility evidence and record the status.
