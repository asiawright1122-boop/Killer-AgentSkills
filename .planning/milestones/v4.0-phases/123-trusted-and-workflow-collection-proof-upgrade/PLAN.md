---
phase: 123
plan: 123-01
type: remediate
wave: 1
depends_on:
  - 122
files_modified:
  - src/pages/[locale]/collections/[...slug].astro
  - src/content/collections/top-official-mcp-servers.json
  - src/content/collections/top-workflow-mcp-servers.json
  - tests/pages/public-links.test.ts
  - .planning/phases/123-trusted-and-workflow-collection-proof-upgrade/123-01-SUMMARY.md
  - .planning/phases/123-trusted-and-workflow-collection-proof-upgrade/123-VERIFICATION.md
autonomous: true
must_haves:
  artifacts:
    - path: src/pages/[locale]/collections/[...slug].astro
      min_lines: 20
    - path: src/content/collections/top-official-mcp-servers.json
      min_lines: 20
    - path: src/content/collections/top-workflow-mcp-servers.json
      min_lines: 20
    - path: tests/pages/public-links.test.ts
      min_lines: 10
  key_links: []
---

# Phase 123 Plan - Trusted and Workflow Collection Proof Upgrade

## Objective

Strengthen the official/trusted and workflow collection pages with visible public selection notes, maintenance cues, concrete task-fit guidance, and setup paths before the imported repository layer.

## Requirement Traceability

- **AIOPS-44**: Strengthen `Official AI Skills & Trusted Tools` and `Agent Workflow Building Tools` with visible first-party proof, specific selection notes, and install handoffs.

## Tasks

1. Inspect the collection detail renderer and the two priority collection records.
2. Render public selection notes, trust signals, and maintenance notes above the skills grid.
3. Rewrite the two collection records around ownership, setup clarity, task role, and next setup action.
4. Add regression assertions for the new public proof layer and collection-specific copy.
5. Run collection parity, public copy, type, and public-surface validation.
