# SEO Coverage Drilldown Runbook

- Date: 2026-04-16
- Scope: `killer-skills.com` Coverage Drilldown raw export handling, ingest, safe report routing, and GSC removal guardrails

## Why this exists

Coverage Drilldown exports now drive several different SEO workflows, but they are not interchangeable:

- `服务器错误 (5xx)` exports are for diagnosis and cluster proof.
- `未找到 (404)` exports are for remediation planning and GSC removals.

Using the wrong export for the wrong script can produce unsafe conclusions.

## Repo-local ingest lane

Raw exports are now archived under:

- [data/coverage-drilldown-raw](/Users/kaka/Dev/Killer-Skills/data/coverage-drilldown-raw)

Use:

```bash
npm run ingest:seo:coverage-drilldown
```

This will:

1. Scan `~/Downloads` for `killer-skills.com-Coverage-Drilldown-*` directories and `.zip` files.
2. Detect `metadata/chart/table` CSV roles by file content, not filename.
3. Copy each valid source into the repo-local archive with canonical filenames:
   - `metadata.csv`
   - `chart.csv`
   - `table.csv`
4. Write audit artifacts:
   - [latest-coverage-drilldown-ingest.md](/Users/kaka/Dev/Killer-Skills/reports/seo/latest-coverage-drilldown-ingest.md)
   - [latest-coverage-drilldown-ingest.json](/Users/kaka/Dev/Killer-Skills/reports/seo/latest-coverage-drilldown-ingest.json)

## Export types and safe script mapping

### A. `服务器错误 (5xx)`

Use this export for:

- cluster diagnosis
- freshness proof
- recovery scorecard inputs

Safe commands:

```bash
npm run report:seo:coverage-drilldown
```

Do not use a `5xx` export for:

- GSC URL removals
- 404 remediation planning

Reason:

- A `5xx` sample can include URLs that are still valid canonical pages after runtime fixes.
- Removing those URLs from Google Search Console can suppress recoverable demand.

### B. `未找到 (404)`

Use this export for:

- 404 remediation planning
- GSC URL removals
- generating explicit `301 / 410 / manual_review` decisions

Safe commands:

```bash
npm run report:seo:404-plan
npm run report:gsc:removal-list
```

## How to export the right Coverage Drilldown in GSC

In Google Search Console:

1. Open the property for `killer-skills.com`.
2. Go to `索引 > 页面`.
3. Open the exact issue bucket you need:
   - `未找到 (404)` for removal/remediation work
   - `服务器错误 (5xx)` for cluster freshness and runtime diagnosis
4. Open `Coverage Drilldown`.
5. Export the drilldown as CSV/ZIP.
6. Leave the downloaded file or folder in `~/Downloads`.
7. Run the ingest/report command in this repo.

## Guardrails

### `npm run report:seo:coverage-drilldown`

- auto-ingests first
- reads repo-local archive first
- safe with `5xx`, `404`, redirect, duplicate, and other issue types

### `npm run report:seo:404-plan`

- only runs when a Coverage Drilldown source whose issue name includes `未找到` is available
- otherwise exits with a clear message listing the currently available source issue names

### `npm run report:gsc:removal-list`

- only generates removal lists when a Coverage Drilldown source whose issue name includes `未找到 (404)` is available
- otherwise it writes a readiness artifact instead of generating unsafe removal files:
  - [latest-gsc-removal-readiness.md](/Users/kaka/Dev/Killer-Skills/reports/seo/latest-gsc-removal-readiness.md)
  - [latest-gsc-removal-readiness.json](/Users/kaka/Dev/Killer-Skills/reports/seo/latest-gsc-removal-readiness.json)

## Decision table

| Goal | Required export | Command |
| --- | --- | --- |
| Refresh cluster proof | `服务器错误 (5xx)` or latest available issue bucket | `npm run report:seo:coverage-drilldown` |
| Build 404 remediation actions | `未找到 (404)` | `npm run report:seo:404-plan` |
| Generate GSC removals | `未找到 (404)` | `npm run report:gsc:removal-list` |
| Audit ingest freshness | any valid export | `npm run ingest:seo:coverage-drilldown` |

## Current known state

As of 2026-04-16:

- the freshest repo-local raw source is still dated `2026-04-03`
- the available archived issue is `服务器错误 (5xx)`
- there is no fresh `未找到 (404)` Coverage Drilldown source in the repo-local archive

That means:

- cluster proof works, but freshness is still blocking
- 404 remediation and GSC removals should wait for a dedicated `404` export
