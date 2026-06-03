---
phase: 65-p0-url-recovery-batches-and-canonical-proof
milestone: v1.9
plan: 65-01
requirements:
  - REC-27
  - REC-28
status: completed
created: 2026-05-29
files:
  - '.planning/phases/65-p0-url-recovery-batches-and-canonical-proof/65-CONTEXT.md'
  - '.planning/phases/65-p0-url-recovery-batches-and-canonical-proof/65-PLAN.md'
  - 'data/seo-404-rules.json'
  - 'src/middleware.ts'
  - 'src/middleware.property.test.ts'
  - 'scripts/seo-404-rules.ts'
---

# Phase 65 Plan 01: P0 URL Recovery Batches and Canonical Proof

## Objective

Execute the highest-priority GSC P0 URL recovery batches and mathematically prove that sitemap, canonical, redirect, and middleware signals are fully consistent.

## Tasks

1. Run the 404 remediation refresh pipeline to compile raw Coverage issues into clean local rules.
   - Expected output: `@/Users/kaka/Dev/Killer-Skills/data/seo-404-rules.json`.
2. Confirm edge middleware short-circuits gone URLs and handles redirect normalization.
   - Run the property-based unit tests for technical SEO middleware.
   - Expected output: 31 passing tests under `src/middleware.property.test.ts`.
3. Build and deploy the server updates to production Cloudflare Workers.
4. Verify crawl health against the production-grade live environment.
   - Expected output: 0 on-page SEO errors and 100% 2xx success rates on sitemap checking.

## Acceptance Criteria

- All ready P0 URL recovery classes are successfully mapped to `data/seo-404-rules.json`.
- Obsolete patterns cleanly short-circuit with a `410 Gone` and `noindex, nofollow` headers on the Edge.
- Unit tests cover trailing-slashes, repeated segments, source files, and 410 rules.
- Production crawl health returns 0 errors.

## Verification Commands

```bash
npm run report:seo:404-refresh
npx vitest run src/middleware.property.test.ts
npm run build
npx wrangler deploy --config dist/server/wrangler.json
npm run report:seo:crawl-health -- --sample-limit=20
npm run report:planning:traceability
```
