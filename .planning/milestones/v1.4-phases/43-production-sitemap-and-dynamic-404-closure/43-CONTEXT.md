# Phase 43: production-sitemap-and-dynamic-404-closure - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Source:** `v1.4` milestone audit, latest production crawl-health, D1-aware sitemap blocklist tooling, and current skill-route handling

<domain>
## Phase Boundary

This phase closes the remaining sitemap-linked and canonicalizable URL debt on the live domain so crawl stability becomes durable instead of transient.

This phase covers:
- tightening sitemap inclusion and exclusion so invalid skill URLs do not re-enter discovery
- hardening route normalization for repeated-segment, deep-path, and trailing-slash skill URL traps
- proving closure on `killer-skills.com` with repeatable smoke and crawl-health evidence

This phase does not cover:
- weekly KPI boards or cross-signal traffic reporting
- backup-provider posture changes beyond preserving the current AI guardrails
- new public discovery surfaces or growth expansion work
</domain>

<decisions>
## Implementation Decisions

- **D-01:** Treat the main domain `https://killer-skills.com` as the only closure target for this phase; preview deployments are useful for validation but do not satisfy exit gates.
- **D-02:** Keep D1-aware sitemap blocklist generation as the primary suppression mechanism for missing or invalid skill records instead of maintaining manual-only deny lists.
- **D-03:** Prefer deterministic exclusion, redirect, or canonical normalization for invalid skill-path variants; do not mask malformed URLs behind soft-success responses.
- **D-04:** Preserve current AI runtime posture during this phase: NVIDIA remains primary, backups stay explicit, and Workers AI remains `free-only`.
</decisions>

<specifics>
## Specific Ideas

- The latest production crawl-health sample on 2026-04-09 reports `1648` 2xx, `2` 4xx, `0` 5xx, and `0` Cloudflare 1102 signals across `1650` sampled URLs.
- The two remaining sampled 404s are long-tail dynamic skill-path residues:
  - `/ar/skills/marswangyang/Roger/resume-latex-pdf-generator`
  - `/zh/skills/cdeistopened/skill-stack/voice-matching-wizard`
- `scripts/seo-sitemap-blocklist.ts` already supports D1 gap detection, and the current live blocklist shows `362` exact rules, `338` repo rules, and `232` D1-missing records.
- Coverage drilldown evidence is partially blocked by the missing 2026-04-08 raw export, so this phase should rely on current crawl-health plus deterministic route analysis rather than waiting on missing inputs.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/PROJECT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `reports/seo/latest-traffic-recovery-audit.md`
- `reports/seo/latest-crawl-health.md`
- `reports/seo/latest-crawl-health.json`
- `reports/seo/latest-404-remediation-plan.md`
- `data/seo-sitemap-blocklist.json`
- `data/seo-404-rules.json`
- `scripts/seo-sitemap-blocklist.ts`
- `scripts/seo-crawl-health.ts`
- `scripts/seo-smoke.ts`
- `scripts/seo-404-remediation-plan.ts`
- `src/middleware.ts`
- `src/lib/sitemap-blocklist.ts`
- `src/lib/skill-route-paths.ts`
- `src/pages/[locale]/skills/[owner]/[...repo].astro`
- `src/pages/sitemap-skills-[page].xml.ts`
- `src/pages/sitemap.xml.ts`
</canonical_refs>

---

*Phase: 43-production-sitemap-and-dynamic-404-closure*
*Context gathered: 2026-04-09*
