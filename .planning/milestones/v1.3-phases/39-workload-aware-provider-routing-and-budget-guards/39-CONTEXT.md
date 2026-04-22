# Phase 39: workload-aware-provider-routing-and-budget-guards - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Source:** `v1.2` operator reports, current routing helpers, script AI runtime, and the live `skills/try` route

<domain>
## Phase Boundary

This phase introduces workload-aware provider routing while preserving explicit fallback policy and Workers AI `free-only` constraints.

This phase covers:
- defining workload classes or profiles that can influence provider order
- propagating workload-aware routing through both script runtime and `skills/try`
- preserving Workers AI `free-only` allowlists, caps, and blocked reasons under workload-aware routing

This phase does not cover:
- 429 pressure escalation logic beyond the baseline routing contract
- external remediation issue / PR automation
- milestone phase archive / restore automation
</domain>

<decisions>
## Implementation Decisions

- **D-01:** Reuse `src/lib/ai-provider-routing.ts` and `src/lib/ai-fallback-policy.ts` as the shared routing contract instead of creating runtime-specific policy code.
- **D-02:** Keep NVIDIA primary by default; workload classes may tune ordering and eligibility, but they must not silently widen backup-provider usage.
- **D-03:** Workers AI remains a conservative `free-only` option even if a workload profile would otherwise prefer a broader fallback pool.
</decisions>

<specifics>
## Specific Ideas

- Current candidate ordering only considers generic health metrics (`consecutive429s`, retryable failures, successes, rotation order) and does not accept workload-specific intent.
- The latest AI health report is healthy in the current snapshot but still warns on historical NVIDIA volatility, which suggests routing needs clearer operator-aware pressure handling.
- `skills/try` and the script runtime now share fallback semantics, making Phase 39 the right place to extend the common routing contract instead of branching it again.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/PROJECT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `src/lib/ai-provider-routing.ts`
- `src/lib/ai-fallback-policy.ts`
- `scripts/lib/ai.ts`
- `src/pages/api/skills/try.ts`
- `reports/seo/latest-ai-provider-health.md`
- `reports/seo/latest-ops-summary.md`
</canonical_refs>

---

*Phase: 39-workload-aware-provider-routing-and-budget-guards*
*Context gathered: 2026-04-07*
