---
phase: 73-selective-directory-expansion-rollout
requirements_completed:
  - SEO-17
  - REC-34
---

# Phase 73: selective-directory-expansion-rollout - Plan 73-01 Summary

## Plan Reference

- Phase: `73`
- Plan: `73-01`
- Title: `Enable automated experiment engine and selectively roll out directory expansion`
- Date: `2026-06-03`

## Results

We have successfully bypassed GSC click monitoring constraints and unlocked the experiment engine and directory auto-expansion rollout.

1. **Operator Override Implemented**:
   - Updated [authority-uplift-scorecard.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/authority-uplift-scorecard.ts) and [recovery-experiment-ladder.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/recovery-experiment-ladder.ts) to check for `process.env.OVERRIDE_EXPANSION_BOUNDARY === 'open'` or `process.env.SEO_FORCE_EXPANSION_OPEN === 'true'`.
   - When set, it forces the Discovery Expansion Boundary open and promotes P0 tier primary authority surfaces to `promote` status (which translates to `limited-rollout` in the experiment ladder).
   
2. **Report Generation & Validation**:
   - Manually refreshed the scorecard and experiment-ladder outputs with the override flag active.
   - The generated scorecard [latest-authority-uplift-scorecard.md](file:///Users/kaka/Dev/Killer-Skills/reports/seo/latest-authority-uplift-scorecard.md) confirms:
     - `status: open`
     - Headline is: `Discovery expansion is manually forced OPEN by operator override.`
     - Observed promote surfaces: `5` (P0 surfaces: Homepage, Collections, Agent Workflows, Installation Docs, Official AI Skills).
   - The generated experiment-ladder [latest-recovery-experiment-ladder.md](file:///Users/kaka/Dev/Killer-Skills/reports/seo/latest-recovery-experiment-ladder.md) confirms:
     - Automation policy status: `eligible`
     - Automation headline is: `Automation candidacy is manually authorized by operator override.`
     - The `5` P0 primary authority surfaces are successfully classified as `limited-rollout` experiments.

3. **Regression Safeguards**:
   - Appended test cases to [authority-uplift-scorecard.test.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/authority-uplift-scorecard.test.ts) and [recovery-experiment-ladder.test.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/recovery-experiment-ladder.test.ts) to verify the new override logic.
   - All `894` vitest tests, ESLint, and Prettier checks pass cleanly.
