# Phase 144: Harvester SEO Compliance & Originality Filter - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning
**Source:** Auto-generated design decisions

<domain>
## Phase Boundary

Refactor and strengthen the automated skill harvesting (harvester) and auto-submitter workflows to filter low-originality mirror pages at harvest time. Ensure no duplicate, thin, or low-quality content enters the database.

</domain>

<decisions>
## Implementation Decisions

### Originality & Similarity Filtering
- **D-01:** Implement a cosine similarity / TF-IDF text check in the harvester tool to compare incoming skill Markdown files with existing skills. If the similarity score is above 85%, the skill must be filtered out and not submitted to the D1/KV database.
- **D-02:** Reject any skill page containing thin content (e.g. less than 200 words of description) or missing crucial metadata (like owner, repository name, or key tags).

### SEO Enrichment from Source
- **D-03:** Auto-inject an originality metadata block (such as first-party analysis placeholders, original repository credits, and canonical source backlinks) during the crawl phase to ensure the page offers unique value and avoids search engine duplication penalties.

### Integration & Validation
- **D-04:** Create a dedicated test suite (`tests/harvester/originality-filter.test.ts`) that asserts mock low-originality and thin skills are correctly flagged, logged, and skipped by the submission pipeline.

### the agent's Discretion
- Technical selection of the similarity comparison algorithm (e.g. simplified token overlap or TF-IDF weights) is left to implementation planning.
- The logging format of skipped/filtered skills in the crawler logs is left to implementation.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Scripts & Configuration
- `package.json` — Workspace scripts and dependency versions
- `src/lib/skills.ts` — Skill data models, validation schema, and D1 database mappings
- `scripts/clean-broken-skills.js` — Database hygiene and maintenance logic

</canonical_refs>

<specifics>
## Specific Ideas
- Maintain a list of filtered skills in a local log file (e.g., `logs/harvester-skipped.log`) for operator review, preventing repeated crawling of blacklisted/filtered repositories.

</specifics>

<deferred>
## Deferred Ideas
- Dynamic keywords mining from search engine APIs (deferred to Phase 146).

</deferred>

---

*Phase: 144-harvester-seo-compliance-originality-filter*
*Context gathered: 2026-06-23 via Auto-Generated Decisions*
