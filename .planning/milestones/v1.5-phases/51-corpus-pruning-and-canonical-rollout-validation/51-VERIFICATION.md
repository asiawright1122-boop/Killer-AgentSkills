---
phase: 51-corpus-pruning-and-canonical-rollout-validation
requirements_completed:
  - SEO-19
  - GOV-11
---

# Phase 51 Verification

## Verification Commands

### 1. Governance-support tests

```bash
npx vitest run src/lib/sitemap-blocklist.test.ts scripts/lib/content-governance.test.ts
```

Result:

- Passed
- `7` tests passed across `2` files

### 2. Direct corpus-governance execution

```bash
npx tsx scripts/seo-corpus-governance.ts
```

Result:

- Passed
- Verified the governance script can run cleanly on the already-governed corpus
- Idempotent rerun snapshot:
  - routes before: `1099`
  - routes after: `1099`
  - keep: `1099`
  - noindex: `0`
  - consolidate: `9891`
  - remove: `0`

### 3. Source rebuild hook validation

```bash
node scripts/regenerate-sitemap.js
```

Result:

- Passed
- Confirmed the rebuild pipeline now regenerates a raw sitemap candidate set and then automatically re-applies governed corpus pruning
- Final rollout snapshot after the rebuild hook:
  - routes before: `2950`
  - routes after: `1099`
  - keep: `1099`
  - noindex: `1604`
  - consolidate: `25487`
  - remove: `1310`
- Generated / refreshed:
  - [data/sitemap-skills.json](/Users/kaka/Dev/Killer-Skills/data/sitemap-skills.json)
  - [latest-corpus-governance.json](/Users/kaka/Dev/Killer-Skills/reports/seo/latest-corpus-governance.json)
  - [latest-corpus-governance.md](/Users/kaka/Dev/Killer-Skills/reports/seo/latest-corpus-governance.md)
  - [latest-corpus-governance-diff.json](/Users/kaka/Dev/Killer-Skills/reports/seo/latest-corpus-governance-diff.json)

### 4. Roadmap structure validation

```bash
node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze
```

Result:

- Passed
- Phase `51` is recognized on disk with context and plan artifacts present
- Summary count was still pending before this verification file was written; these Phase 51 artifacts now close that gap

## Notes

- `scripts/build-skills-cache.ts` and `scripts/regenerate-sitemap.js` now both re-run governed corpus publication after rebuilding sitemap inputs, which closes the primary rollback risk identified at the end of Phase 51 planning.
- `npm run check:astro` still has the same pre-existing unrelated repository errors noted in Phase 50 and was not part of this phase gate.
