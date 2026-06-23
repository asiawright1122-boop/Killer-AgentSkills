# Milestone v4.6 Requirements — GitHub Workflow SEO & Harvester Hardening

## 1. Active Requirements

### Crawler & Harvester compliance (HARV)
- [ ] **HARV-01**: Refactor automated crawler/harvester and submission workflows to enforce content originality filters, blocking low-value mirror content from source.

### GEO-localized translation sync (GEO)
- [ ] **GEO-01**: Enforce CJK terminal punctuation and formatting rules in dynamic translation workflows to ensure GEO-local typography compliance.
- [ ] **GEO-02**: Modernize semantic phrasing translation policies to avoid simple machine translations and ensure SEO-appropriate descriptions.

### Metadata Enrichment & Keywords (META)
- [ ] **META-01**: Integrate automated batch enrichment pipelines in workflows to automatically discover keywords and populate missing editorial details.

### CI/CD validation loops (CI)
- [ ] **CI-01**: Implement automated gate checking (copy leakages, Prettier formatting, translation parity, and CJK punctuation) in GitHub Actions on commit/PR.

### Build & Regression Integrity (INTEG)
- [ ] **INTEG-01**: Enforce 100% build stability, clean TypeScript compile checks, and Vitest test suite regression checks.

## 2. Out of Scope

- **Large net-new discovery surfaces**: wait until post-governance proof supports them.
- **Paid Workers AI expansion**: remains out of scope unless explicitly budgeted.

## 3. Traceability Matrix

| Req ID | Mapped Phase | Verification File | Status |
|---|---|---|---|
| HARV-01 | | | [ ] |
| GEO-01 | | | [ ] |
| GEO-02 | | | [ ] |
| META-01 | | | [ ] |
| CI-01 | | | [ ] |
| INTEG-01 | | | [ ] |
