# Phase 110 Plan — Homepage & Collections Hub Editorial Hardening

## Objective

Harden copy and structural curation sections for Homepage Root Hub and Collections Hub to establish the trust baseline and comply with public copy constraints.

## Requirement Traceability

- **AIOPS-31**: Homepage & Collections Hub Editorial Hardening.

---

## Plan 110-01: Harden Editorial Content on Hubs

### What

Modify `src/pages/[locale]/collections/index.astro` and locale message JSONs to replace jargon and optimize SEO readability.

### Why

Ensures that key landing pages serve as premium product guidance, avoiding search compliance issues.

### Files to Modify / Create

- `src/pages/[locale]/collections/index.astro`
- `src/messages/en.json`
- `src/messages/zh.json`

### Verification

- Check that modified files do not contain forbidden public words.
- Run typecheck and tests.

---

## Plan 110-02: Verification & Test Execution

### What

Execute Vitest test suite and Astro typechecks to ensure page templates build successfully.

### Why

Verify that the changes do not break the CJK or URL mapping systems.

### Verification

- Run:
  ```bash
  npm run typecheck
  npx vitest run tests/pages/public-links.test.ts
  ```

---

## Execution Order

```
110-01
110-02
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Public copy rules triggered by localized strings | Review zh/en strings to prevent matching blacklisted terms |
