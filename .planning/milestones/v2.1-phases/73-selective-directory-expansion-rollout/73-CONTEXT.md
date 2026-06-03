# Phase 73: selective-directory-expansion-rollout - Context

## Background

Under Milestone `v2.1 Directory Auto-Expansion and Verification`, Phase 72 was designed to wait for organic GSC click feedback from backlinks and manual outreach before unlocking automated experiments. Due to the lack of immediate click return on primary surfaces, Phase 72 was manually bypassed under explicit user directive.

To allow progression to directory rollout trials while preserving the evaluation criteria logic, we implemented an operator override channel: setting `OVERRIDE_EXPANSION_BOUNDARY=open` or `SEO_FORCE_EXPANSION_OPEN=true` forces the Discovery Expansion Boundary open and evaluates P0 primary authority surfaces as `promote` (putting them in `limited-rollout` status).

This phase (Phase 73) focuses on:
1. Verifying that the operator override mechanism is functional in the evaluation scripts.
2. Generating and validating the updated scorecard and experiment-ladder reports reflecting the manual override.
3. Aligning with the Phase 73 success criteria by verifying that the boundary is open and at least one experiment (e.g., Homepage Root Hub) is in `limited-rollout`.

## Active Constraints

- This rollout remains manual-authorized. The underlying GSC clicks and impressions metrics are still visually reported as zero/warning inside the scorecard gates, but the verdict is forced to pass.
- We must make sure that all local tests (vitest, lint, format) pass under this configuration.
