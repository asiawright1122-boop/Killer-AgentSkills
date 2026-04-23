---
phase: 58-public-copy-boundary-audit-and-inventory
requirements_completed:
  - GOV-13
---

# Phase 58 Summary

## Outcome

Phase 58 confirmed that the homepage leak was not an isolated wording bug.

The repository currently has a repeatable public-copy boundary problem: multiple public-facing route templates and shared content sources still use internal strategy/process framing that reads like operator guidance, editorial decision language, or SEO/planning scaffolding instead of user-facing product copy.

The audit established three important truths:

- the problem exists in both rendered page templates and shared content/data sources
- the strongest concentration is in collection content JSON, not only in page templates
- high-traffic entry surfaces already carry the pattern, so this is a trust-surface issue rather than a long-tail cleanup task

## Audit Scope

The audit reviewed:

- public route templates under `src/pages/`
- shared public content under `src/content/collections/`
- shared authority-surface copy under `src/lib/authority-surface-public-data.ts`
- shipped public message catalogs under `src/messages/`

The audit intentionally excluded:

- internal planning artifacts under `.planning/`
- operator/report scripts and tests that are not shipped to end users
- public blog content unless it was clearly being used as product-entry copy

## Findings

### Severity 1: public route templates already expose the pattern

Matched public page templates: `6`

- [index.astro](/Users/kaka/Dev/Killer-Skills-clean-main/src/pages/[locale]/index.astro) had the confirmed homepage leak and is now remediated in this branch.
- [index.astro](/Users/kaka/Dev/Killer-Skills-clean-main/src/pages/[locale]/collections/index.astro) still uses phrases such as `trusted starter collection`, `sanity-check`, and Chinese copy about `收口`.
- [[...slug].astro](/Users/kaka/Dev/Killer-Skills-clean-main/src/pages/[locale]/collections/[...slug].astro) is the strongest template hotspot with `8` matched lines, including repeated `收口`, `安装路径`, and route-steering language.
- [[topic].astro](/Users/kaka/Dev/Killer-Skills-clean-main/src/pages/[locale]/solutions/[topic].astro) has `7` matched lines centered on `operator guardrails`, `operator checkpoint`, and workflow-lane decision framing.
- [[...slug].astro](/Users/kaka/Dev/Killer-Skills-clean-main/src/pages/[locale]/docs/[...slug].astro) has `4` matched lines that frame docs as an `operator path` rather than plain installation help.
- [[...repo].astro](/Users/kaka/Dev/Killer-Skills-clean-main/src/pages/[locale]/skills/[owner]/[...repo].astro) still contains operator-oriented wording, although at lower density.

### Severity 2: shared collection content is the main systemic source

Matched shared collection files: `25`

Top hotspot files by match count:

- [top-workflow-mcp-servers.json](/Users/kaka/Dev/Killer-Skills-clean-main/src/content/collections/top-workflow-mcp-servers.json): `20`
- [top-devops-mcp-servers.json](/Users/kaka/Dev/Killer-Skills-clean-main/src/content/collections/top-devops-mcp-servers.json): `16`
- [top-cli-mcp-servers.json](/Users/kaka/Dev/Killer-Skills-clean-main/src/content/collections/top-cli-mcp-servers.json): `16`
- [top-react-mcp-servers.json](/Users/kaka/Dev/Killer-Skills-clean-main/src/content/collections/top-react-mcp-servers.json): `15`
- [top-nextjs-mcp-servers.json](/Users/kaka/Dev/Killer-Skills-clean-main/src/content/collections/top-nextjs-mcp-servers.json): `15`
- [top-framework-mcp-servers.json](/Users/kaka/Dev/Killer-Skills-clean-main/src/content/collections/top-framework-mcp-servers.json): `15`

Common leak patterns in these JSON sources:

- `operator clarity`, `operator handoff`, `operator checkpoint`
- `install-first`
- `editorial filter`
- `trusted starter collection`
- Chinese route-steering phrases like `收口`, `交叉核对`, `已验证路径`, `标准化之前`

This means Phase `59` should not only rewrite route templates. It must also clean the shared content sources that feed them.

### Severity 2: authority-surface data and messages also carry the tone

Matched supporting shared sources: `2`

- [authority-surface-public-data.ts](/Users/kaka/Dev/Killer-Skills-clean-main/src/lib/authority-surface-public-data.ts) still includes phrases like `workflow intent` and `what operators should validate after installation`.
- [zh.json](/Users/kaka/Dev/Killer-Skills-clean-main/src/messages/zh.json) still contains user-facing copy that uses `收口候选工具`, `高信任选择`, and `落地路径` style framing.

These shared sources are lower-volume than the collection JSON files, but they are systemic because they can leak into multiple public pages.

## First Remediation Completed

The homepage leak that triggered this phase is already fixed in this branch:

- [index.astro](/Users/kaka/Dev/Killer-Skills-clean-main/src/pages/[locale]/index.astro)

The quick-start section now uses user-facing product guidance instead of internal strategy wording, and homepage entry-card copy is overridden so users see product labels rather than internal navigation terminology.

## First Guardrail Completed

Added a regression test so the homepage cannot silently reintroduce the same class of wording:

- [public-links.test.ts](/Users/kaka/Dev/Killer-Skills-clean-main/tests/pages/public-links.test.ts)

The new assertion blocks the exact phrase family that appeared in the original leak:

- `Trusted Entry Paths`
- `Start With a Trusted Anchor`
- `Use the Scenario to Narrow the Choice`
- `Turn Discovery Into Installation`
- and the equivalent Chinese phrases

## Recommended Next Order

1. Phase `59` should prioritize `collections` route templates plus the highest-match collection JSON sources.
2. Phase `59` should then normalize `solutions` and `docs` surfaces where operator/process framing is still visible.
3. Phase `60` should broaden the guardrail from homepage-only to shared public content sources and high-traffic page templates.

## Why This Matters

This issue is not just tonal.

When public pages read like internal decision frameworks, operator notes, or SEO strategy scaffolds, the product looks less trustworthy and less direct. Users should feel like the site is helping them choose and install tools, not exposing the internal reasoning model that shaped the page.
