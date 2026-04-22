# Phase 41: remediation-handoff-automation - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Source:** Completed Phase 37 remediation seeding lane, current Phase 40 provider-pressure controls, and the existing operator handoff scaffold contract in `scripts/lib/operator-ops-summary.ts`

<domain>
## Phase Boundary

This phase promotes repo-local remediation seeds into deduped GitHub issue or PR handoffs when repository configuration allows it.

This phase covers:

- publishing existing remediation scaffolds to GitHub when a handoff mode is configured
- deduplicating repeat warning or blocking states so repeated runs do not create noisy duplicate issues or PR scaffolds
- preserving quiet runs and disabled states when no handoff mode, repository target, or token is configured

This phase does not cover:

- widening provider fallback behavior or Workers AI usage
- introducing third-party ticketing systems beyond GitHub
- automatically generating remediation code changes for provider incidents
  </domain>

<decisions>
## Implementation Decisions

- **D-01:** Reuse the Phase 37 remediation and handoff scaffold contract instead of inventing a second external-automation schema.
- **D-02:** Treat GitHub publication as optional and configuration-gated; a missing token, repository target, or PR head branch must degrade to a quiet reportable skip, not a crash.
- **D-03:** Deduplication must prefer updating or reusing an existing GitHub artifact over opening duplicate handoffs for the same remediation item.
- **D-04:** Keep issue handoff as the default external path; PR handoff is allowed only when the repository configuration is sufficient to create or update a draft PR safely.
  </decisions>

<specifics>
## Specific Ideas

- The repository already emits `reports/seo/latest-ops-remediation.{md,json}` and `reports/seo/latest-ops-handoff.{md,json}`, so Phase 41 should extend that lane rather than replace it.
- `scripts/lib/operator-ops-summary.ts` already provides stable `dedupeKey`, `fingerprint`, `branchName`, and scaffold body metadata, which is enough to anchor GitHub-side dedupe.
- Scheduled monitoring in `.github/workflows/seo-monitoring.yml` is the natural place to publish handoffs because it already computes the upstream health/governance/remediation artifacts on a bounded cadence.
- CI should remain read-mostly and artifact-focused; it can generate handoff scaffolds for inspection, but it should not open external issues by default.
  </specifics>

<canonical_refs>

## Canonical References

- `.planning/PROJECT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/milestones/v1.2-phases/37-remediation-seeding-and-ops-summary/37-CONTEXT.md`
- `.planning/milestones/v1.2-phases/37-remediation-seeding-and-ops-summary/37-01-SUMMARY.md`
- `.planning/milestones/v1.3-phases/40-rate-pressure-evidence-and-operator-controls/40-01-SUMMARY.md`
- `scripts/lib/operator-ops-summary.ts`
- `scripts/operator-ops-summary.ts`
- `scripts/lib/operator-ops-summary.test.ts`
- `reports/seo/latest-ops-remediation.json`
- `reports/seo/latest-ops-handoff.json`
- `.github/workflows/seo-monitoring.yml`
- `.github/workflows/ci.yml`
  </canonical_refs>

---

_Phase: 41-remediation-handoff-automation_
_Context gathered: 2026-04-07_
