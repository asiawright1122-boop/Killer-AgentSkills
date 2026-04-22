# Plan 08-01 Summary: Edge Tutorial Shells Layout

**Phase:** 08-tutorial-shells
**Date:** 2026-04-06

## What was Changed
- Crafted the `src/components/TutorialShell.astro` layout with a sticky Table of Contents and shared long-form content chrome.
- Wired `TutorialShell` into `src/pages/[locale]/skills/[owner]/[...repo].astro` so the live skill detail surface now renders long-form content through the tutorial shell rather than leaving it as an unused component.
- Added `src/lib/markdown-headings.ts` to extract and slug markdown headings for TOC entries.
- Updated `src/islands/SkillReadme.tsx` to stamp matching heading anchors into rendered markdown, keeping the tutorial shell TOC linked to real content.
- Added `src/lib/markdown-headings.test.ts` to lock down heading extraction and deduplication behavior.

## Self-Check: PASS
- `npx vitest run src/lib/markdown-headings.test.ts`
  - Passed (`3` tests).
- `npm run check:astro`
  - Passed with `0` errors (`1` pre-existing hint only).
- `npm run build`
  - Passed after converting the tutorial-shell CSS from dormant `@apply` usage to build-safe native CSS.
