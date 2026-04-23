---
phase: 60-public-copy-leakage-guardrails
requirements_completed:
  - GOV-14
---

# Phase 60 Summary

## Outcome

Phase 60 completed the prevention lane for the public copy-boundary issue.

The repository now has a reusable public trust-surface guardrail instead of a small set of representative-file assertions. Public pages, shared collection sources, shared authority-surface data, and shipped locale messages are now checked by scope against one centralized phrase-family rule set.

## What Changed

### Residual public wording was cleaned before locking the guardrail

Phase 60 found that a few public-facing leaks still survived outside the Phase `59` touch set:

- [index.astro](/Users/kaka/Dev/Killer-Skills-clean-main/src/pages/[locale]/solutions/index.astro)
- [docs page](/Users/kaka/Dev/Killer-Skills-clean-main/src/pages/[locale]/docs/[...slug].astro)
- shared locale catalogs under [messages](/Users/kaka/Dev/Killer-Skills-clean-main/src/messages)
- a remaining workflow collection source in [top-workflow-mcp-servers.json](/Users/kaka/Dev/Killer-Skills-clean-main/src/content/collections/top-workflow-mcp-servers.json)

These residual leaks were normalized so the new directory-level guardrail could pass on a clean public baseline.

### The public copy-boundary rule set is now centralized

Updated [public-links.test.ts](/Users/kaka/Dev/Killer-Skills-clean-main/tests/pages/public-links.test.ts) to define:

- one centralized phrase-family list for known internal/process leakage patterns
- one centralized scope list for guarded public trust surfaces
- one reusable file collector that scans guarded directories instead of relying on a narrow hand-picked file list

The new guardrail now covers:

- public page shells under `src/pages/[locale]/index.astro`, `collections/`, `solutions/`, `docs/`, and `skills/`
- shipped collection JSON under `src/content/collections/`
- shipped locale messages under `src/messages/`
- shared public helper data in [authority-surface-public-data.ts](/Users/kaka/Dev/Killer-Skills-clean-main/src/lib/authority-surface-public-data.ts)

## Why This Is Better Than Phase 59 Alone

Phase `59` proved the wording family could be removed.

Phase `60` makes that cleanup durable:

- new public files in guarded directories inherit the check automatically
- the phrase list lives in one place instead of being duplicated across assertions
- shared source files are protected alongside rendered page templates

## Residual Risk

The current guardrail is still phrase-family based, not semantic. That is an intentional tradeoff for low-noise, CI-friendly protection.

If future public/internal boundary issues appear in a different wording family, they should be added to the centralized rule set instead of creating one-off assertions again.
