---
phase: 43-production-sitemap-and-dynamic-404-closure
plan: 01
type: plan
wave: 1
depends_on: []
files_modified:
  - ".planning/PROJECT.md"
  - ".planning/ROADMAP.md"
  - ".planning/REQUIREMENTS.md"
  - ".planning/STATE.md"
  - ".planning/milestones/v1.4-phases/43-production-sitemap-and-dynamic-404-closure/43-CONTEXT.md"
  - ".planning/milestones/v1.4-phases/43-production-sitemap-and-dynamic-404-closure/43-PLAN.md"
  - ".planning/milestones/v1.4-phases/43-production-sitemap-and-dynamic-404-closure/43-01-SUMMARY.md"
  - ".planning/milestones/v1.4-phases/43-production-sitemap-and-dynamic-404-closure/43-VERIFICATION.md"
  - "reports/seo/latest-traffic-recovery-audit.md"
  - "reports/seo/latest-crawl-health.md"
  - "reports/seo/latest-crawl-health.json"
  - "reports/seo/latest-404-remediation-plan.md"
  - "reports/seo/latest-404-remediation-plan.json"
  - "data/seo-sitemap-blocklist.json"
  - "data/seo-404-rules.json"
  - "scripts/seo-sitemap-blocklist.ts"
  - "scripts/seo-crawl-health.ts"
  - "scripts/seo-smoke.ts"
  - "scripts/seo-404-remediation-plan.ts"
  - "src/middleware.ts"
  - "src/lib/sitemap-blocklist.ts"
  - "src/lib/skill-route-paths.ts"
  - "src/pages/[locale]/skills/[owner]/[...repo].astro"
  - "src/pages/sitemap-skills-[page].xml.ts"
  - "src/pages/sitemap.xml.ts"
requirements:
  - SEO-11
  - SEO-12
autonomous: true
must_haves:
  truths:
    - "Invalid or missing skill URLs cannot re-enter live sitemap discovery through D1 gaps or route-shape drift."
    - "Main-domain crawl-health stays at `5xx=0`, `Cloudflare 1102=0`, and sampled `4xx <= 0.2%` after the remediation loop."
    - "Residual malformed skill-path variants are deterministically excluded, redirected, or canonicalized instead of oscillating between crawl outcomes."
  artifacts:
    - path: "reports/seo/latest-crawl-health.json"
      provides: "Machine-readable evidence for main-domain crawl quality after remediation"
    - path: "data/seo-sitemap-blocklist.json"
      provides: "Live exclusion contract for invalid or missing skill URLs"
    - path: "reports/seo/latest-404-remediation-plan.md"
      provides: "Operator-facing explanation of remaining 404 patterns and disposition"
---

# Phase 43 Plan 01: Production Sitemap and Dynamic 404 Closure

<objective>
Close the remaining live-domain sitemap and canonical URL debt so recent technical SEO recovery becomes durable and repeatable.

Purpose: eliminate the last known sitemap-linked and malformed skill-path failures before we move on to recovery reporting and traffic validation.
Output: tighter sitemap exclusion logic, deterministic route normalization for malformed skill URLs, and refreshed production evidence proving closure against the main domain.
</objective>

<execution_context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/milestones/v1.4-phases/43-production-sitemap-and-dynamic-404-closure/43-CONTEXT.md
@reports/seo/latest-traffic-recovery-audit.md
@reports/seo/latest-crawl-health.md
@reports/seo/latest-crawl-health.json
@reports/seo/latest-404-remediation-plan.md
@data/seo-sitemap-blocklist.json
@data/seo-404-rules.json
@scripts/seo-sitemap-blocklist.ts
@scripts/seo-crawl-health.ts
@scripts/seo-smoke.ts
@scripts/seo-404-remediation-plan.ts
@src/middleware.ts
@src/lib/sitemap-blocklist.ts
@src/lib/skill-route-paths.ts
@src/pages/[locale]/skills/[owner]/[...repo].astro
@src/pages/sitemap-skills-[page].xml.ts
@src/pages/sitemap.xml.ts
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Close sitemap-linked invalid URL re-entry</name>
  <action>Audit and tighten the live sitemap generation and blocklist pipeline so D1-missing, malformed, or now-invalid skill URLs cannot reappear in sitemap discovery.</action>
  <acceptance_criteria>The regenerated blocklist and live smoke checks prove that malformed or missing skill URLs are excluded from the main-domain sitemap set.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Normalize residual malformed skill-path variants</name>
  <action>Harden route handling for deep-path, repeated-segment, and trailing-slash skill URL traps so live requests resolve deterministically through exclusion, redirect, or canonical parent-path behavior.</action>
  <acceptance_criteria>The currently sampled residual 404 shapes have a deliberate disposition, and repeated route-shape drift no longer shows up as sampled crawl failures.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Refresh production closure evidence</name>
  <action>Re-run the remediation loop on the live domain, refresh crawl-health and 404 remediation artifacts, and capture the closure result in milestone-facing operator documents.</action>
  <acceptance_criteria>Main-domain evidence shows `5xx=0`, `Cloudflare 1102=0`, and sampled `4xx <= 0.2%`, with updated artifacts explaining any remaining long-tail edge cases.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run src/lib/sitemap-blocklist.test.ts scripts/lib/ai.test.ts`
- `npm run report:seo:sitemap-blocklist:d1`
- `npm run build`
- `npm run seo:smoke -- http://127.0.0.1:4321 --spawn-dev`
- `SEO_SMOKE_CACHE_BUST=1 SEO_SMOKE_SITEMAP_ONLY=1 npm run seo:smoke -- https://killer-skills.com`
- `npm run report:seo:crawl-health -- https://killer-skills.com`
- `npm run report:seo:coverage-drilldown`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
Live sitemap discovery, malformed skill-path handling, and sampled crawl evidence all agree on the same recovery-safe URL set for the main domain.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.4-phases/43-production-sitemap-and-dynamic-404-closure/43-01-SUMMARY.md`
</output>
