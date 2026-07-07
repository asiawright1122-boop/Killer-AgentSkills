Status: DONE

Summary:
- Added `src/lib/marketplace-policy.ts` with baseline marketplace admission, source-kind detection, public ranking helpers, compact card trust signals, localized detail trust rows, and metadata-only admission checks.
- Added `src/lib/marketplace-policy.test.ts` from the brief and executed the required red/green TDD cycle.

TDD Evidence:
1. Red:
   - Ran `npx vitest run src/lib/marketplace-policy.test.ts`
   - Failed as expected with `Cannot find module './marketplace-policy'`.
2. Green:
   - Ran `npx vitest run src/lib/marketplace-policy.test.ts`
   - Result: `14 passed (14)`.

Notes:
- `isMarketplaceMetadataAdmitted()` intentionally evaluates explicit trust metadata without requiring full public listing structure, matching the brief’s metadata-only test case.
- No unrelated files were modified.

Commit:
- `feat: add trusted marketplace policy`

---

Fix round: review findings

What I fixed:
- Hardened `getMarketplaceAdmission()` so baseline review only admits `sourceTrust: 'T1'` or `sourceTrust: 'T2'`; missing and unknown trust values now quarantine.
- Tightened `getSkillSourceKind()` so official classification comes only from explicit `sourceKind: 'official'`, `source: 'verified'`, or an exact `owner/repo` match in `OFFICIAL_REPOS`.
- Updated detail trust copy so quarantined skills report quarantined status and no longer claim they are listed because they passed baseline review.

Red/green test evidence:
1. Red
   - Command: `npx vitest run src/lib/marketplace-policy.test.ts`
   - Summary: `3 failed | 14 passed (17)`
   - Failing cases:
     - missing or unknown source trust was still admitted
     - unrelated repo under a verified owner was classified as official
     - quarantined detail trust still rendered admitted/listed copy
2. Green
   - Command: `npx vitest run src/lib/marketplace-policy.test.ts`
   - Summary: `17 passed (17)`

Files changed:
- `src/lib/marketplace-policy.ts`
- `src/lib/marketplace-policy.test.ts`
- `.superpowers/sdd/task-1-report.md`

Self-review notes:
- Kept the quarantine reason surface unchanged and enforced the stricter gate by admitting only `T1`/`T2`.
- Updated metadata-only admission checks to use the same trust gate as the full marketplace admission path.
- Scoped the fix to the allowed files only and left unrelated marketplace filter code untouched.

---

Fix round: remaining re-review findings

What I fixed:
- Updated the exported marketplace trust contracts so badges expose `id`/`label`/`tone`, card trust exposes `sourceKind` and `admitted`, and detail trust now includes `sourceKind`, `badges`, `riskLabels`, and `quarantineReasons` alongside the existing display fields.
- Added `missing_install_path` to `MarketplaceQuarantineReasonCode` and tightened `getMarketplaceAdmission()` with an install-path gate that requires enough source structure to install from owner/repo/file path metadata.
- Reused the richer badge construction in both `buildMarketplaceCardTrust()` and `buildMarketplaceDetailTrust()` so the compact and detail trust surfaces stay aligned.

Red/green evidence:
1. Red
   - Command: `npx vitest run src/lib/marketplace-policy.test.ts`
   - Summary: `4 failed | 14 passed (18)`
   - Failing cases:
     - missing install path was still admitted
     - card trust did not expose required `sourceKind`/`admitted` fields or badge `id`/`tone`
     - detail trust did not expose `sourceKind`, `badges`, `riskLabels`, or `quarantineReasons`
2. Green
   - Command: `npx vitest run src/lib/marketplace-policy.test.ts`
   - Summary: `18 passed (18)`

Files changed:
- `src/lib/marketplace-policy.ts`
- `src/lib/marketplace-policy.test.ts`
- `.superpowers/sdd/task-1-report.md`

Self-review notes:
- Kept the new contract additive where useful, but made the required brief fields explicit and covered them with direct assertions.
- Used a shared badge builder so card/detail outputs cannot drift on badge ids, labels, or tones.
- Limited the write scope to the approved files only.

---

Fix round: final Task 1 review findings

