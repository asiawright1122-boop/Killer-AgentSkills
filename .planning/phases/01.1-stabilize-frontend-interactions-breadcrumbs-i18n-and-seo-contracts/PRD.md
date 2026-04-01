# Phase 01.1 PRD: Frontend Stabilization, i18n Cleanup, and SEO Contract Unification

**Created:** 2026-03-30
**Status:** Ready for GSD planning
**Source:** Repo audit + live-site verification + user report

## Objective

Stabilize the public frontend so navigation and core CTAs are reliably clickable, eliminate mixed-language and leaked translation-key output, and unify breadcrumb/i18n/SEO generation around shared contracts that are testable and deployable.

## Problem Statement

The current site has urgent user-visible breakage:

1. Public pages are reported as "almost unclickable", especially in frontend card/listing flows and mobile navigation behavior.
2. Breadcrumb UI, breadcrumb structured data, canonical logic, hreflang logic, and visible navigation labels are assembled independently across pages.
3. Translation fallback behavior is structurally wrong: `t()` returns the key string for missing translations, but many call sites use `t('...') || 'fallback'`, so missing keys leak directly into the UI and metadata.
4. Locale definitions are duplicated across runtime app code, scripts, and worker code, which creates drift in generated content and SEO artifacts.
5. Local development is currently not a stable source of truth because `npm run dev` fails with Astro/Cloudflare adapter incompatibility.
6. Deployment and generated-content drift already exist: live pages do not fully match the current repository state, and SEO reports show sitemap/indexable divergence.

## Scope

This phase covers:

- Frontend interaction reliability on public pages
- Shared navigation/breadcrumb contract
- Public i18n contract and fallback behavior
- Shared SEO/canonical/hreflang/breadcrumb generation contract
- Locale source-of-truth cleanup across app/scripts/workers
- Dev/build/test baseline restoration for this area
- Regression tests and smoke checks for the above

## Out of Scope

- Full SEO pipeline reenrichment for all skills
- New traffic-growth initiatives
- Content strategy changes beyond fixing incorrect or leaked public copy
- Large visual redesign unrelated to stability or consistency

## Locked Decisions

### Product/UX
- User-facing breakages are prioritized ahead of downstream SEO pipeline work.
- Desktop and mobile public pages must both be treated as first-class verification targets.
- Shared primitives should replace repeated ad hoc implementations where possible, especially for cards, breadcrumbs, and metadata builders.

### Frontend Reliability
- Closed overlays, loaders, and decorative layers must not intercept pointer events.
- Card click behavior must use a single consistent model; avoid page-specific stretched-link and z-index hacks.
- Interaction regressions must be covered by click-through E2E tests, not only DOM-presence assertions.

### i18n
- Missing translations must never surface raw keys on public pages.
- App runtime, generation scripts, and workers must consume one locale definition contract.
- Public pages must prefer shared helpers over page-local ad hoc fallback logic.

### SEO / Navigation Contract
- Breadcrumb UI, breadcrumb JSON-LD, canonical URL, hreflang, page title, and meta description should be generated from shared helpers/builders.
- Pages must not independently invent cross-locale SEO behavior that disagrees with layout-level metadata logic.
- Public metadata and visible language should remain aligned for the served locale.

### Deployment / Verification
- `npm run dev` and the relevant build/test workflows must be restored before declaring the phase complete.
- Verification must include both repository-level tests and live or smoke-level checks to detect deploy drift.

## Acceptance Criteria

1. Local baseline restored:
- `npm run dev` starts successfully.
- The project can run the relevant checks for pages touched in this phase.

2. Interaction stability restored:
- Core public navigation and listing/detail page links are clickable on desktop and mobile.
- No invisible overlay remains active when mobile menu or route loaders are idle.
- Collection and skill cards behave consistently.

3. i18n leakage eliminated:
- No public page renders raw translation keys such as `Home.seoIntro`, `Footer.subscribeBtn`, `Collections.collections`, or similar.
- Missing translations fail tests or are safely handled through explicit fallback helpers.

4. Breadcrumb and metadata consistency:
- Breadcrumb UI and breadcrumb JSON-LD come from the same source model.
- Canonical and hreflang generation are consistent across page types.
- Visible labels, metadata language, and served locale no longer mix unexpectedly on target pages.

5. Locale contract unified:
- `src`, `scripts`, and `workers` no longer maintain conflicting locale lists or semantics.
- Generation logic and runtime logic agree on supported locales and default locale behavior.

6. Regression coverage added:
- E2E tests validate real click navigation for critical pages.
- Tests or guards detect missing i18n keys used by public pages.
- Tests or guards detect SEO/breadcrumb contract drift for touched page types.

7. Deploy confidence improved:
- A smoke or audit path exists to compare local/repo state against live public state for this surface area.

## Primary User Journeys To Verify

- Home page -> header nav -> skills / collections / blog / docs
- Collections index -> collection detail
- Skills index -> skill detail
- Locale switch on desktop and mobile
- Mobile menu open/close -> subsequent page interaction
- Public pages in `en` and `zh` with no mixed key leakage

## Known Evidence / Audit Inputs

- Public layout metadata and router shell: `src/layouts/Layout.astro`
- Global i18n contract: `src/i18n.ts`
- Mobile overlay and header actions: `src/islands/HeaderActions.tsx`
- Skill card interaction model: `src/components/SkillCard.astro`
- Collections index card interaction model: `src/pages/[locale]/collections/index.astro`
- Breadcrumb component: `src/components/Breadcrumb.astro`
- Collections detail breadcrumb usage: `src/pages/[locale]/collections/[...slug].astro`
- Footer i18n fallback leak point: `src/components/Footer.astro`
- Script locale divergence: `scripts/lib/constants.ts`
- E2E navigation gap: `tests/e2e/navigation.spec.ts`
- SEO drift artifact: `reports/seo/index-drift.json`

## Canonical References

- `.planning/ROADMAP.md` — roadmap ordering and inserted phase placement
- `.planning/STATE.md` — project state and roadmap evolution
- `astro.config.mjs` — Astro i18n and adapter configuration
- `package.json` — local dev/build/test commands and version constraints
- `src/layouts/Layout.astro` — shared shell, metadata, and router hooks
- `src/i18n.ts` — locale and translation helper contract
- `src/islands/HeaderActions.tsx` — mobile overlay and locale switch behavior
- `src/components/SkillCard.astro` — card interaction primitive
- `src/components/Breadcrumb.astro` — breadcrumb UI contract
- `src/pages/[locale]/collections/index.astro` — collection card interaction regression point
- `src/pages/[locale]/collections/[...slug].astro` — breadcrumb and collection metadata usage
- `src/components/Footer.astro` — public i18n fallback leak point
- `scripts/lib/constants.ts` — script locale drift source
- `tests/e2e/navigation.spec.ts` — current E2E gap
- `reports/seo/index-drift.json` — SEO artifact drift evidence

## Suggested Plan Shape

- Plan 1: Restore local dev/build baseline and establish reproducible diagnostics
- Plan 2: Fix global interaction blockers and shared card click primitives
- Plan 3: Repair i18n contract and eliminate public key leakage
- Plan 4: Unify breadcrumb/SEO metadata builders and regression coverage
- Plan 5: Add smoke checks for repo/live drift on touched surfaces
