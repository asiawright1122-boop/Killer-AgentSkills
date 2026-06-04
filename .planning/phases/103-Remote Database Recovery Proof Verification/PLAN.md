# Phase 103 Plan — Remote Database Recovery Proof Verification

## Objective

Verify the remote database search-indexation recovery rate by executing the remote D1 verification script, writing the results to the markdown dashboard, and checking for any execution errors.

## Requirement Traceability

- **AIOPS-24**: Verify remote database GSC coverage records via automated tooling and generate the post-intervention recovery scorecard.

---

## Plan 103-01: Run D1 remote verification and generate scorecard

### What

Execute the D1-backed recovery verification script and write the updated status to `.planning/dashboards/recovery-scorecard.md`.

### Why

Provides auditable evidence of the actual search-indexation rate in the live environment, isolating any remaining excluded URLs for subsequent remediation.

### Files to Modify / Create

- None. (We are running an existing script and generating a dashboard file).

### Files to Read

- `scripts/verify-recovery-proof.ts`
- `.planning/dashboards/recovery-scorecard.md` (Generated)

### Verification

1. Run the verification script:
   ```bash
   npm run verify:recovery
   ```
2. Verify that `.planning/dashboards/recovery-scorecard.md` is generated/updated.
3. Confirm that the script successfully prints query logs and output status.

---

## Execution Order

```
103-01
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Wrangler D1 query fails due to missing credentials or project configuration | Ensure active wrangler credentials are configured or fall back to explaining wrangler environment variables |
| Remote D1 database has no coverage records | Check that the database contains the table schema; if empty, run data seed / mock check |
