# SEO Monitoring Indexability Prerequisite Design

## Context

The daily `SEO And Operator Monitoring` workflow fails during `Build Content Governance Report` on a fresh checkout. The route-contract suite imports `src/pages/sitemap-skills.xml.ts`, whose build-time loader requires `reports/seo/latest-skill-indexability.json`. That generated report is not committed to the repository, so the workflow exits before production SEO smoke checks, GSC reporting, URL inspection, and sitemap crawl health can run.

The main CI workflow already establishes the correct dependency order by running `npm run report:seo:skill-indexability` before tests and content governance. The monitoring workflow does not.

## Evidence

- GitHub Actions run `30145660840` failed in `Build Content Governance Report` with `ERR_MODULE_NOT_FOUND` for `reports/seo/latest-skill-indexability.json`.
- The failure skipped `Run Production SEO Smoke`, `Fetch GSC Report`, `Run URL Inspection Coverage Sweep`, and `Run Sitemap Crawl Health Audit`.
- A clean worktree at `origin/main` reproduced the same condition: 149 test files passed and one failed; the only failure was the missing indexability report in `tests/pages/public-links.test.ts`.
- The daily Data Pipeline and Cache Warmup workflows remain healthy and are outside this change.

## Decision

Add an explicit `Generate SEO Indexability Report` step to `.github/workflows/seo-monitoring.yml` before `Build Content Governance Report`, using the existing `npm run report:seo:skill-indexability` command and the same naming/order used by `.github/workflows/ci.yml`.

Add a workflow contract test that verifies the monitoring workflow generates the report before content governance. This prevents a future edit from restoring the fresh-checkout failure.

## Alternatives Considered

### Gracefully degrade when the report is missing

Rejected because it would weaken the route and sitemap governance contract. A missing prerequisite should be generated, not hidden.

### Commit the generated report

Rejected because the report changes with the skill catalog and would create stale generated-state churn in source control.

### Generate the report inside content governance

Rejected because it hides an external prerequisite inside a reporting command and diverges from the explicit CI pipeline pattern.

## Data Flow

1. Checkout and install dependencies.
2. Run AI guardrails and provider health probes as today.
3. Generate `reports/seo/latest-skill-indexability.json` and its Markdown companion from the current catalog and locale governance data.
4. Run content governance and its route-contract tests against that report.
5. Continue to operator summary, production SEO smoke, GSC collection, URL inspection, and sitemap crawl health.
6. Upload the generated monitoring artifacts as today.

## Failure Handling

- If indexability report generation fails, the workflow should stop before content governance because downstream sitemap assertions would be untrustworthy.
- If content governance fails after report generation, the existing blocking behavior remains unchanged.
- No fallback report, committed snapshot, or `continue-on-error` behavior will be added.

## Verification

1. Confirm the clean baseline fails when content governance runs without the generated report.
2. Run `npm run report:seo:skill-indexability` and verify the report files are created.
3. Run the route-contract/content-governance command and verify it passes the missing-report boundary.
4. Run the workflow contract test and the full unit test suite.
5. Run formatting checks for the changed workflow and test file.
6. Push the branch, open a focused PR, and allow CI to validate the complete change.
7. After merge, manually dispatch `SEO And Operator Monitoring` and verify the production SEO smoke, GSC, and sitemap crawl steps execute instead of being skipped.

## Scope

This change does not alter the Data Pipeline, Cache Warmup, Auto Translate, Lighthouse assertions, production rendering, sitemap contents, indexability policy, or GSC submission behavior.
