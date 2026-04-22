---
phase: 39-workload-aware-provider-routing-and-budget-guards
plan: 01
type: plan
wave: 1
depends_on: []
files_modified:
  - ".planning/PROJECT.md"
  - ".planning/ROADMAP.md"
  - ".planning/REQUIREMENTS.md"
  - ".planning/STATE.md"
  - ".planning/milestones/v1.3-phases/39-workload-aware-provider-routing-and-budget-guards/39-CONTEXT.md"
  - ".planning/milestones/v1.3-phases/39-workload-aware-provider-routing-and-budget-guards/39-PLAN.md"
  - ".planning/milestones/v1.3-phases/39-workload-aware-provider-routing-and-budget-guards/39-01-SUMMARY.md"
  - ".planning/milestones/v1.3-phases/39-workload-aware-provider-routing-and-budget-guards/39-VERIFICATION.md"
  - "src/lib/ai-provider-routing.ts"
  - "src/lib/ai-fallback-policy.ts"
  - "scripts/lib/ai.ts"
  - "src/pages/api/skills/try.ts"
  - "src/lib/ai-provider-routing.test.ts"
  - "src/pages/api/skills/try.test.ts"
  - "scripts/lib/ai.test.ts"
requirements:
  - AIOPS-08
  - AIOPS-10
autonomous: true
must_haves:
  truths:
    - "Workload class can influence provider order in one shared routing contract without bypassing explicit fallback policy."
    - "Workers AI remains provably constrained to the free-only envelope under workload-aware routing."
    - "Script runtime and skills/try stay aligned on routing semantics and operator-visible reasoning."
---

# Phase 39 Plan 01: Workload-aware Provider Routing and Budget Guards

<objective>
Introduce workload-aware provider routing while preserving explicit fallback policy and Workers AI `free-only` guardrails.

Purpose: turn the current provider-volatility watchlist into explicit operator-controlled routing behavior rather than relying on generic health ordering alone.
Output: shared workload-aware routing contract, runtime wiring, and verification coverage.
</objective>

<execution_context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/milestones/v1.3-phases/39-workload-aware-provider-routing-and-budget-guards/39-CONTEXT.md
@src/lib/ai-provider-routing.ts
@src/lib/ai-fallback-policy.ts
@scripts/lib/ai.ts
@src/pages/api/skills/try.ts
@reports/seo/latest-ai-provider-health.md
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Define workload-aware routing contract</name>
  <action>Add a shared workload-profile input to provider routing so different workloads can influence ordering and eligibility without branching runtime logic.</action>
  <acceptance_criteria>Both runtime surfaces can resolve provider order from the same workload-aware routing helper.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Preserve Workers free-only safety under workload routing</name>
  <action>Thread workload-aware routing through Workers AI guardrails so allowlists, caps, and blocked reasons remain explicit and testable.</action>
  <acceptance_criteria>Workload-aware routing cannot cause Workers AI to exceed the existing free-only contract or silently widen paid usage.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Verify runtime parity and operator evidence</name>
  <action>Add regression coverage and operator-visible reasoning so `scripts/lib/ai.ts` and `skills/try` stay aligned on workload-aware routing behavior.</action>
  <acceptance_criteria>Tests and operator-facing outputs prove routing parity and explain the applied workload profile.</acceptance_criteria>
</task>

</tasks>
