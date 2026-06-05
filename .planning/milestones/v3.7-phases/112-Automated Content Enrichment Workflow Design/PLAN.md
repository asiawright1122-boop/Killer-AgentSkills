# Phase 112 Plan — Automated Content Enrichment Workflow Design

## Objective

Build a script to audit thin content across all authority surfaces, and patch descriptions to achieve 0 thin content warnings.

## Requirement Traceability

- **AIOPS-33**: Define and implement automated content enrichment workflow for hold backlog.

---

## Plan 112-01: Build Enrichment Auditor Script

### What

Implement `scripts/seo-content-enrichment-report.ts` which inspects all 35+ surfaces for localization compliance, thin content thresholds, and punctuation rules.

### Why

Automates the quality assurance check for metadata across all 10 supported locales.

### Files to Modify / Create

- `scripts/seo-content-enrichment-report.ts`

---

## Plan 112-02: Remediate Thin Backlog Content

### What

Enrich description copy in collections and metadata tables to pass the new validation script.

### Files to Modify / Create

- `src/content/collections/top-official-mcp-servers.json`
- `src/content/collections/top-workflow-mcp-servers.json`

---

## Plan 112-03: Run Audits and Tests

### What

Validate all changes and verify no thin content remains.

### Verification

- Run:
  ```bash
  npx tsx scripts/seo-content-enrichment-report.ts
  npm run typecheck
  npx vitest run tests/pages/public-links.test.ts
  ```

---

## Execution Order

```
112-01
112-02
112-03
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Punctuation checks fail on localized strings | Ensure all `seoDescription` entries end with a period or CJK equivalent |
