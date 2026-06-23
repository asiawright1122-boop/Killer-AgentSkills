---
wave: 1
depends_on: []
files_modified: []
autonomous: true
---

# Phase 139 Plan: System Integrity & Regression Check

This phase runs the full system verification pipeline (typecheck, public surface copy boundaries, Vitest test suites, and Astro production build) to guarantee zero regressions for Milestone v4.4 release.

## Tasks

### Task 1: Execute Workspace Typecheck

<read_first>
- [package.json](file:///Users/kaka/Dev/Killer-Skills/package.json)
</read_first>

<acceptance_criteria>
- `npm run typecheck` exits with 0.
</acceptance_criteria>

<action>
Run: `npm run typecheck`
</action>

---

### Task 2: Validate Public Copy Boundaries

<read_first>
- [package.json](file:///Users/kaka/Dev/Killer-Skills/package.json)
</read_first>

<acceptance_criteria>
- `npm run validate:public-surface` exits with 0 and reports no issues.
</acceptance_criteria>

<action>
Run: `npm run validate:public-surface`
</action>

---

### Task 3: Run All Test Suites

<read_first>
- [package.json](file:///Users/kaka/Dev/Killer-Skills/package.json)
</read_first>

<acceptance_criteria>
- `npm test` successfully completes with all passing tests (1030+ tests).
</acceptance_criteria>

<action>
Run: `npm test`
</action>

---

### Task 4: Execute Production Build

<read_first>
- [package.json](file:///Users/kaka/Dev/Killer-Skills/package.json)
</read_first>

<acceptance_criteria>
- `npm run build` successfully compiles the Astro app.
</acceptance_criteria>

<action>
Run: `npm run build`
</action>
