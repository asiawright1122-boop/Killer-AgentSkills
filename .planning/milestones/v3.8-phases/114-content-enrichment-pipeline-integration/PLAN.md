---
phase: 114
plan: 114-01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/enrich-collections-batch.ts
  - scripts/enrich-collections-apply.ts
autonomous: true
must_haves:
  artifacts:
    - path: scripts/enrich-collections-batch.ts
      min_lines: 50
    - path: scripts/enrich-collections-apply.ts
      min_lines: 30
  key_links: []
---

# Phase 114 Plan — Content Enrichment Pipeline Integration

## Objective

Build and integrate the automated content enrichment script (`scripts/enrich-collections-batch.ts`) and its staging apply logic. The script must scan authority pages, identify thin content, route to configured LLM APIs (NVIDIA/SiliconFlow/OpenRouter/Workers AI) with retries, and write staged drafts to `data/enrichment-drafts.json` before applying updates.

## Requirement Traceability

- **AIOPS-35**: Integrate the content enrichment validation report with an automated LLM rewrite pipeline.

***

## Tasks

<task>
<name>Design and Implement the Enrichment Batch Script</name>
<files>
- scripts/enrich-collections-batch.ts
</files>
<action>
Create scripts/enrich-collections-batch.ts. Implement the logic to scan collections for thin content (leveraging logic from seo-content-enrichment-report.ts), route to configured APIs (SiliconFlow/NVIDIA/OpenRouter/Workers AI) with exponential backoff retries (up to 3 times), generate English descriptions (with jargon filters and trailing punctuation rules), and stage the output in data/enrichment-drafts.json.
</action>
<verify>
Run scripts/enrich-collections-batch.ts with mock/dry-run configurations to verify it outputs rich description proposals and handles rate limits.
</verify>
<done>
The script is successfully implemented and staging output.
</done>
</task>

<task>
<name>Implement the Apply Script</name>
<files>
- scripts/enrich-collections-apply.ts
</files>
<action>
Create scripts/enrich-collections-apply.ts to read data/enrichment-drafts.json and merge the staging metadata back into the corresponding src/content/collections/*.json files.
</action>
<verify>
Test running the apply script on a single collection draft to verify it merges and updates the JSON file successfully.
</verify>
<done>
The apply script merges draft files into collections correctly.
</done>
</task>

<task>
<name>E2E Pipeline Dry-Run Verification</name>
<files>
- scripts/enrich-collections-batch.ts
- scripts/enrich-collections-apply.ts
</files>
<action>
Perform a dry-run test of the batch pipeline on a single collection page, check that it populates data/enrichment-drafts.json properly, and run the apply script to verify the target file changes. Check typechecks and tests.
</action>
<verify>
Run typechecks and unit tests:
npm run typecheck
npx vitest run tests/pages/public-links.test.ts
</verify>
<done>
All tests and typechecks pass with clean results.
</done>
</task>

***

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Rate limits on free LLM endpoints | Implement a configurable throttle delay (e.g. 1-2s sleep) between batch items |
| JSON format corruption from LLM | Validate generated JSON schemas before writing to drafts |
