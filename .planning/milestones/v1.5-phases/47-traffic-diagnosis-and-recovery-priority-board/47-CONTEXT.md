# Phase 47: traffic-diagnosis-and-recovery-priority-board - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Source:** planned Phase `46` evidence lane, current recovery scorecard limitations, and the need to turn global recovery status into surface-level diagnosis

<domain>
## Phase Boundary

This phase turns fresh recovery evidence into a ranked diagnosis of where the project is still losing traffic and where it is already recovering.

This phase covers:

- attributing traffic gaps by page, query, locale, and issue cluster
- ranking blocked, recoverable, and already-recovered surfaces
- surfacing evidence-backed next actions in one operator board
- preserving the distinction between measurement gaps and true demand weakness

This phase does not cover:

- shipping the recovery interventions themselves
- broad content regeneration or full-site re-optimization
- changing the technical crawl-health baseline that is already stable
  </domain>

<decisions>
## Implementation Decisions

- **D-01:** Global recovery status is no longer enough; operators need surface-level diagnosis.
- **D-02:** The board should rank opportunities, not just list symptoms.
- **D-03:** Page, query, locale, and issue-cluster lenses should resolve into one coherent priority view instead of disconnected reports.
- **D-04:** Recovery attribution should stay evidence-first so manual hunches do not outrank measured gaps.
  </decisions>

<specifics>
## Specific Ideas

- The current scorecard says whether business recovery is blocked, but it does not yet say which surfaces offer the highest leverage for recovery execution.
- Priority output should help answer: which pages lost traffic, which queries slipped, which locales remain suppressed, and which issue clusters still correlate with loss.
- This phase should build the board that Phase `48` can execute against.
  </specifics>

<canonical_refs>

## Canonical References

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/milestones/v1.5-phases/46-fresh-search-console-and-coverage-ingestion/46-CONTEXT.md`
- `.planning/milestones/v1.4-MILESTONE-AUDIT.md`
- `reports/seo/latest-recovery-scorecard.json`
- `reports/gsc/latest-ctr-report.md`
- `reports/seo/latest-coverage-drilldown.json`
- `reports/seo/index-drift.json`
  </canonical_refs>

---

_Phase: 47-traffic-diagnosis-and-recovery-priority-board_
_Context gathered: 2026-04-09_
