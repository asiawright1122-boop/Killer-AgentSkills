---
phase: 51-corpus-pruning-and-canonical-rollout-validation
requirements_completed:
  - SEO-19
  - GOV-11
---

# Phase 51 Summary

## Outcome

Phase 51 turned the locale and originality contracts into a real publication rollout.

The public skill corpus is no longer a passive dump of every route that happened to look indexable enough for an older sitemap heuristic. It is now an explicitly governed publish set with four clear outcomes for every localized skill URL:

- `keep`
- `noindex`
- `consolidate`
- `remove`

This phase also closed the source-of-truth gap that would have let future sitemap rebuilds reintroduce weak routes.

## Delivered

- Added governed corpus rollout script:
  - [scripts/seo-corpus-governance.ts](/Users/kaka/Dev/Killer-Skills/scripts/seo-corpus-governance.ts)
- Regenerated governed publication artifacts:
  - [data/sitemap-skills.json](/Users/kaka/Dev/Killer-Skills/data/sitemap-skills.json)
  - [reports/seo/latest-corpus-governance.json](/Users/kaka/Dev/Killer-Skills/reports/seo/latest-corpus-governance.json)
  - [reports/seo/latest-corpus-governance.md](/Users/kaka/Dev/Killer-Skills/reports/seo/latest-corpus-governance.md)
  - [reports/seo/latest-corpus-governance-diff.json](/Users/kaka/Dev/Killer-Skills/reports/seo/latest-corpus-governance-diff.json)
- Wired governed republishing into the source rebuild flows:
  - [scripts/build-skills-cache.ts](/Users/kaka/Dev/Killer-Skills/scripts/build-skills-cache.ts)
  - [scripts/regenerate-sitemap.js](/Users/kaka/Dev/Killer-Skills/scripts/regenerate-sitemap.js)
- Preserved runtime behavior that keeps repo-directory skill routes out of the indexable surface:
  - [src/pages/[locale]/skills/[owner]/[...repo].astro](/Users/kaka/Dev/Killer-Skills/src/pages/[locale]/skills/[owner]/[...repo].astro)

## Behavior Change

Before this phase:

- `data/sitemap-skills.json` could still advertise a much larger legacy corpus
- corpus pruning depended on running a one-off governance script after the fact
- future rebuilds could drift back toward weak repo-directory and reference-only surfaces

After this phase:

- the published skill sitemap data is the governed corpus, not the raw candidate corpus
- rebuild flows now automatically re-apply corpus governance after regenerating sitemap inputs
- the project has machine-readable keep / noindex / consolidate / remove outputs for the current corpus

## Current Rollout Snapshot

From [latest-corpus-governance.md](/Users/kaka/Dev/Killer-Skills/reports/seo/latest-corpus-governance.md):

- routes before governed publish set: `2950`
- routes after governed publish set: `1099`
- kept canonical URLs: `1099`
- `noindex` URLs: `1604`
- consolidated URLs: `25487`
- removed URLs: `1310`

This means the public skill sitemap is now advertising roughly `37%` of the prior route corpus, while the remainder is either consolidated to stronger canonicals, kept available but non-indexable, or removed from the published corpus entirely.

## Recovery Relevance

This phase changes the recovery posture in a way Google can actually see:

- the site stops volunteering weak or duplicative skill URLs as first-class discovery targets
- structural pruning becomes auditable instead of looking like accidental index loss
- future rebuilds are much less likely to undo the governance work from Phases 49 and 50

That gives Phase 52 a cleaner base to rebuild authority around curated surfaces instead of trying to recover demand on top of a noisy long-tail skill corpus.
