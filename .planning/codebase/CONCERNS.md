# Codebase Concerns

**Analysis Date:** 2026-06-09

## Tech Debt

**Large multi-responsibility modules:**

- Issue: Several core files combine many concerns and are difficult to change safely.
- Evidence: `scripts/build-skills-cache.ts` (~2162 lines), `src/pages/[locale]/skills/[owner]/[...repo].astro` (~1484 lines), `src/lib/kv.ts` (~1260 lines), `src/middleware.ts` (~1061 lines).
- Impact: Higher regression risk and slower onboarding for contributors touching those areas.
- Fix approach: Incremental extraction by responsibility (query layer, SEO composition, transform utilities) with characterization tests.

**Fallback-heavy data layer:**

- Issue: Production and local fallback logic are tightly coupled in the same module (`src/lib/kv.ts`).
- Impact: Runtime failures can be masked, and correctness/debugging become harder.
- Fix approach: Split storage adapters (D1, KV, local) and make fallback policy explicit at call sites.

**Public projection bypass risk:**

- Issue: Low-level D1/KV listing helpers are exported and easy to call directly from pages.
- Impact: A future performance change can accidentally bypass public filtering/sanitization and expose hidden reasoning or source-only fields.
- Current mitigation: Public routes should use wrappers in `src/lib/skills.ts`; `src/lib/skills.public-listing.test.ts` and `tests/pages/public-links.test.ts` now guard referenced-listing paths.
- Fix approach: Continue narrowing direct page imports from `src/lib/kv.ts` and make storage helpers internal behind public/domain projections where practical.

## Known Bugs or Instability Risks

**Conditional E2E pass behavior:**

- Symptoms: Some E2E tests skip meaningful assertions when no skills are loaded.
- Trigger: Local environment missing synced data.
- Evidence: Conditional branch in `tests/e2e/home.spec.ts`.
- Workaround: Ensure test fixture dataset is preloaded before E2E.
- Root cause: Tests rely on non-deterministic runtime data availability.

**Cross-source data drift risk:**

- Symptoms: Listing/detail/search outputs may diverge depending on D1/KV/local fallback source.
- Trigger: Partial sync or stale `data/*.json` artifacts.
- Evidence: Multi-source reads in `src/lib/kv.ts` and sync scripts (`scripts/sync-to-kv.ts`, `scripts/sync-d1-delta.ts`).
- Workaround: Run full pipeline and verify `report:seo:crawl-health` and smoke checks.
- Status: Still open. Listing-specific helpers reduce payload size, but deterministic parity across D1, KV, and local fallback remains under-tested.

## Security Considerations

**Admin auth is static Basic Auth:**

- Risk: Long-lived credentials (`ADMIN_USER`/`ADMIN_PASSWORD`) are sensitive and lack fine-grained auditing/rotation semantics in code.
- Current mitigation: Fail-closed behavior in `src/middleware.ts` when credentials are missing.
- Recommendations: Add rate-limiting + audit logging for admin routes and consider short-lived token/session mechanism.

**High volume secret-bearing integrations:**

- Risk: Many scripts/workflows require third-party secrets; operational mistakes can break pipelines or leak via logging.
- Evidence: Env usage across `scripts/lib/ai.ts`, `.github/workflows/*.yml`, `workers/*.ts`.
- Current mitigation: Secret names are referenced, not hardcoded values.
- Recommendations: Add centralized secret validation preflight and stricter CI redaction checks.

**Public AI output boundary:**

- Principle: Internal reasoning, chain-of-thought, scratchpad notes, private analysis, raw provider traces, and raw caught exception text must never be rendered to public pages, API payloads, streams, cache projections, D1 seeds, or browser-visible terminals/modals.
- Current mitigation: `src/lib/public-ai-output.ts`, `src/lib/public-skill-api.ts`, `src/lib/public-skill-copy.ts`, script guards, client error-surface tests, public cache/D1 seed guards, and `validate:public-surface`.
- Remaining risk: New public surfaces can still be created outside these helpers unless source-level guard coverage is expanded with each route family.

## Performance Bottlenecks

**Full-table payload reads from D1:**

