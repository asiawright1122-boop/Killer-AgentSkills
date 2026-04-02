# Codebase Concerns

**Analysis Date:** 2026-04-02

## Tech Debt

**Large multi-responsibility modules:**
- Issue: Several core files combine many concerns and are difficult to change safely.
- Evidence: `scripts/build-skills-cache.ts` (~1840 lines), `src/pages/[locale]/skills/[owner]/[...repo].astro` (~1152 lines), `src/lib/kv.ts` (~839 lines).
- Impact: Higher regression risk and slower onboarding for contributors touching those areas.
- Fix approach: Incremental extraction by responsibility (query layer, SEO composition, transform utilities) with characterization tests.

**Fallback-heavy data layer:**
- Issue: Production and local fallback logic are tightly coupled in the same module (`src/lib/kv.ts`).
- Impact: Runtime failures can be masked, and correctness/debugging become harder.
- Fix approach: Split storage adapters (D1, KV, local) and make fallback policy explicit at call sites.

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

## Performance Bottlenecks

**Full-table payload reads from D1:**
- Problem: `getSkillsFromKV` fetches full JSON blobs for all skills.
- Evidence: Explicit warning comment in `src/lib/kv.ts` about large payload size (~56MB scale).
- Impact: Potential CPU/time pressure in edge runtime for endpoints using full payload path.
- Improvement path: Prefer listing/query-specific projections (`getSkillsListing`) and paginated detail hydration.

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
- Test coverage: Endpoint has tests around sibling routes, but multi-provider branch parity needs focused regression cases.

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

**Workers package test gap:**
- What is not tested: Worker/workflow files in `workers/*.ts` do not have visible automated tests in this repo.
- Risk: Runtime regressions may only surface in deployed workflows.
- Priority: High.
- Difficulty to test: Requires Cloudflare runtime mocking or integration test harness.

**Cross-source consistency tests:**
- What is not tested: Deterministic equivalence across D1, KV, and local fallback code paths.
- Risk: Silent data drift between local/dev/prod behavior.
- Priority: Medium.
- Difficulty to test: Needs fixture matrices and controlled fallback simulation.

---

*Concerns audit: 2026-04-02*
*Update as risks are mitigated or newly discovered*
