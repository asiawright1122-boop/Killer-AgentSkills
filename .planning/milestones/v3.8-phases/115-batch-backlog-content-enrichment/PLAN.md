---
phase: 115
plan: 115-01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/content/collections/top-official-mcp-servers.json
  - src/content/collections/top-workflow-mcp-servers.json
  - src/content/collections/top-cli-mcp-servers.json
  - src/content/collections/top-codex-mcp-servers.json
  - src/content/collections/top-community-skills.json
  - src/content/collections/top-cursor-mcp-servers.json
  - src/content/collections/top-developer-tools-mcp-servers.json
  - src/content/collections/top-devops-mcp-servers.json
  - src/content/collections/top-framework-mcp-servers.json
  - src/content/collections/top-gemini-cli-mcp-servers.json
  - src/content/collections/top-gemini-mcp-servers.json
  - src/content/collections/top-go-ai-tools-developer-workflows.json
  - src/content/collections/top-java-ai-tools-developer-workflows.json
  - src/content/collections/top-mobile-ai-tools-developer-workflows.json
  - src/content/collections/top-nextjs-mcp-servers.json
  - src/content/collections/top-openai-mcp-servers.json
  - src/content/collections/top-opencode-mcp-servers.json
  - src/content/collections/top-orchestration-mcp-servers.json
  - src/content/collections/top-productivity-mcp-servers.json
  - src/content/collections/top-python-mcp-servers.json
  - src/content/collections/top-react-mcp-servers.json
  - src/content/collections/top-rust-mcp-servers.json
  - src/content/collections/top-typescript-mcp-servers.json
  - src/content/collections/top-windsurf-skills.json
autonomous: true
must_haves:
  artifacts:
    - path: data/enrichment-drafts.json
      min_lines: 5
  key_links: []
---

# Phase 115 Plan — Batch Backlog Content Enrichment

## Objective

Execute the automated batch enrichment pipeline on all pending or thin collections listed in `data/authority-surfaces.json` (such as `top-official-mcp-servers.json` and `top-workflow-mcp-servers.json`), generating draft translations in `data/enrichment-drafts.json` using Gemini API via OpenRouter, applying drafts back to source collections, and verifying results with strict CJK parity, punctuation check, typechecking, and smoke validations.

## Requirement Traceability

- **AIOPS-36**: Execute batch enrichment on all currently thin or hold collections.

***

## Tasks

<task>
<name>Run Batch Enrichment Pipeline</name>
<files>
- data/enrichment-drafts.json
</files>
<action>
Execute `npx tsx scripts/enrich-collections-batch.ts --limit=40`. Verify that it uses the OpenRouter provider to generate high-quality multilingual metadata proposals (with jargon filters and proper trailing punctuation) for all targeted thin/hold collection surfaces, outputting them into `data/enrichment-drafts.json`.
</action>
<verify>
Check if `data/enrichment-drafts.json` is successfully created/updated and contains structured draft details for target collections. Run a quick check that no forbidden keywords (e.g. review, validation, checklist, checkpoint, trusted next) are present in the values.
</verify>
<done>
Batch enrichment run completes and populates the drafts file without breaking the process.
</done>
</task>

<task>
<name>Apply Enriched Drafts</name>
<files>
- src/content/collections/*.json
</files>
<action>
Execute `npm run enrichment:apply` to read `data/enrichment-drafts.json` and merge the generated localized content back into the corresponding source collection files under `src/content/collections/`.
</action>
<verify>
Verify that the collection source files are updated with git status and git diff. Check that the file contents have CJK locales parity.
</verify>
<done>
All staged drafts are successfully merged back to collections JSON files, and `data/enrichment-drafts.json` is updated/cleaned up.
</done>
</task>

<task>
<name>Punctuation and Quality Verification</name>
<files>
- src/content/collections/*.json
</files>
<action>
Execute the locale punctuation check script: `node --import tsx scripts/verify-cjk.js` to assert proper CJK trailing punctuation and translation structure. Run `npx tsx scripts/seo-content-enrichment-report.ts` to confirm there are zero thin content surfaces left.
</action>
<verify>
Check that the verification scripts finish successfully with zero errors and report that all collection pages are rich.
</verify>
<done>
CJK punctuation check passes, and the enrichment diagnostic reports 0 thin surfaces.
</done>
</task>

<task>
<name>Global Types and Smoke Test Validation</name>
<files>
- src/content/collections/*.json
</files>
<action>
Verify that the codebase remains fully intact by running global typechecks and the public surface smoke test suite:
1. `npm run typecheck`
2. `npm run validate:public-surface`
</action>
<verify>
Confirm that all typechecks pass cleanly and the smoke test command returns exit code 0.
</verify>
<done>
Global typecheck and validation tests pass successfully with no errors.
</done>
</task>

***

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Free AI API quota limits or timeout | Use retry loops in the batch runner, throttled delays, and graceful error recovery to skip failed pages |
| Public copy boundary violations | The batch runner check `containsForbiddenWords` actively blocks writing draft entries containing forbidden words, forcing retry loops |