- Problem: `getSkillsFromKV` fetches full JSON blobs for all skills.
- Evidence: Explicit warning comment in `src/lib/kv.ts` about large payload size (~56MB scale).
- Impact: Potential CPU/time pressure in edge runtime for endpoints using full payload path.
- Improvement path: Prefer listing/query-specific public projections (`getLightweightSkills*`) and paginated detail hydration.
- Status: Partially mitigated for listings, solution pages, collection pages, and repo-directory fallbacks; still risky wherever full records are needed.

**Heavy SEO and data automation in CI:**

- Problem: Build pipeline starts dev server and runs SEO smoke checks inline, plus separate scheduled SEO/report jobs.
- Evidence: `.github/workflows/ci.yml`, `.github/workflows/seo-monitoring.yml`.
- Impact: Longer pipeline time and higher flake surface when network/provider conditions are unstable.
- Improvement path: Increase deterministic fixtures for smoke checks and isolate external calls in retry-aware jobs.

## Fragile Areas

**Search stack with multiple execution paths:**

- Why fragile: Semantic search, FTS search, and Fuse fallback are combined in one endpoint (`src/pages/api/search.ts`).
- Common failures: Partial provider outage causes ranking variability.
- Safe modification: Keep contract tests for each branch (AI+Vectorize, DB-only, fallback-only).
- Test coverage: API tests cover sanitization, locale governance, and fallback behavior; multi-provider ranking parity still needs focused regression cases.

**Middleware with many SEO and routing guards:**

- Why fragile: Redirects, auth, security headers, crawl traps, and cache policies are all in `src/middleware.ts`.
- Common failures: Small rule changes can alter crawl/index behavior.
- Safe modification: Add targeted tests for redirect/noindex/cache semantics before editing guard logic.
- Test coverage: Property tests exist, but route-specific matrix coverage can still be expanded.

## Scaling Limits

**Pipeline scaling and external rate limits:**

- Current capacity: Pipelines depend on third-party API quotas and scheduled GitHub Actions windows.
- Limit: GitHub/API provider limits can throttle harvest/enrichment runs.
- Symptoms at limit: retries, skipped batches, delayed data freshness.
- Scaling path: queue-based chunking with resumable checkpoints and provider health-gated execution.

## Dependencies at Risk

**Cloudflare platform coupling:**

- Risk: Core runtime behavior assumes Cloudflare bindings (`DB`, `KV`, `VECTORIZE`, `AI`).
- Impact: Porting to a different host requires deep adapter work.
- Migration plan: Continue isolating platform-specific access in `src/lib/kv.ts` and route adapters.

**Multi-provider AI dependency chain:**

- Risk: NVIDIA/SiliconFlow/OpenRouter API behavior changes can break enrichment/translation quality or cost profile.
- Impact: Content freshness and localization workflows degrade.
- Migration plan: Keep provider abstraction in `scripts/lib/ai.ts` and expand health checks (`scripts/health-skill-providers.mjs`).

## Test Coverage Gaps

**Worker workflow integration gap:**

- What is not tested: `workers/lib/ai-runtime.test.ts` covers runtime helper behavior, but full workflow files in `workers/*.ts` still have light integration coverage.
- Risk: Runtime regressions may only surface in deployed workflows.
- Priority: Medium.
- Difficulty to test: Requires Cloudflare runtime mocking or integration test harness.

**Cross-source consistency tests:**

- What is not tested: Deterministic equivalence across D1, KV, and local fallback code paths.
- Risk: Silent data drift between local/dev/prod behavior.
- Priority: Medium.
- Difficulty to test: Needs fixture matrices and controlled fallback simulation.

## Recently Mitigated

- Public hidden-reasoning leaks now have shared sanitizers, route/API/client tests, cache guards, D1 seed guards, and built-asset scanning.
- Expected test stderr/stdout noise has been reduced by spying on deliberate fallback logs and by failing API tests on unexpected real-network fetches.
- Cloudflare `_headers` deployability and static/public route collisions now have regression tests.
- Astro Markdown highlighting moved to Prism to avoid Shiki CSP worker warnings in local/build output.

---

_Concerns audit: 2026-06-09_
_Update as risks are mitigated or newly discovered_
