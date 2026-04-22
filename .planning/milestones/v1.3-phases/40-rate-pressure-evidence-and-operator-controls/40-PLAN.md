---
phase: 40-rate-pressure-evidence-and-operator-controls
plan: 01
type: plan
wave: 1
depends_on:
  - 39-01
files_modified:
  - ".planning/ROADMAP.md"
  - ".planning/REQUIREMENTS.md"
  - ".planning/STATE.md"
  - ".planning/milestones/v1.3-phases/40-rate-pressure-evidence-and-operator-controls/40-CONTEXT.md"
  - ".planning/milestones/v1.3-phases/40-rate-pressure-evidence-and-operator-controls/40-PLAN.md"
  - ".planning/milestones/v1.3-phases/40-rate-pressure-evidence-and-operator-controls/40-01-SUMMARY.md"
  - ".planning/milestones/v1.3-phases/40-rate-pressure-evidence-and-operator-controls/40-VERIFICATION.md"
  - "src/lib/ai-provider-routing.ts"
  - "scripts/lib/ai.ts"
  - "scripts/lib/ai-provider-health.ts"
  - "src/pages/api/skills/try.ts"
  - "src/lib/ai-provider-routing.test.ts"
  - "scripts/lib/ai.test.ts"
  - "scripts/lib/ai-provider-health.test.ts"
requirements:
  - AIOPS-09
autonomous: true
must_haves:
  truths:
    - "Provider 429 and cooldown pressure becomes part of shared routing evidence instead of only a trailing warning."
    - "Operators can see label/provider-level routing reasons when historical pressure is influencing runtime posture."
    - "Runtime surfaces remain aligned on guarded recovery behavior under noisy NVIDIA conditions."
---

# Phase 40 Plan 01: Rate-pressure Evidence and Operator Controls

<objective>
Promote historical 429 and cooldown pressure into shared routing evidence and guarded operator controls.

Purpose: make provider-volatility warnings actionable without silently widening fallback behavior.
Output: richer provider-pressure evidence, aligned guarded recovery behavior, and verification coverage.
</objective>

<execution_context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/milestones/v1.3-phases/40-rate-pressure-evidence-and-operator-controls/40-CONTEXT.md
@.planning/milestones/v1.3-phases/39-workload-aware-provider-routing-and-budget-guards/39-01-SUMMARY.md
@src/lib/ai-provider-routing.ts
@scripts/lib/ai.ts
@src/pages/api/skills/try.ts
@scripts/lib/ai-provider-health.ts
@reports/seo/latest-ai-provider-health.md
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Define provider-pressure evidence contract</name>
  <action>Promote 429/cooldown pressure into shared routing metadata or evidence so operators can tell which labels or providers are driving degraded posture.</action>
  <acceptance_criteria>Routing and health outputs expose actionable provider-pressure context at label/provider level.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Align guarded recovery behavior</name>
  <action>Use that pressure evidence to keep script runtime and `skills/try` aligned on guarded recovery semantics under noisy NVIDIA conditions.</action>
  <acceptance_criteria>Both runtime surfaces apply the same guarded pressure logic and remain explicit about why fallback did or did not activate.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Verify operator visibility</name>
  <action>Add regression coverage and operator-report verification so the new provider-pressure evidence is visible, stable, and reviewable.</action>
  <acceptance_criteria>Tests and operator-facing artifacts prove that pressure history is actionable rather than only summarized as a warning.</acceptance_criteria>
</task>

</tasks>
