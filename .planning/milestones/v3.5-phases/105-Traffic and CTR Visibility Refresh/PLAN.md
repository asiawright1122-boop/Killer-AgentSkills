# Phase 105 Plan — Traffic and CTR Visibility Refresh

## Objective

Refresh Search Console traffic data, verify organic click growth trends, and evaluate whether the business recovery status transitions to CLEAR.

## Requirement Traceability

- **AIOPS-26**: Refresh live GSC search console stats, track organic click trends, and verify if the business recovery status can transition out of `blocking`.

---

## Plan 105-01: Refresh Google Search Console Traffic Report

### What

Execute the Search Console performance reporting tool to update live organic search CTR data.

### Why

Ingests fresh traffic evidence to prove whether visitors are reaching directory pages via organic search.

### Files to Modify / Create

- None. (Generates reports).

### Files to Read

- `scripts/gsc-ctr-report.ts`
- `reports/gsc/latest-ctr-report.md` (Generated)

### Verification

Run the GSC reporting tool:
```bash
npm run report:gsc
```
Check that `reports/gsc/latest-ctr-report.md` is updated and has fresh date intervals.

---

## Plan 105-02: Recalculate Scorecard and Verify Business Recovery

### What

Regenerate the technical recovery scorecard to check both Technical and Business recovery statuses.

### Why

Confirms if the final milestones gates are fully satisfied.

### Files to Modify / Create

- None. (Updates `latest-recovery-scorecard.json` and `.md`).

### Verification

1. Run the scorecard command:
   ```bash
   npx tsx scripts/seo-recovery-scorecard.ts
   ```
2. Verify that the Business Recovery indicator transitions to CLEAR/satisfied.

---

## Execution Order

```
105-01 → 105-02
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Search Console live API query fails due to quota or auth limits | Check GSC credentials and connection mode; falls back to live-api mock modes if API is entirely offline |
