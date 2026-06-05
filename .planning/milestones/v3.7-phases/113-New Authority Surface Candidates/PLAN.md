# Phase 113 Plan — New Authority Surface Candidates

## Objective

Define, configure, and seed initial content for 3 new authority surfaces (Go, Java, Mobile) with full 10-language parity.

## Requirement Traceability

- **AIOPS-34**: Open 2–4 new authority surface candidates from underrepresented classes.

---

## Plan 113-01: Configure New Surfaces

### What

Add `collection-go`, `collection-java`, and `collection-mobile` placements to the authority surfaces index.

### Why

Integrates these developer categories into our public link architecture.

### Files to Modify / Create

- `data/authority-surfaces.json`

---

## Plan 113-02: Seed Multilingual Collections

### What

Write collection JSONs for Go, Java, and Mobile. Translate descriptions into all 10 locales (`en`, `zh`, `ja`, `ko`, `es`, `fr`, `de`, `pt`, `ru`, `ar`) ensuring ending punctuation is present and no jargon is used.

### Files to Modify / Create

- `src/content/collections/top-go-ai-tools-developer-workflows.json`
- `src/content/collections/top-java-ai-tools-developer-workflows.json`
- `src/content/collections/top-mobile-ai-tools-developer-workflows.json`

---

## Plan 113-03: Verification

### What

Verify that tests pass.

### Verification

- Run:
  ```bash
  npm run typecheck
  npx vitest run tests/pages/public-links.test.ts
  npx tsx scripts/seo-content-enrichment-report.ts
  ```

---

## Execution Order

```
113-01
113-02
113-03
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Missing locales or punctuation errors in descriptions | Verify using vitest prior to commit |
