---
phase: 43-production-sitemap-and-dynamic-404-closure
requirements_completed:
  - SEO-11
  - SEO-12
---

# Phase 43 Plan 01 Summary

**Phase:** `43 production-sitemap-and-dynamic-404-closure`  
**Plan:** `43-01`  
**Completed:** 2026-04-09

## Outcome

Phase `43` is complete.

The production sitemap and public-skill visibility contract are now aligned again, and the main domain crawl sample returned to a clean technical state:

- `2xx=1650`
- `4xx=0`
- `5xx=0`
- `Cloudflare 1102=0`

## What Changed

1. Corrected non-target classification so multilingual description objects no longer get flattened into one string during public-skill checks.
2. Removed the false-positive `career-prep` suppression caused by the French boilerplate `Resume localise : ...`.
3. Regenerated `data/sitemap-skills.json` from `1254` entries back to `3273` valid public entries.
4. Preserved exclusion of truly non-public routes, including:
   - `marswangyang/roger/resume-latex-pdf-generator`
   - `cdeistopened/skill-stack/voice-matching-wizard`
5. Added route support for README-root skills so `.../README.md` records map back to repo root sitemap paths.
6. Refreshed the D1-aware sitemap blocklist to match the restored sitemap baseline.

## Root Cause

The reduction to `1254` sitemap entries was not a legitimate public-skill contraction.

The underlying fault was that `getNonTargetSkillReason()` and related sitemap filters were evaluating all localized description strings at once. The French localization prefix `Resume localise :` matched the `resume` keyword and incorrectly classified large numbers of valid AI skills as `career-prep`.

## Evidence

- Local regression tests:
  - `npx vitest run src/lib/shared/validation.test.ts src/lib/kv.test.ts`
- Local smoke:
  - `npm run seo:smoke -- http://127.0.0.1:4321 --spawn-dev`
- Production deployment:
  - `https://42a1f12d.killer-skills-3vi.pages.dev`
- Production smoke:
  - `SEO_SMOKE_CACHE_BUST=1 SEO_SMOKE_SITEMAP_ONLY=1 npm run seo:smoke -- https://killer-skills.com`
- Production crawl health:
  - `npm run report:seo:crawl-health -- https://killer-skills.com`

## Deliverables

- Updated classification/runtime code:
  - `src/lib/shared/validation.ts`
  - `src/lib/skills.ts`
  - `src/lib/kv.ts`
  - `scripts/build-skills-cache.ts`
  - `src/lib/skill-route-paths.ts`
  - `scripts/regenerate-sitemap.js`
- Updated evidence/data:
  - `data/sitemap-skills.json`
  - `data/seo-sitemap-blocklist.json`
  - `reports/seo/latest-crawl-health.md`
  - `reports/seo/latest-crawl-health.json`
  - `reports/seo/latest-traffic-recovery-audit.md`
- Added regression coverage:
  - `src/lib/shared/validation.test.ts`
  - `src/lib/kv.test.ts`
