# Marketplace UI Baseline And Audit Design

Date: 2026-07-06

## Context

Killer-Skills has moved from the old route set into a marketplace IA: Home, Skills, Rankings, Occupations, Categories, Search, Review Policy, and Skill Detail. The next product risk is drift: future edits could reintroduce old headers, over-explain safety, hide install decisions, or treat official skills as a category instead of source evidence.

This design baseline turns the current UI into a reusable contract. `DESIGN.md` is the visual system. This spec defines the audit and next implementation boundaries.

## Approved Direction

Use a Review Desk model: classification first, evidence second, installation decision last. Users should enter through a route that matches their intent, compare a short set of facts, then land on a detail page that makes the install decision inspectable.

The approved routes are:

- Home: market entry, search, hot paths, sample lists.
- Skills: complete directory and filters.
- Rankings: Popular and Latest, with category filters.
- Occupations: job/task-led browsing.
- Categories: capability-led browsing.
- Search: explicit keyword and filter result page.
- Review Policy: public listing rules and safety metrics.
- Skill Detail: install decision, review evidence, tasks, limitations, source material, related skills.

Legacy routes may remain only as bridges back into this IA.

## Product Logic To Preserve

Popular sorting is `rankScore`, then `qualityScore`, then stars, then name.

Latest sorting is `updatedAt`, then Popular as tie-break.

Public marketplace listings exclude `securityLevel === "D"` and `isTrustedRankingEligible === false`.

Official/community is source evidence, not a top-level category. Official skills appear in Skills filtering and evidence chips.

Safety is a review policy and admission layer. It should tell users what Killer-Skills already checked, not instruct them with generic caution copy.

## Audit Checklist

Header:

- Desktop shows one nav set: Home, Skills, Rankings, Occupations, Categories.
- Mobile shows one drawer with the same route order.
- Old primary labels such as Topics, Hot, Explore, and Docs do not appear in the primary header.
- Mobile drawer is not clipped by sticky headers or transformed parents.

Route Identity:

- Every core route has a distinct H1 and first section title.
- Rankings uses Popular/Latest as modes, not separate duplicated page concepts.
- Occupations and Categories are browsing gateways, not duplicated directories.
- Review Policy exposes metrics and rules, not a tutorial page.

Listing Cards:

- Cards show name, owner, source kind, review state, up to three risk signals, description, stars/forks, and category.
- Cards do not carry long explanatory guidance.
- Hover-only install is treated as a desktop shortcut; mobile and detail pages must expose install decisions directly.

Skill Detail:

- The detail page starts with task fit and a sticky install decision panel on desktop.
- The install panel includes review status, trust rows, risk chips, install command, GitHub, review policy, and favorite/share actions.
- Fit/tasks, review/permissions, limitations, source material, and related skills are separate sections.
- Source material is labeled as supporting evidence, not the main value proposition.

Public Copy:

- No internal strategy, chain-of-thought, recovery, rollout, or implementation rationale copy.
- No vague trust claims without a rule, metric, source, or workflow.
- Chinese and English are first-class; long translated strings must not overflow.

Visual System:

- Use the tokens and rules in `DESIGN.md`.
- No gradient text, decorative AI gradients, repeated tiny section eyebrows, decorative grid backgrounds, fake trust badges, metric-heavy hero templates, or nested cards.
- Radius stays at 8px except chips and icon buttons.
- Letter spacing stays at 0.

## Implementation Boundaries

The next implementation slice should not redesign the whole site again. It should harden the current system by adding automated public-surface checks and improving the highest-impact route if audit evidence exposes a problem.

Recommended first slice:

1. Add tests that assert the primary nav route set and reject old primary header labels.
2. Add tests that assert marketplace approval filtering is used by public listing routes.
3. Add tests that assert detail pages expose install, review policy, risk/source evidence, and related navigation without relying on hover-only controls.
4. Browser-audit desktop and mobile for Home, Skills, Rankings, Occupations, Categories, Search, Review Policy, and one Skill Detail page.

## Verification Plan

Run:

- `git diff --check`
- `npx vitest run tests/pages/public-links.test.ts --reporter=verbose`
- targeted tests for marketplace filters, site IA, and skill detail view
- `npx tsc --noEmit --project tsconfig.json`
- `npm run check:astro`
- `npm run build`

Browser checks should capture:

- no horizontal overflow at 390px and 1280px
- exactly one primary header nav
- no internal reasoning or strategy copy
- route H1 and first H2 are distinct enough to identify the page
- mobile drawer opens fully and is not clipped

## Open Follow-Up

The local fallback listing path still takes multiple seconds in dev when D1 is missing. That is a performance/data slice, not a visual design slice, and should be planned separately after UI audit guardrails are in place.
