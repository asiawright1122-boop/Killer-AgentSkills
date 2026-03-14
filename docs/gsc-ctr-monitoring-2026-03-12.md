# GSC CTR Monitoring (2026-03-12)

## Goal

Track whether recent SEO changes are improving click-through rate instead of only lifting impressions.

## Script

- Command: `npm run report:gsc -- --queries path/to/queries.csv --pages path/to/pages.csv`
- Unattended fetch command: `npm run report:gsc:fetch`
- Optional:
  - `--queries-prev path/to/previous-queries.csv`
  - `--pages-prev path/to/previous-pages.csv`
  - `--output reports/gsc/my-report.md`
  - `--limit 20`

## Inputs

- `queries.csv`: export from Google Search Console "Search results" > Queries
- `pages.csv`: export from Google Search Console "Search results" > Pages
- The parser supports common English and Chinese CSV headers.

## Output

- Markdown report under `reports/gsc/`
- Sections:
  - query precision risks (off-topic / weak-intent / ambiguous-intent)
  - query opportunities
  - page opportunities
  - period comparison for queries/pages when previous exports are supplied
  - quick wins
  - suggested actions based on query/page intent

## Unattended Workflow

- Workflow: `.github/workflows/seo-monitoring.yml`
- Schedule: every Monday at `10:15` Asia/Shanghai (`02:15 UTC`)
- Trigger modes:
  - scheduled
  - manual `workflow_dispatch`
- Required repository secrets:
  - `GSC_CLIENT_EMAIL`
  - `GSC_PRIVATE_KEY`
  - `GSC_SITE_URL`
- Recommended `GSC_SITE_URL` values:
  - `sc-domain:killer-skills.com`
  - or the exact verified property URL in Search Console
- The service account behind `GSC_CLIENT_EMAIL` must be added to the Search Console property with access, otherwise the API request will fail.
- Quick setup helper:
  - `npm run setup:gsc:secrets -- --client-email <service-account-email> --private-key-file </absolute/path/to/private-key.pem> --site-url <sc-domain:killer-skills.com>`
  - then run: `gh workflow run "SEO Monitoring"`
- Output produced by the unattended job:
  - `reports/gsc/latest-ctr-report.md`
  - dated query/page CSV snapshots under `reports/gsc/snapshots/`
  - uploaded GitHub Actions artifact `gsc-monitoring-report`

## What To Watch

1. Queries with position `<= 10`, high impressions, and CTR below expected baseline
2. Pages with strong impressions but weak CTR on skill detail URLs
3. Category or collection hubs with impressions but unclear snippet value proposition

## Baseline Heuristics

- Position `1-3`: expected CTR about `8%`
- Position `4-5`: expected CTR about `4.5%`
- Position `6-10`: expected CTR about `2.5%`
- Position `11-20`: expected CTR about `1.2%`

## Recommended Review Cadence

1. Export query + page reports every 7 days
2. Keep the previous export and pass it via `--queries-prev` / `--pages-prev`
3. Prioritize pages with both:
   - impressions `>= 50`
   - ranking on page 1 or page 2
4. Ignore low-impression noise unless the query is strategically important

## Suggested Workflow

1. Export the latest GSC query and page CSVs
2. Run:
   - `npm run report:gsc -- --queries latest-queries.csv --pages latest-pages.csv --queries-prev previous-queries.csv --pages-prev previous-pages.csv`
3. Read the comparison sections first:
   - `improved`: CTR/clicks moved in the right direction
   - `declined`: impressions may be rising faster than CTR
   - `mixed`: some metrics improved while others weakened
   - `new`: newly visible query/page with no baseline yet

## Interpretation

- If impressions rise but CTR falls on detail pages:
  - snippet intent is too broad
  - title/description likely need tighter category or editor-language alignment
- If position improves from `11-20` to `4-10` with flat CTR:
  - ranking improved first
  - run another title/meta pass for the now-visible URLs
- If query pages continue to appear:
  - verify `noindex` is reflected in live responses and gradually drops from GSC
