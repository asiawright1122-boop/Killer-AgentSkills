# AI Runtime Operator Guide

Date: 2026-04-08

## Goal

This project now treats AI provider routing as a shared runtime concern instead of a per-entrypoint convention.
The current design is intended to reduce repeated `429` failures, spread NVIDIA traffic across multiple keys,
fallback in a controlled order, and keep Workers AI locked to free-only usage.

## Current Topology

Shared routing primitives:

- `src/lib/ai-fallback-policy.ts`
- `src/lib/ai-provider-routing.ts`
- `src/lib/ai-online-provider-pool.ts`
- `src/lib/live-ai-runtime.ts`

Primary consumers of the shared runtime:

- `src/lib/nvidia.ts`
- `src/pages/api/translate.ts`
- `src/pages/api/skills/try.ts`
- `workers/lib/ai-runtime.ts`
- `workers/translation-workflow.ts`
- `workers/content-workflow.ts`

Script-side orchestration:

- `scripts/lib/ai.ts`

The script runtime still keeps its own:

- telemetry snapshots and checkpoint restore
- retry loop and event stream
- Cloudflare Workers AI free-only budget gate
- NVIDIA quarantine / cooldown / hard-disable policies

This split is intentional. The shared layer decides which online provider should be tried first.
The script layer still owns batch-job operational controls.

## Provider Order

Normal order:

1. NVIDIA
2. SiliconFlow
3. OpenRouter

Workers AI is not part of the paid fallback chain. It is a constrained free-only last-resort path inside `AIService`.

## Key Inputs

NVIDIA keys can be supplied through:

- `NVIDIA_API_KEYS`
- `NVIDIA_API_KEY`
- `NVIDIA_API_KEYS_2`
- `NVIDIA_API_KEYS_3`
- `NVIDIA_API_KEYS_4`
- `NVIDIA_API_KEYS_5`

Backups:

- `SILICONFLOW_API_KEY`
- `OPENROUTER_API_KEYS`
- `OPENROUTER_API_KEY`

Shared online-provider model overrides:

- `NVIDIA_MODEL`
- `SILICONFLOW_MODEL`
- `OPENROUTER_MODEL`

Context-specific overrides:

- `TRANSLATE_MODEL_NVIDIA|SILICONFLOW|OPENROUTER`
- `SKILL_TRY_MODEL_NVIDIA|SILICONFLOW|OPENROUTER`

Workers AI guardrails:

- `WORKERS_AI_MODE=free-only|disabled`
- `WORKERS_AI_FREE_MODEL`
- `WORKERS_AI_FREE_MAX_CALLS`
- `WORKERS_AI_FREE_DAILY_MAX_CALLS`
- `WORKERS_AI_FREE_MAX_TOKENS`

Any `WORKERS_AI_MODE` value other than `free-only` or `disabled` is treated as invalid and forced back to `free-only`.
`WORKERS_AI_FREE_MODEL` is also allowlisted so free-only mode cannot be silently repointed at a larger Workers AI model through env drift.

## 429 Handling Model

NVIDIA:

- multiple keys rotate through label-based candidates (`N0`, `N1`, ...)
- unhealthy labels are deprioritized by shared routing
- `AIService` can quarantine a single NVIDIA label after repeated retryable failures or `429`
- guarded fallback opens only when NVIDIA is unavailable or not configured

SiliconFlow and OpenRouter:

- only activated when fallback policy allows it
- shared routing orders them by workload profile
- current default backup order keeps SiliconFlow ahead of OpenRouter for balanced, interactive, and batch work
- shared runtime and probe paths now resolve OpenRouter through `OPENROUTER_MODEL` and default to `google/gemini-2.5-flash` instead of hardcoding a `:free` model
- public `skill try` traffic still stays on an explicit allowlist and defaults to `google/gemma-3-27b-it:free`, so demo traffic cannot inherit a broader global model override by accident
- backup providers that return `401`, `402`, or `403` are hard-disabled for the current runtime so the loop does not keep retrying a broken credential or empty-balance path

Workers AI:

- must stay `free-only` or `disabled`
- `429` on Workers AI is treated as a stop signal for the run, not as an invitation to spend more
- repeated retryable failures can hard-disable Workers AI for the current run

## Operational Entry Points

Preflight config validation:

- `scripts/ai-config-guard.ts`
- `reports/seo/latest-ai-config-guard.json|md`

Runtime probe with telemetry snapshot:

- `scripts/ai-runtime-probe.ts`

Telemetry aggregation and health report:

- `scripts/ai-provider-health.ts`
- `scripts/ai-telemetry-report.ts`
- `scripts/ai-telemetry-trend.ts`

Legacy direct provider health probe:

- `scripts/ai-provider-probe.ts`
- `scripts/health-skill-providers.mjs` (compatibility wrapper)

The direct provider probe still talks directly to provider APIs on purpose.
It is an operator diagnostic tool, not part of the application runtime path.
It now expands every configured NVIDIA key and OpenRouter key so operators can see which labels are healthy versus rate-limited.
Workers AI is intentionally excluded from the default probe so the free-only budget is not consumed by diagnostics.

Probe artifacts now split into two operator views:

- `reports/seo/latest-ai-provider-probe.json|md` for the latest direct snapshot
- `reports/seo/latest-ai-provider-probe-trend.json|md` for recent direct-probe history across archived runs

Use the trend artifact to distinguish a one-off `429` burst from repeated rate limiting on the same label or backup provider.
Use the config-guard artifact to verify which model each scope resolved to before blaming quota or routing.

Fresh runtime probe coverage:

- `.github/workflows/data-pipeline.yml` now refreshes the runtime probe before generating provider health
- `.github/workflows/ci.yml` also invokes the probe, but it safely skips when no provider credentials are configured
- `scripts/run-pipeline.sh` now refreshes the runtime probe before enforcing the AI health gate

If a probe is skipped and the reports fall behind, telemetry trend and provider health reports now surface a stale-checkpoint warning instead of silently treating old data as current.

## What Was Reduced In This Pass

- duplicate NVIDIA / SiliconFlow / OpenRouter candidate construction was moved into `src/lib/ai-online-provider-pool.ts`
- `src/lib/live-ai-runtime.ts` now consumes the shared provider-pool builder
- `scripts/lib/ai.ts` now consumes the same provider-pool builder while keeping its batch-only controls

This reduces drift risk between live endpoints and script pipelines when adding keys, changing rotation, or updating fallback order.

## Fast 429 Triage

When `429` resurfaces, check in this order:

1. Run the config guard to confirm fallback policy and Workers AI mode are valid.
2. Inspect the latest AI telemetry summary for which labels are cooling down, quarantined, or hard-disabled.
3. Confirm how many NVIDIA keys are actually present at runtime, not just in local env files.
4. Check whether fallback policy is `cold`, `guarded`, or `always`.
5. Check telemetry freshness before trusting the report. A stale checkpoint warning means you are looking at old runtime evidence.
6. Check the direct probe trend to see whether the same NVIDIA or backup label has been repeatedly rate-limited, billing-blocked, or unreachable.
7. Verify Workers AI was not silently expected to absorb paid overflow. It will not.

## Intentional Exceptions

Remaining direct provider URLs found in the repo are currently expected in these places:

- `src/lib/live-ai-runtime.ts`
- `scripts/lib/ai.ts`
- `scripts/lib/ai-provider-probe.ts`

The first two are runtime executors.
The last one is an explicit direct-to-provider health probe.

If new direct provider calls are added outside these paths, they should be treated as architecture drift and reviewed.
