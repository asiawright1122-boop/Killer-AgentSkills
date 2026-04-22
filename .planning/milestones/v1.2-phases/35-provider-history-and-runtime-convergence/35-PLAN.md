---
phase: 35-provider-history-and-runtime-convergence
plan: 01
type: plan
wave: 1
depends_on:
  - 32-01
files_modified:
  - ".planning/ROADMAP.md"
  - ".planning/STATE.md"
  - ".planning/REQUIREMENTS.md"
  - ".planning/milestones/v1.2-phases/35-provider-history-and-runtime-convergence/35-CONTEXT.md"
  - ".planning/milestones/v1.2-phases/35-provider-history-and-runtime-convergence/35-PLAN.md"
  - ".planning/milestones/v1.2-phases/35-provider-history-and-runtime-convergence/35-01-SUMMARY.md"
  - ".planning/milestones/v1.2-phases/35-provider-history-and-runtime-convergence/35-VERIFICATION.md"
  - "scripts/lib/ai.ts"
  - "scripts/lib/ai.test.ts"
  - "scripts/lib/ai-provider-health.ts"
  - "scripts/lib/ai-provider-health.test.ts"
  - "scripts/lib/ai-telemetry-trend.ts"
  - "src/lib/ai-fallback-policy.ts"
  - "src/lib/ai-fallback-policy.test.ts"
  - "src/pages/api/skills/try.ts"
  - "src/pages/api/skills/try.test.ts"
  - "reports/seo/latest-ai-provider-health.md"
  - "reports/seo/latest-ai-provider-health.json"
autonomous: true
requirements:
  - AIOPS-05
  - AIOPS-07
must_haves:
  truths:
    - "Provider-health artifacts expose longer-window provider history and ranking guidance instead of only current snapshot order."
    - "Longer-window routing guidance never bypasses explicit fallback policy or Workers AI free-only guardrails."
    - "The skill-try API route and script-side AI runtime share one runtime-safe fallback and ranking contract with regression coverage for repeated-429 scenarios."
  artifacts:
    - path: "reports/seo/latest-ai-provider-health.json"
      provides: "Machine-readable provider ranking and history guidance that remains policy-safe"
    - path: "reports/seo/latest-ai-provider-health.md"
      provides: "Operator-facing explanation of current provider order, historical instability, and fallback posture"
---

# Phase 35 Plan 01: Provider History and Runtime Convergence

<objective>
Turn the current provider-health lane into a longer-window routing foundation and eliminate the remaining fallback-policy split between the script runtime and `src/pages/api/skills/try.ts`.

Purpose: absorb NVIDIA 429 volatility more intelligently without weakening the existing cost and fallback constraints.
Output: shared runtime-safe routing helpers, longer-window provider-health guidance, and aligned regression coverage across script and API surfaces.
</objective>

<execution_context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/milestones/v1.2-phases/35-provider-history-and-runtime-convergence/35-CONTEXT.md
@.planning/milestones/v1.1-MILESTONE-AUDIT.md
@scripts/lib/ai.ts
@scripts/lib/ai-provider-health.ts
@scripts/lib/ai-telemetry-trend.ts
@src/lib/ai-fallback-policy.ts
@src/pages/api/skills/try.ts
@scripts/lib/ai.test.ts
@scripts/lib/ai-provider-health.test.ts
@src/lib/ai-fallback-policy.test.ts
@src/pages/api/skills/try.test.ts
@reports/seo/latest-ai-provider-health.json
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Extract a runtime-safe provider ranking and fallback contract</name>
  <action>Create or extend pure shared helpers that can evaluate fallback posture, longer-window provider guidance, and selection ordering without depending on the full Node-side `AIService` implementation.</action>
  <acceptance_criteria>Both the script runtime and the skill-try API route can import one common contract for fallback eligibility and ranking guidance, while keeping NVIDIA primary and Workers AI `free-only` intact.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Wire the shared contract into script routing and skill-try runtime</name>
  <action>Update `scripts/lib/ai.ts` and `src/pages/api/skills/try.ts` so longer-window history influences current provider ordering consistently, with repeated-429 behavior covered under the same routing semantics.</action>
  <acceptance_criteria>`skills/try` and the script-side runtime no longer drift on healthy NVIDIA, unavailable NVIDIA, or repeated-429 routing scenarios.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Extend provider-health outputs and regression coverage</name>
  <action>Expose the new ranking and history guidance in provider-health Markdown + JSON artifacts, then add regression tests for ranking, fallback gating, and route/runtime convergence.</action>
  <acceptance_criteria>Operators can see why current ranking looks the way it does, and tests cover the new longer-window guidance plus shared routing behavior.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run scripts/lib/ai.test.ts scripts/lib/ai-provider-health.test.ts src/lib/ai-fallback-policy.test.ts src/pages/api/skills/try.test.ts`
- `npm run report:ai:health -- --limit=20 --fail-on=critical`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
The repository has one policy-safe routing contract for both the script runtime and the skill-try API route, and provider-health artifacts explain longer-window ranking without hiding fallback controls.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.2-phases/35-provider-history-and-runtime-convergence/35-01-SUMMARY.md`
</output>
