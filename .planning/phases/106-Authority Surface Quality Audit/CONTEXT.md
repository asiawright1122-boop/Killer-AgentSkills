# Phase 106 Context — Authority Surface Quality Audit

## Decisions Reached

- **Internal Link Support (placements)**: We will prioritize upgrading placement configurations to inject internal links to authority pages on key global placements (e.g., sidebar, main navigation) rather than keeping them static, to ensure they pass the `internal-link-support` score gate.
- **Target Pages**: The primary focus of the content upgrade and audit work will be the two P0 golden pages: `Official AI Skills & Trusted Tools` and `Cursor-Compatible Skills`.
- **Trust Verdict Strategy**: We will maintain the standard GSC fetch schedule and allow the trust verdict to naturally transition to `ready` over subsequent weekly performance summaries, avoiding manual local override parameters unless absolutely required for CI validation.

## Scope of Phase 106

- Run a complete audit of the 32 authority surfaces (specifically analyzing configuration configurations and placement definitions).
- Document current blockers (content debt, placements issues) for the two target P0 pages (`Official AI Skills & Trusted Tools` and `Cursor-Compatible Skills`).
- Compile an audit report (.md file) in the phase directory to outline actionable content & configuration upgrade instructions.

## Key Files

| File | Role |
|------|------|
| `data/authority-surfaces.json` | Placements and authority configuration |
| `src/lib/authority-surface-public-data.ts` | Shared public data for authority pages |
| `reports/seo/latest-authority-uplift-scorecard.md` | Uplift scorecard showing hold/stop statuses |
