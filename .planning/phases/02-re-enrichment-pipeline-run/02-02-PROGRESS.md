# Plan 02-02 Progress Note (2026-04-02)

## Context
- Plan 02-02 requires checkpointed regeneration for the flagged subset with resumable behavior.
- Earlier resume attempts reused legacy checkpoint state and produced selection drift plus accidental cache rewrite side effects when no runnable tasks were found.

## Implemented Safeguard
- Updated `scripts/build-skills-cache.ts` batch mode behavior:
  - Added `batchHasPendingSelectedIds()` helper.
  - Added early-return guard when `selectedBatchIds` exists and `tasks.length === 0`.
  - In this case, checkpoint status is updated and cache rewrite is skipped.
- Verified by hash-check:
  - Before and after rerun hashes for `data/skills-cache.json` and `data/sitemap-skills.json` remained identical in no-task batch mode.

## Controlled Pilot Rerun
- Refreshed baseline:
  - `npm run report:seo:regeneration-baseline`
  - current queue: `3436` skills, `35` batches.
- Used isolated checkpoint file to avoid legacy state coupling:
  - `reports/seo/phase-02-batch-progress.rerun.json`
- Dry run:
  - `npm run build:cache -- --batch=1 --batch-plan=reports/seo/phase-02-regeneration-baseline.json --checkpoint-file=reports/seo/phase-02-batch-progress.rerun.json --max-items=3 --dry-run-batch`
  - pending IDs verified: `3`.
- Real run:
  - `npm run build:cache -- --batch=1 --batch-plan=reports/seo/phase-02-regeneration-baseline.json --checkpoint-file=reports/seo/phase-02-batch-progress.rerun.json --resume --max-items=3 --max-duration=8`
  - checkpoint result: `completed=3`, `failed=0`, `pending=0`, `status=completed`.

## Current Assessment
- Regeneration path is runnable and checkpoint isolation works.
- Plan 02-02 is not fully complete yet because pilot rerun covered only `3` IDs versus full queued scope (`3436`).
