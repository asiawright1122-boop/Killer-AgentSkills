---
status: passed
phase: 08-tutorial-shells
started: 2026-04-01
updated: 2026-04-06
---

## Phase Goal
Configure dynamic Astro Edge components combining the sticky Table of Contents and `TutorialShell` wrapper logic suitable for deep Markdown renderings outputted via AI harvesting streams.

## Verification Run
All must-have criteria verified successfully.

- ✓ The `TutorialShell` now mounts on the live skill detail surface in `src/pages/[locale]/skills/[owner]/[...repo].astro`.
- ✓ Sticky TOC items are generated from the actual markdown content and link to live heading anchors rendered by `src/islands/SkillReadme.tsx`.
- ✓ Focused regression coverage now exists for heading extraction and slug deduplication:
  - `npx vitest run src/lib/markdown-headings.test.ts`
- ✓ Astro diagnostics remain green after the live integration:
  - `npm run check:astro`
- ✓ Full Astro build now passes with the live tutorial shell imported on the skill detail surface:
  - `npm run build`

## Conclusion
Changes fully integrated and tests verified green under Astro Diagnostics. Phase architecture properly established for deployment.
