# Typecheck Report

## Root Cause
`src/pages/sitemap-blog.xml.ts` used untyped callback parameters in two places:
- `getCollection('blog', ({ data }) => !data.draft)`
- `allPosts.some((post) => ...)`

With `strict` TypeScript settings, those callbacks inferred `any`, producing the branch blocker errors.

## Changed File
- `src/pages/sitemap-blog.xml.ts`

## Verification
- `git diff --stat` showed a single-file edit scoped to `src/pages/sitemap-blog.xml.ts`.
- `npm run typecheck` no longer reports the original sitemap errors, but it still fails on unrelated existing issues elsewhere in the repo:
  - `src/lib/kv.ts`
  - `src/pages/api/search.ts`
  - `src/pages/api/skills/search.ts`
  - several `tests/pages/api/*.test.ts` files