What I fixed:
- Normalized `sourceRepository` so it returns `owner/repo` only when both segments are present; otherwise it now returns an empty string.
- Updated `installPathForSkill()` to use the required fallback order: non-empty `routePath`, then complete `owner/repo`, then non-empty `filePath`, then non-empty `id`, and finally `''`.
- Preserved the existing admission gate and `missing_install_path` quarantine reason while ensuring fully missing install metadata no longer renders `/` in detail trust output.

Red/green evidence:
1. Red
   - Command: `npx vitest run src/lib/marketplace-policy.test.ts`
   - Summary: `1 failed | 18 passed (19)`
   - Failing case: fully missing install metadata still surfaced `installPath` as `/`
2. Green
   - Command: `npx vitest run src/lib/marketplace-policy.test.ts`
   - Summary: `19 passed (19)`

Files changed:
- `src/lib/marketplace-policy.ts`
- `src/lib/marketplace-policy.test.ts`
- `.superpowers/sdd/task-1-report.md`

Self-review notes:
- Kept the fix local to path normalization helpers and detail trust output without widening the marketplace admission behavior.
- Added a regression that exercises the exact fully missing path detail case so the `missing_install_path` reason stays intact while display fields remain empty.
- Confirmed the allowed write scope was respected.

---

Fix round: final Task 1 review findings (evidence gates)

What I fixed:
- Aligned marketplace admission with `installPathForSkill()` fallback semantics so a skill is admitted when it has any non-empty install path evidence: complete `owner/repo`, non-empty `filePath`, or non-empty `id`.
- Stopped `buildMarketplaceDetailTrust()` from fabricating the last-reviewed value from `now`; it now uses `lastAuditedAt`, then `updatedAt`, then `Unknown`/`未知`.
- Relaxed `isMarketplaceMetadataAdmitted(..., { requireExplicitAdmission: true })` so explicit admission metadata requires `securityLevel`, `sourceTrust`, and `isTrustedRankingEligible`, while still rejecting blocker `riskFlags` when they are present.

Red/green evidence:
1. Red
   - Command: `npx vitest run src/lib/marketplace-policy.test.ts`
   - Summary: `5 failed | 19 passed (24)`
   - Failing cases:
     - repo-only complete `owner/repo` without `filePath` was still quarantined
     - file-path-only skill was still quarantined
     - detail trust used `now` instead of real audit/source dates
     - explicit admission metadata without `riskFlags` was rejected
2. Green
   - Command: `npx vitest run src/lib/marketplace-policy.test.ts`
   - Summary: `24 passed (24)`

Files changed:
- `src/lib/marketplace-policy.ts`
- `src/lib/marketplace-policy.test.ts`
- `.superpowers/sdd/task-1-report.md`

Self-review notes:
- Kept the install-path rule on the shared helper so admission and detail display cannot drift again.
- Added direct regressions for repo-only, file-path-only, and fully missing install metadata, plus unknown and fallback last-reviewed values.
- Scoped the work to the allowed files only.

---

Fix round: remaining Task 1 policy evidence findings

What I fixed:
- Tightened `hasUsefulPublicSourceMaterial()` so repo/name identifiers alone no longer count as public source evidence; admission now requires substantive description text, `skillMd` content, or `filePath`.
- Preserved route-based detail display for admitted skills, but stopped `buildMarketplaceDetailTrust()` from using `routePath` to mask intrinsic missing install evidence when admission includes `missing_install_path`.
- Added focused regressions for repo-only metadata being quarantined as `unstructured_source` and for route-path masking leaving quarantined detail `installPath` empty.

Red/green evidence:
1. Red
   - Command: `npx vitest run src/lib/marketplace-policy.test.ts`
   - Summary: `2 failed | 24 passed (26)`
   - Failing cases:
     - repo-only metadata was still admitted instead of quarantined as `unstructured_source`
     - detail trust still surfaced `routePath` despite intrinsic `missing_install_path`
2. Green
   - Command: `npx vitest run src/lib/marketplace-policy.test.ts`
   - Summary: `26 passed (26)`

Files changed:
- `src/lib/marketplace-policy.ts`
- `src/lib/marketplace-policy.test.ts`
- `.superpowers/sdd/task-1-report.md`

Self-review notes:
- Kept the write scope to the approved files only.
- Used the existing install-path helper for intrinsic evidence checks so admission behavior stays consistent with the detail surface.
