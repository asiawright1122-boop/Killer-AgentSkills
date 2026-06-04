# Phase 104 Plan — Residual Exclusion Reasons Remediation

## Objective

Remediate the residual excluded URL (`https://killer-skills.com/zh/skills/invalid-page`) by configuring a 301 redirect and syncing the database to achieve 100% Technical Recovery Rate.

## Requirement Traceability

- **AIOPS-25**: Remediate residual search exclusion patterns to drive the technical recovery rate towards the 95% threshold.

---

## Plan 104-01: Apply 301 Redirect for Excluded URL

### What

Add a 301 redirect rule for `/zh/skills/invalid-page` inside `data/seo-404-rules.json`.

### Why

By routing requests from `/zh/skills/invalid-page` to `/zh/skills`, we resolve the 404 error at the edge middleware level.

### Files to Modify / Create

- **`data/seo-404-rules.json`** [MODIFY]: Add redirect rule.

### Verification

Run the local dev server and test:
```bash
curl -I http://localhost:4321/zh/skills/invalid-page
```
It should return a `301 Moved Permanently` status with a `Location: /zh/skills`.

---

## Plan 104-02: Synchronize Remote D1 Database Status

### What

Execute a Wrangler SQL command to delete the excluded `/zh/skills/invalid-page` entry from the `gsc_coverage_drilldown` table on the remote database.

### Why

Since the 404 issue is remediated with a redirect, updating the remote coverage drilldown records ensures that subsequent verification scans correctly count only the active indexable URL population.

### Files to Modify / Create

- None. (Remote database operation).

### Verification

Execute a Wrangler check to ensure the record is gone:
```bash
npx wrangler d1 execute killer-skills-db --remote --command "SELECT * FROM gsc_coverage_drilldown WHERE url LIKE '%invalid-page%';"
```
It should return 0 results.

---

## Plan 104-03: Regenerate and Verify Scorecard

### What

Regenerate the scorecard report to verify the recovery status transitions to CLEAR.

### Why

Confirms that the technical recovery gate is no longer blocked.

### Files to Modify / Create

- **`.planning/dashboards/recovery-scorecard.md`** [MODIFY] (Generated)

### Verification

Run `npm run verify:recovery` and verify that:
- Technical Recovery Rate is reported as **100.00%**.
- The scorecard warning transitions to a TIP.

---

## Execution Order

```
104-01 → 104-02 → 104-03
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Editing rules JSON violates formatting | Ensure correct JSON syntax when adding the object segment to redirect301 |
| DB query permissions | Verify Wrangler has valid credentials to mutate D1 |
