---
phase: 45-provider-resilience-under-recovery-guardrails
plan: 01
type: plan
wave: 1
depends_on: []
files_modified:
  - '.planning/ROADMAP.md'
  - '.planning/REQUIREMENTS.md'
  - '.planning/STATE.md'
  - '.planning/milestones/v1.4-phases/45-provider-resilience-under-recovery-guardrails/45-CONTEXT.md'
  - '.planning/milestones/v1.4-phases/45-provider-resilience-under-recovery-guardrails/45-PLAN.md'
  - '.planning/milestones/v1.4-phases/45-provider-resilience-under-recovery-guardrails/45-01-SUMMARY.md'
  - '.planning/milestones/v1.4-phases/45-provider-resilience-under-recovery-guardrails/45-VERIFICATION.md'
  - 'src/lib/ai-backup-posture.ts'
  - 'src/lib/ai-backup-posture.test.ts'
  - 'scripts/lib/ai-config-guard.ts'
  - 'scripts/lib/ai-config-guard.test.ts'
  - 'scripts/lib/ai-provider-health.ts'
  - 'scripts/lib/ai-provider-health.test.ts'
  - 'scripts/lib/ai.ts'
  - 'scripts/lib/ai.test.ts'
  - 'src/lib/live-ai-runtime.ts'
  - 'reports/seo/latest-ai-config-guard.md'
  - 'reports/seo/latest-ai-config-guard.json'
  - 'reports/seo/latest-ai-provider-health.md'
  - 'reports/seo/latest-ai-provider-health.json'
  - 'reports/seo/latest-recovery-scorecard.md'
  - 'reports/seo/latest-recovery-scorecard.json'
requirements:
  - AIOPS-11
autonomous: true
must_haves:
  truths:
    - 'Backup providers can be intentionally put into standby, burst-only, or disabled posture without silently changing runtime behavior.'
    - 'Workers AI remains provably constrained to the free-only envelope and is treated as a last-resort backup rather than an invisible everyday fallback.'
    - 'Operator-facing AI and recovery reports show posture and health together so degraded providers are visible and auditable.'
  artifacts:
    - path: 'reports/seo/latest-ai-config-guard.json'
      provides: 'Machine-readable provider posture and Workers guardrail contract'
    - path: 'reports/seo/latest-ai-provider-health.json'
      provides: 'Operator-facing provider health plus configured backup posture'
    - path: 'reports/seo/latest-recovery-scorecard.json'
      provides: 'Recovery board that now carries explicit provider posture context'
---

# Phase 45 Plan 01: Provider Resilience Under Recovery Guardrails

<objective>
Formalize the recovery-time provider posture contract so AI runtime resilience stays explicit without relaxing NVIDIA-primary routing or Workers AI `free-only` protection.

Purpose: remove ambiguity between "backup is available", "backup is intentionally parked", and "backup is unhealthy" while keeping recovery reporting truthful and auditable.
Output: posture-aware config validation, posture-aware runtime backup selection, refreshed AI health artifacts, and a recovery scorecard that exposes backup posture alongside SEO recovery status.
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/milestones/v1.4-phases/45-provider-resilience-under-recovery-guardrails/45-CONTEXT.md
@reports/seo/latest-recovery-scorecard.json
@reports/seo/latest-ai-provider-health.json
@reports/seo/latest-ai-config-guard.json
@scripts/lib/ai.ts
@src/lib/live-ai-runtime.ts
@scripts/lib/ai-config-guard.ts
@scripts/lib/ai-provider-health.ts
@src/lib/ai-fallback-policy.ts
@src/lib/ai-provider-routing.ts
@src/lib/ai-online-provider-pool.ts
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Add explicit backup posture contract</name>
  <action>Introduce a reusable backup-provider posture model and validate it in AI config guard.</action>
  <acceptance_criteria>Config guard can describe and validate `standby`, `burst-only`, and `disabled` posture for each backup provider, while keeping Cloudflare compatible with Workers AI `free-only` policy.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Enforce posture in runtime selection</name>
  <action>Apply provider posture when constructing backup candidates in both script runtime and live runtime routing paths.</action>
  <acceptance_criteria>Disabled backups are excluded from eligibility and burst-only backups stay behind standby backups without affecting NVIDIA-primary routing.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Surface posture in operator reports</name>
  <action>Refresh AI config / health / recovery scorecard artifacts so backup posture is visible wherever operators inspect recovery status.</action>
  <acceptance_criteria>AI health and recovery scorecard both show configured backup posture alongside existing health evidence and Workers budget guardrails.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run src/lib/ai-backup-posture.test.ts scripts/lib/ai-config-guard.test.ts scripts/lib/ai-provider-health.test.ts scripts/lib/operator-ops-summary.test.ts scripts/lib/recovery-scorecard.test.ts src/lib/ai-provider-routing.test.ts scripts/lib/ai.test.ts`
- `npx tsx scripts/ai-config-guard.ts`
- `npx tsx scripts/ai-provider-health.ts`
- `npx tsx scripts/seo-recovery-scorecard.ts`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
Recovery-time provider posture is now explicit, enforced, and visible from config guard through the weekly recovery scorecard.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.4-phases/45-provider-resilience-under-recovery-guardrails/45-01-SUMMARY.md`
</output>
