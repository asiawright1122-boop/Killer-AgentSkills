# Phase 50: skill-originality-contract-and-template-reset - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning
**Source:** 2026-04-16 Google-guidelines SEO audit, current skill detail template behavior, and the need to replace the README-first page model

<domain>
## Phase Boundary

This phase replaces the current README-first skill detail model with a first-party originality contract and a template reset that makes Killer-Skills' evaluation layer primary.

This phase covers:

- defining the indexability contract for skill detail pages
- replacing the current byte-threshold gate with a first-party value gate
- restructuring the skill detail template so original evaluation appears before imported source content
- preserving user utility for non-indexable pages without pretending they are strong organic landing pages

This phase does not cover:

- the corpus-wide keep/consolidate/noindex/remove rollout
- sitemap and canonical publication changes driven by corpus classification
- the broader authority-surface repositioning across collections, comparisons, and tutorials
</domain>

<decisions>
## Implementation Decisions

- **D-01:** Imported GitHub or repository content should become supporting evidence, not the main value proposition of an indexable skill page.
- **D-02:** A skill page should remain indexable only when Killer-Skills adds clear first-party value such as evaluation, validation, compatibility judgment, or decision support.
- **D-03:** Replacing the `readmeSize < 250` threshold is mandatory; byte count alone is not a trustworthy proxy for page quality.
- **D-04:** Non-indexable skill pages may remain user-accessible, but the page template should still clearly distinguish first-party guidance from imported source material.
</decisions>

<specifics>
## Specific Ideas

- A stronger first-party layer should likely include fit, limitations, compatibility, verification status, and why-to-use / why-not-to-use signals.
- The template should answer user decision questions before it shows a long README.
- The audit's core warning is not merely duplicate text; it is that the page often adds too little original value relative to imported content.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/milestones/v1.5-phases/49-skill-locale-index-governance/49-CONTEXT.md`
- `docs/seo-google-guidelines-audit-2026-04-16.md`
- `src/pages/[locale]/skills/[owner]/[...repo].astro`
- `src/islands/SkillReadme.tsx`
- `scripts/build-skills-cache.ts`
- `reports/seo/latest-coverage-drilldown.md`
- `reports/gsc/latest-ctr-report.md`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skill.agentAnalysis` and `skill.seo` already provide structured fields that can seed a stronger first-party evaluation layer
- `SkillReadme.tsx` already isolates imported markdown rendering, making it a natural candidate to demote below original page sections

### Established Patterns
- Collections already behave more like curated landing pages than raw-source wrappers
- Skill detail pages currently over-rely on imported markdown and generated wrappers, which this phase needs to reverse

### Integration Points
- Skill detail runtime assembly in `src/pages/[locale]/skills/[owner]/[...repo].astro`
- Skill markdown rendering in `src/islands/SkillReadme.tsx`
- Cache/enrichment metadata in `scripts/build-skills-cache.ts`
</code_context>

<deferred>
## Deferred Ideas

- Corpus-wide keep/consolidate/noindex/remove decisions belong to Phase `51`
- Broader authority-surface repositioning belongs to Phase `52`
- Net-new acquisition surfaces or growth experiments stay out of scope until the governed template and corpus are stable
</deferred>

---

_Phase: 50-skill-originality-contract-and-template-reset_
_Context gathered: 2026-04-16_
