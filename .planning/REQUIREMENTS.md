# Milestone v4.2 Requirements — Repository Size Reduction & Locale Configuration Normalization

## 1. Active Requirements

### Repository & Workspace Size Optimization (CLEAN)
- [ ] **CLEAN-01**: Clean up redundant large logs, browser screenshot artifacts, and browser state directories from `scripts/auto-submitter`.
- [ ] **CLEAN-02**: Audit and purge deprecated or temporary build artifacts, staging buffers, and draft cached files from `data/` and root `.tmp` directories.

### Locale Configuration Normalization (LOCALE)
- [ ] **LOCALE-01**: Normalize and resolve status of `src/messages/hi.json` (either formally activate Hindi in `SUPPORTED_LOCALES` or completely prune it from codebase/CI pathways).

### Build & Integration Verification (INTEGRATE)
- [ ] **INTEGRATE-01**: Verify type stability, rerun Edge Astro build, and ensure zero regressions across all 158 integration tests.

## 2. Out of Scope
- Modifying or cleaning third-party dependencies in `node_modules` or altering internal `.git` compression history.
- Translating the entire database of 3400+ skills into Hindi (if Hindi is enabled, only regular UI static translation files `hi.json` will be verified, not bulk skill content translation).

## 3. Traceability Matrix

| Req ID | Mapped Phase | Verification File | Status |
|---|---|---|---|
| CLEAN-01 | Phase 130 | `.planning/phases/130/VERIFICATION.md` | [ ] |
| CLEAN-02 | Phase 130 | `.planning/phases/130/VERIFICATION.md` | [ ] |
| LOCALE-01 | Phase 131 | `.planning/phases/131/VERIFICATION.md` | [ ] |
| INTEGRATE-01 | Phase 132 | `.planning/phases/132/VERIFICATION.md` | [ ] |
