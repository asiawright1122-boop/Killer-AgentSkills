# Phase 42: phase-archive-lifecycle-automation - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Source:** Completed planning traceability and milestone support lanes, current `.planning/phases/` residue from shipped milestones, and the open `TRACE-05` requirement in `v1.3`

<domain>
## Phase Boundary

This phase closes the remaining planning-lifecycle gap by making phase directories move cleanly between the active discovery path and milestone-specific archive paths.

This phase covers:

- archiving shipped milestone phase directories out of `.planning/phases/`
- restoring active milestone phase directories from milestone archive storage when work resumes
- creating missing active milestone phase directories when a new milestone is opened
- preserving stable evidence references by rewriting planning-file paths when directories move
- integrating lifecycle sync with the existing milestone bootstrap / closeout support flow

This phase does not cover:

- rewriting roadmap or requirements scope automatically
- changing GSD phase semantics outside repository-local planning artifacts
- deleting milestone evidence or historical planning content
  </domain>

<decisions>
## Implementation Decisions

- **D-01:** Use archived milestone roadmap files under `.planning/milestones/*-ROADMAP.md` as the source of truth for which phase directories belong to shipped milestones.
- **D-02:** Archive phase directories under `.planning/milestones/<milestone>-phases/` so milestone documents and evidence stay colocated.
- **D-03:** Rewrite `.planning/**/*.md` and `.planning/**/*.json` references during archive/restore operations so milestone audits, closeout docs, and historical phase links remain valid.
- **D-04:** Keep traceability logic roadmap-driven; lifecycle automation should reduce directory residue, not replace the existing active-milestone contract.
- **D-05:** Integrate lifecycle sync with `report:planning:milestones` so milestone bootstrap/closeout generation becomes the default moment when archive and restore actions happen.
  </decisions>

<specifics>
## Specific Ideas

- Phase 33 already proved that active discovery should ignore stale phase directories, but the directories themselves still remain in `.planning/phases/` and can confuse lower-level scans.
- Phase 38 already generates milestone bootstrap and closeout support artifacts, making it the right place to attach lifecycle sync instead of adding a separate manual step.
- The current repository still has shipped phase directories for `v1.0`, `v1.1`, and `v1.2` in the active path, while `v1.3` is the only milestone that should remain discoverable there.
- Archived milestone evidence already references `.planning/phases/...` paths, so archive automation must preserve or rewrite those references instead of breaking historical traceability.
  </specifics>

<canonical_refs>

## Canonical References

- `.planning/PROJECT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/MILESTONES.md`
- `.planning/milestones/v1.0-ROADMAP.md`
- `.planning/milestones/v1.1-ROADMAP.md`
- `.planning/milestones/v1.2-ROADMAP.md`
- `.planning/milestones/v1.2-CLOSEOUT.md`
- `.planning/traceability/latest-milestone-traceability.json`
- `.planning/milestones/v1.1-phases/33-planning-traceability-and-phase-hygiene/33-01-SUMMARY.md`
- `.planning/milestones/v1.2-phases/38-planning-bootstrap-and-closeout-automation/38-01-SUMMARY.md`
- `scripts/lib/planning-traceability.ts`
- `scripts/lib/planning-milestone-support.ts`
- `scripts/planning-milestone-support-report.ts`
  </canonical_refs>

---

_Phase: 42-phase-archive-lifecycle-automation_
_Context gathered: 2026-04-07_
