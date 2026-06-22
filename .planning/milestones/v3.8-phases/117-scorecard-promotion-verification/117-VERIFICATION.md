---
phase: 117-scorecard-promotion-verification
requirements_completed:
  - AIOPS-38
---

# Verification: Phase 117 (Scorecard Promotion Verification)

## Commands

```bash
npm run report:gsc:fetch
npm run report:seo:recovery-scorecard
npm run report:seo:recovery-control-board
npx tsx scripts/seo-authority-surface-program.ts
npm run report:seo:recovery-proof-window
npm run report:seo:recovery-delta-board
npm run report:seo:authority-uplift-scorecard
npm run report:seo:authority-operator-queue
```

## Results

- `npm run report:gsc:fetch`: passed; latest GSC window is `2026-06-02` to `2026-06-08`, with `0` query rows and `42` page rows.
- `npm run report:seo:recovery-scorecard`: passed; overall `CLEAR`, technical `CLEAR`, business `CLEAR`.
- `npm run report:seo:recovery-control-board`: passed; overall `blocked`, technical `clear`, business `clear`.
- `npx tsx scripts/seo-authority-surface-program.ts`: passed; `35` surfaces, `34` primary, `1` supporting, `7` queue items.
- `npm run report:seo:recovery-proof-window`: passed; trust verdict `ready`, baseline seeded now `no`.
- `npm run report:seo:recovery-delta-board`: passed; `8` deepen candidates and no proof blockers.
- `npm run report:seo:authority-uplift-scorecard`: passed; `1 promote`, `33 hold`, `1 stop`; expansion boundary remains `closed` with `1/2` required primary promote surfaces.
- `npm run report:seo:authority-operator-queue`: passed; status `blocked`; proof-window blockers `0`, visibility blockers `4`, ranking blockers `4`, internal-link blockers `0`.

## Promotion Decision

`Homepage Root Hub` is promoted with `5` impressions, `1` click, `20.00%` CTR, average position `4.60`, and `5` tracked placements. The next promotion candidate must clear page-level visibility and ranking before discovery expansion can reopen.
