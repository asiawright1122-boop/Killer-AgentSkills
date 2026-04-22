---
phase: 32-workers-free-only-and-fallback-guards
plan: 01
type: plan
wave: 1
depends_on:
  - 31-01
files_modified:
  - ".planning/ROADMAP.md"
  - ".planning/STATE.md"
  - ".planning/milestones/v1.1-phases/32-workers-free-only-and-fallback-guards/32-CONTEXT.md"
  - ".planning/milestones/v1.1-phases/32-workers-free-only-and-fallback-guards/32-PLAN.md"
  - ".planning/milestones/v1.1-phases/32-workers-free-only-and-fallback-guards/32-01-SUMMARY.md"
  - ".planning/milestones/v1.1-phases/32-workers-free-only-and-fallback-guards/32-VERIFICATION.md"
  - "scripts/lib/ai.ts"
  - "scripts/lib/ai.test.ts"
  - "scripts/lib/ai-provider-health.ts"
  - "scripts/lib/ai-provider-health.test.ts"
  - "reports/seo/latest-ai-provider-health.json"
  - "reports/seo/latest-ai-provider-health.md"
autonomous: true
requirements:
  - AIOPS-03
  - AIOPS-04
must_haves:
  truths:
    - "Workers AI free-only limits remain enforced with run-level evidence preserved across checkpoint resume."
    - "Backup providers do not silently activate without an explicit routing policy and recorded activation reason."
    - "Provider-health outputs expose the routing policy and fallback activation evidence in machine-readable form."
  artifacts:
    - path: "reports/seo/latest-ai-provider-health.json"
      provides: "Machine-readable provider health including fallback policy and Workers AI audit evidence"
    - path: "reports/seo/latest-ai-provider-health.md"
      provides: "Operator-facing summary of fallback policy and Workers AI budget state"
---

# Phase 32 Plan 01: Free-Only Workers and Explicit Fallback Routing

<objective>
Harden AI routing so Workers AI stays provably inside free-only limits and backup providers only activate under explicit, auditable conditions.

Purpose: turn provider routing posture into enforceable runtime policy instead of relying on implicit list ordering.
Output: runtime routing guards, stronger telemetry evidence, and updated provider-health output.
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/milestones/v1.1-phases/32-workers-free-only-and-fallback-guards/32-CONTEXT.md
@.planning/milestones/v1.1-phases/31-provider-telemetry-and-alerting/31-01-SUMMARY.md
@scripts/lib/ai.ts
@scripts/build-skills-cache.ts
@scripts/lib/ai-provider-health.ts
@scripts/lib/ai.test.ts
@scripts/lib/ai-provider-health.test.ts
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Harden Workers AI free-only audit evidence</name>
  <action>Preserve Workers AI run-level counters across checkpoint restore, expose explicit budget state/block reason in telemetry, and ensure provider-health outputs surface that evidence.</action>
  <acceptance_criteria>Resumable runs cannot reset Workers AI run cap evidence, and reports can explain whether Workers AI is available, blocked by run cap, blocked by daily cap, or disabled by policy.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Add explicit backup-routing policy and activation reasons</name>
  <action>Introduce an explicit fallback policy layer so non-NVIDIA providers remain cold by default, activate only under guarded conditions, and emit telemetry events with concrete reasons whenever they are used.</action>
  <acceptance_criteria>Backup providers are no longer silently appended into rotation by default, and every activation is machine-readable with provider plus reason.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Extend provider-health outputs and regression coverage</name>
  <action>Update provider-health reporting and tests to cover cold backup mode, guarded fallback activation, Workers AI resume evidence, and threshold-safe reporting.</action>
  <acceptance_criteria>Operator and JSON outputs explain the active routing policy, recent fallback activations, and Workers AI budget evidence, with tests covering the new guardrails.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run scripts/lib/ai.test.ts scripts/lib/ai-provider-health.test.ts`
- `npx tsc --noEmit --pretty false`
- `npm run report:ai:health -- --limit=20 --fail-on=critical`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
Workers free-only routing and backup-provider activation are both explicit, enforced, and visible in the shared provider-health contract.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.1-phases/32-workers-free-only-and-fallback-guards/32-01-SUMMARY.md`
</output>
