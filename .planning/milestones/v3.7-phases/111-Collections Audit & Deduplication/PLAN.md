# Phase 111 Plan — Collections Audit & Deduplication

## Objective

Identify and clean up duplicate links, broken repositories, and thin descriptions across all collections. Automate this audit to establish a strict checklist.

## Requirement Traceability

- **AIOPS-32**: Audit and deduplicate existing collections content; remediate low-quality entries.

---

## Plan 111-01: Build Quality Audit Automation

### What

Write `scripts/seo-collection-quality-audit.ts` to scan collection files for duplicate entries, missing locales, incorrect schemas, and formatting drift.

### Why

Provides a repeatable automated baseline to verify collections against the SEO quality gates.

### Files to Modify / Create

- `scripts/seo-collection-quality-audit.ts`

---

## Plan 111-02: Remediate Collections and Define Checklist

### What

Create the quality checklist document, run the auditor, and apply surgical corrections to collection files to fix duplicates and invalid formats.

### Why

Brings all collection content into compliance with localization and SEO standard rules.

### Files to Modify / Create

- `docs/collections-quality-checklist.md`
- `src/content/collections/*.json`

### Verification

- Run:
  ```bash
  npx tsx scripts/seo-collection-quality-audit.ts
  ```

---

## Plan 111-03: Repository Integrity Validation

### What

Verify that no typecheck or unit tests are broken.

### Verification

- Run:
  ```bash
  npm run typecheck
  npx vitest run tests/pages/public-links.test.ts
  ```

---

## Execution Order

```
111-01
111-02
111-03
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Modification of JSON templates breaking schemas | Enforce Vitest validation checks after each file rewrite |
