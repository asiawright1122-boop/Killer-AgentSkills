# Plan: GSC Removal Batch Submission & Index Verification

This phase closes milestone v4.9 by submitting the 975-URL GSC removal batch via the Google Search Console URL Removal tool (a manual operator task — Google provides no URL Removal API), then verifying index reduction through the URL Inspection coverage sweep and recovery scorecard.

- **Wave:** 3
- **Depends on:** Phase 154 (coverage freshness pipeline + expansion boundary open)
- **Requirements:** REMOV-01
- **Autonomous:** partial — operator action required for submission; automation supports planning, tracking, and verification

## Context

- The discovery expansion boundary is already `open` (Phase 154).
- The 975-URL removal batch is staged at `reports/seo/latest-gsc-removal-batch.{csv,json,md}`.
- The operator runbook is at `docs/superpowers/runbooks/gsc-url-removal-runbook.md`.
- Google's URL Removal tool has no API — submission is manual via the GSC web UI.
- Prefix removal is mostly NOT viable: only 2 safe repo-level prefixes exist (most owner-level prefixes would collateral-remove live skill landing pages).

## Automation Delivered (this phase)

The manual submission cannot be automated, but the surrounding planning, tracking, and verification can. This phase delivers:

1. **Runbook corrections** — cluster counts, priority order, and baseline values now match the actual batch data (`latest-gsc-removal-batch.md`).
2. **`scripts/seo-gsc-removal-tracker.ts`** — a four-command tracker:
   - `status` — submission dashboard (per-cluster progress, submission log)
   - `prefix` — extracts SAFE prefix-removal candidates (verifies no live landing page is collateral-removed)
   - `mark` — records a submission (`--cluster`, optional `--prefix`/`--count`)
   - `verify` — delegates to the URL Inspection coverage sweep
3. **`npm run report:seo:gsc-removal-tracker`** — npm script wiring.

## Operator Workflow (manual)

1. Open the [GSC URL Removal tool](https://search.google.com/search-console) for `killer-skills.com`.
2. Run `npm run report:seo:gsc-removal-tracker -- prefix` to see the 2 safe prefix removals; submit those first.
3. Submit the remaining ~968 URLs individually (priority order in the runbook: source_file → skill_blocklisted → trailing_slash → skill_missing_or_unpublished → rest).
4. After each cluster batch, record progress: `npm run report:seo:gsc-removal-tracker -- mark --cluster <name> --count <N>`.
5. After all 975 are submitted, wait 24–48h, then run the verification pipeline (runbook §5).

## Tasks

### Task 1: Fix runbook factual errors

<acceptance_criteria>
- Runbook priority table cluster counts match `latest-gsc-removal-batch.md` exactly.
- Runbook success-criteria "before" values reflect post-Phase-154 state (boundary=open, compliance=watch).
- Removal target corrected to <2,000 (matching batch summary).
</acceptance_criteria>

### Task 2: Create the removal tracker script

<acceptance_criteria>
- `scripts/seo-gsc-removal-tracker.ts` exists with `status`, `prefix`, `mark`, `verify` commands.
- `npm run report:seo:gsc-removal-tracker` is wired in package.json.
- `status` renders a per-cluster dashboard to `reports/seo/latest-gsc-removal-tracker.md`.
- `prefix` writes `reports/seo/latest-gsc-removal-prefix-plan.md` with only SAFE prefixes.
- `mark --cluster <name> [--prefix <p>] [--count N]` appends to the tracker JSON and re-renders.
- Argument parsing supports both `--flag=value` and `--flag value` forms.
</acceptance_criteria>

### Task 3: Update planning docs

<acceptance_criteria>
- STATE.md reflects Phase 155 automation delivered + manual submission pending.
- ROADMAP.md marks Phase 155 plan as complete.
- REQUIREMENTS.md updates REMOV-01 traceability with verification artifacts.
</acceptance_criteria>

## Success Criteria (overall phase)

- [ ] 975 URLs submitted to GSC URL Removal tool (operator task — tracked via `mark`).
- [ ] Coverage anomaly count reduced from 10,783 to <2,000 within 4 weeks.
- [ ] Recovery scorecard Gate 2 (coverage-drilldown) remains `clear`.
- [ ] Tracker dashboard shows 100% submission progress.

## Verification

```bash
# Operator records submissions as they go
npm run report:seo:gsc-removal-tracker -- status

# After submission, refresh + verify
npm run report:seo:recovery-refresh
npm run report:seo:url-inspection-coverage-sweep
npm run report:seo:authority-uplift
npm run report:seo:recovery-scorecard
npx vitest run
```
