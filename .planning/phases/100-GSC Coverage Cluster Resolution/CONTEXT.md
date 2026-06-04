# Phase 100 — GSC Coverage Cluster Resolution

## What This Phase Does

Diagnose and resolve the dominant `other` cluster in the GSC Coverage Drilldown report (~13,003 estimated affected URLs), which blocks the recovery scorecard from clearing the Coverage attribution signal.

## Requirement

- **AIOPS-21**: Diagnose the `other` category GSC Coverage cluster affecting ~13,003 URLs, isolating invalid URLs and explaining or pruning the cluster.

## Current State

- **Recovery scorecard**: technicalRecoveryStatus=`clear`, businessRecoveryStatus=`warning`, overallStatus=`blocking`.
- **Coverage signal**: status=`warning` because `issueCount > 0` despite fresh source data.
- **Dominant cluster**: `other` with ~13,003 estimated affected URLs across 1,380 samples.
- **Issue scope**: The `other` cluster spans two GSC issue types: `未找到 (404)` (P0 索引损耗) and `服务器错误 (5xx)` (P0 可用性).
- **Sample URLs**: Standard-looking skill pages like `/ja/skills/owner/repo` that return 404/5xx — these are likely deleted repos, renamed repos, or skills no longer in the database.
- **Current classification**: The `classifyUrl` function in `seo-coverage-drilldown.ts` falls through to `other` when no pattern matches (no query params, no file extensions, no trailing slashes, no repeated segments, no sandbox path).

## Key Files

| File | Role |
|------|------|
| `scripts/seo-coverage-drilldown.ts` | Main drilldown report generator — `classifyUrl()` assigns clusters |
| `scripts/lib/coverage-url-classification.ts` | URL pattern matchers (source file, deep skill, repeated segment) |
| `scripts/lib/recovery-scorecard.ts` | Scorecard logic — uses `dominantCluster` to set coverage status |
| `reports/seo/latest-coverage-drilldown.json` | Current report output |
| `data/sitemap-skills.json` | Published sitemap skills index |
| `src/middleware.ts` | Edge middleware with existing noindex/404 rules |

## Discussion Summary

The `other` cluster URLs are legitimate-looking skill routes that no longer resolve because the underlying GitHub repos have been removed, renamed, or never ingested. These URLs are **expected 404s** — not a bug in routing but a natural consequence of the skill directory tracking a large evolving GitHub corpus. The appropriate response is:

1. **Sub-classify** the `other` bucket into `known_skill_404` (skill routes not in the current sitemap/database) vs a smaller residual `other`.
2. **Mark `known_skill_404` as explained** in the scorecard so it no longer blocks the coverage signal.
3. **Optionally build a diagnostic script** to cross-reference `other` sample URLs against `sitemap-skills.json` to quantify how many are missing from the active index.
