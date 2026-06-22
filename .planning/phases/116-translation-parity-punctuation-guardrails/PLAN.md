---
phase: 116
plan: 116-01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/lib/collection-locale-punctuation.ts
  - scripts/lib/collection-locale-punctuation.test.ts
  - scripts/verify-collection-cjk-punctuation.ts
  - package.json
autonomous: true
must_haves:
  artifacts:
    - path: scripts/lib/collection-locale-punctuation.ts
      min_lines: 40
    - path: scripts/verify-collection-cjk-punctuation.ts
      min_lines: 10
  key_links: []
---

# Phase 116 Plan — Translation Parity & Punctuation Guardrails

## Objective

Design and implement a collection-specific locale parity and terminal punctuation validation guardrail, backfill any missing localized metadata or fix punctuation anomalies in target collections, and integrate the guardrail into the main `validate:public-surface` script to act as a Release Gate.

## Requirement Traceability

- **AIOPS-37**: Enforce strict CJK translation parity and trailing punctuation validation checks.

***

## Tasks

<task>
<name>Implement Locale Parity and Punctuation Guardrail Library</name>
<files>
- scripts/lib/collection-locale-punctuation.ts
- scripts/lib/collection-locale-punctuation.test.ts
</files>
<action>
Implement the validation core library in scripts/lib/collection-locale-punctuation.ts. It must check collection JSON files for:
1. Complete 10 locales coverage for key fields (title, description, seoTitle, seoDescription, longDescription, keywords).
2. Complete 10 locales coverage for editorial.reviewSummary and editorial.selectionReason if they are present.
3. Locale-appropriate terminal punctuation for description-like text.
Add unit tests in scripts/lib/collection-locale-punctuation.test.ts.
</action>
<verify>
Run the unit test spec using Vitest:
`npx vitest run scripts/lib/collection-locale-punctuation.test.ts`
</verify>
<done>
The validation helper library is successfully written and passes its own unit tests.
</done>
</task>

<task>
<name>Create Punctuation CLI Verification Tool & Audit Collections</name>
<files>
- scripts/verify-collection-cjk-punctuation.ts
</files>
<action>
Create the CLI script scripts/verify-collection-cjk-punctuation.ts that parses the entire collections directory and prints a structured diagnostic report. Clean up any outstanding collection metadata gaps that trigger validation failures.
</action>
<verify>
Execute the CLI tool to verify all collections:
`npx tsx scripts/verify-collection-cjk-punctuation.ts`
Confirm that the command exits with 0 and prints passing stats.
</verify>
<done>
The verification tool runs cleanly and reports zero violations across all JSON collection files.
</done>
</task>

<task>
<name>CI Integration and E2E Smoke Validation</name>
<files>
- package.json
</files>
<action>
Wire the new guardrail command into the validate:public-surface script block in package.json. Run global typecheck, formatting, and the complete validation chain to verify everything passes.
</action>
<verify>
Run typecheck and the validation command:
1. `npm run typecheck`
2. `npm run validate:public-surface`
</verify>
<done>
All tests, lint-checks, and public surface validations pass cleanly with the new guardrail enabled.
</done>
</task>

***

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Existing manual translation overrides lost | Only run validation, do not overwrite files during verification. Gaps should be identified and manually/programmatically backfilled without destructive replacement |
| False positive on non-sentence metadata | Exclude fields like title, keywords, and installation paths from trailing punctuation requirements |
