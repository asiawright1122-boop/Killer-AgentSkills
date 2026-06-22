---
phase: 117
plan: 117-01
type: verify
wave: 1
depends_on:
  - 116
files_modified:
  - reports/gsc/latest-ctr-report.json
  - reports/gsc/latest-ctr-report.md
  - reports/seo/latest-recovery-scorecard.json
  - reports/seo/latest-recovery-scorecard.md
  - reports/seo/latest-recovery-control-board.json
  - reports/seo/latest-recovery-control-board.md
  - reports/seo/latest-authority-surface-program.json
  - reports/seo/latest-authority-surface-program.md
  - reports/seo/latest-recovery-proof-window.json
  - reports/seo/latest-recovery-proof-window.md
  - reports/seo/latest-recovery-delta-board.json
  - reports/seo/latest-recovery-delta-board.md
  - reports/seo/latest-authority-uplift-scorecard.json
  - reports/seo/latest-authority-uplift-scorecard.md
  - reports/seo/latest-authority-operator-queue.json
  - reports/seo/latest-authority-operator-queue.md
autonomous: true
must_haves:
  artifacts:
    - path: reports/seo/latest-authority-uplift-scorecard.json
      min_lines: 5
    - path: reports/seo/latest-authority-operator-queue.json
      min_lines: 5
  key_links: []
---

# Phase 117 Plan - Scorecard Promotion Verification

## Objective

Refresh production-like SEO evidence and validate whether enriched authority surfaces can move from `hold` to `promote` in the authority uplift scorecard.

## Requirement Traceability

- **AIOPS-38**: Validate promoted surfaces using scorecard reports under production-like configs.

## Tasks

1. Refresh live GSC CTR inputs.
2. Regenerate recovery scorecard and recovery control board.
3. Regenerate authority surface program.
4. Regenerate proof window and recovery delta board.
5. Run authority uplift scorecard without expansion override.
6. Run authority operator queue from the refreshed scorecard.
7. Record promotion outcome and remaining blockers.
