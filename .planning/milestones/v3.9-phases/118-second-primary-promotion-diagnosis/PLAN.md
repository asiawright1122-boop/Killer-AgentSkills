---
phase: 118
plan: 118-01
type: diagnose
wave: 1
depends_on:
  - 117
files_modified:
  - reports/seo/latest-authority-uplift-scorecard.json
  - reports/seo/latest-authority-uplift-scorecard.md
  - reports/seo/latest-authority-operator-queue.json
  - reports/seo/latest-authority-operator-queue.md
  - .planning/milestones/v3.9-phases/118-second-primary-promotion-diagnosis/118-01-SUMMARY.md
  - .planning/milestones/v3.9-phases/118-second-primary-promotion-diagnosis/118-VERIFICATION.md
autonomous: true
must_haves:
  artifacts:
    - path: reports/seo/latest-authority-uplift-scorecard.json
      min_lines: 5
    - path: reports/seo/latest-authority-operator-queue.json
      min_lines: 5
  key_links: []
---

# Phase 118 Plan - Second Primary Promotion Diagnosis

## Objective

Identify the highest-likelihood second primary authority surface that can move from `hold` to `promote`, then define the smallest remediation batch needed to clear its visibility and ranking blockers.

## Requirement Traceability

- **AIOPS-39**: Diagnose the highest-likelihood second primary authority surface and define the smallest promotion remediation batch.

## Tasks

1. Inspect the latest authority uplift scorecard and operator queue.
2. Separate primary surfaces from supporting surfaces.
3. Rank primary `hold` surfaces by blocker count, GSC evidence, current internal-link support, and proximity to promotion thresholds.
4. Select one target candidate for the next remediation batch.
5. Record blocker-specific actions, evidence paths, and validation commands in the phase summary.
6. Keep discovery expansion closed unless the scorecard later shows at least two primary `promote` surfaces.
