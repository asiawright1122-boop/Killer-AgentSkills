---
phase: 122
plan: 122-01
type: remediate
wave: 1
depends_on:
  - 121
files_modified:
  - src/pages/[locale]/index.astro
  - tests/pages/public-links.test.ts
  - .planning/phases/122-homepage-authority-reframe/122-01-SUMMARY.md
  - .planning/phases/122-homepage-authority-reframe/122-VERIFICATION.md
autonomous: true
must_haves:
  artifacts:
    - path: src/pages/[locale]/index.astro
      min_lines: 10
    - path: tests/pages/public-links.test.ts
      min_lines: 10
  key_links: []
---

# Phase 122 Plan - Homepage Authority Reframe

## Objective

Reframe the homepage authority block around user-facing selection evidence, curated paths, and setup decisions before installation, while keeping the full skills directory clearly supporting.

## Requirement Traceability

- **AIOPS-43**: Reframe the homepage authority block around user-facing selection criteria, curated entry paths, and trusted next steps.

## Tasks

1. Inspect the homepage authority block and supporting public-copy tests.
2. Replace generic quick-start copy with selection, setup, and task-fit guidance.
3. Keep official/trusted tools, installation docs, solution pages, and curated collections ahead of full directory browsing.
4. Add a regression assertion so the homepage does not drift back to broad directory-first positioning.
5. Run targeted public-copy and page tests, then record the verification evidence.
