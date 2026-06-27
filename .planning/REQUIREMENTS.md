# Milestone v5.0 Requirements — Traffic Activation & Index Health Closure

## 1. Active Requirements

### Index Health Closure (IND)
- [ ] **IND-01**: Close the coverage anomaly gap by verifying the 975-URL REMOV-01 removal batch impact (operator submission tracked via GitHub issue #19), building post-submission verification automation with before/after delta reporting, and generating a second-pass removal batch for the top 3 remaining high-priority clusters not covered by the first batch. Target: reduce coverage anomalies from 10,783 to <2,000.

### Traffic Activation (TRAF)
- [ ] **TRAF-01**: Earn measurable impressions on P0 authority surfaces within 4 weeks by optimizing title tags, meta descriptions, and structured data (`FAQPage`/`SoftwareApplication`) on the 8 P0 authority surfaces; wiring IndexNow ping-on-deploy for the 436 Tier 1 URLs; and reinforcing internal cross-links to ensure ≥3 inbound links per P0 surface. Current baseline: 0 impressions, 0 clicks across all 34 promote surfaces.

### Coverage Freshness Automation (FRESH)
- [ ] **FRESH-01**: Establish automated GSC data freshness so coverage source age stays ≤7 days without manual CSV export. Build a scheduled GSC API coverage pipeline for the 436 Tier 1 URLs, refactor the Coverage Drilldown report to accept API data as an input source, add a freshness SLA alert to the compliance matrix, and create a weekly traffic proof dashboard. This closes REC-24 (unresolved since April v1.7).

## 2. Out of Scope

- **Bulk skill-detail re-expansion**: stays off until TRAF-01 shows measurable impressions on P0 surfaces.
- **Paid AI provider expansion**: SiliconFlow/OpenRouter re-enablement is a separate budget decision.
- **Experiment ladder automation promotion**: 0 candidates; wait for TRAF-01 evidence before promoting automation candidates.

## 3. Traceability Matrix

| Req ID | Mapped Phase | Verification File | Status |
|---|---|---|---|
| IND-01 | Phase 156 | reports/seo/latest-gsc-removal-tracker.md, reports/seo/latest-url-inspection-coverage-sweep.json, reports/seo/latest-gsc-removal-batch-v2.md, reports/seo/latest-remov01-coverage-crossref.md, reports/seo/latest-coverage-anomaly-projection.md | [ ] automation delivered, verification pending operator submission |
| TRAF-01 | Phase 157 | P0 surface titles/descriptions, reports/seo/latest-structured-data-validation.md, data/skill-collection-lookup.json, scripts/submit-indexnow.ts | [ ] automation delivered, validation pending prod run |
| FRESH-01 | Phase 158 | reports/seo/latest-gsc-api-coverage.json, reports/seo/latest-traffic-proof.md, reports/seo/latest-search-compliance-matrix.json | [ ] |

## 4. Carry-Forward from v4.9

| Carry Item | v5.0 Mapping |
|---|---|
| REMOV-01 manual GSC removal submission (0/975 URLs) | IND-01 verification + second-pass batch |
| Zero impressions on 34 promote surfaces | TRAF-01 traffic activation |
| Coverage Drilldown freshness gap (21+ days, REC-24) | FRESH-01 automation pipeline |
