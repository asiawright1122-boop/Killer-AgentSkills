# Phase 80: operator-profiles-and-fresh-ingestion - Context

## Background

Under Milestone `v2.7 Operator Profiles and Fresh Ingestion`, we focus on:
1. Enhancing AI provider selection control by introducing **Operator-Managed Profiles** (AIOPS-11). This will allow operators to configure environment-specific default priority settings (such as NVIDIA-first, Workers-AI fallback, or full-local override) instead of keeping global priorities hardcoded.
2. Ingesting a fresh Google Search Console Coverage Drilldown report (SEO-22). The current telemetry warning points out that the newest GSC baseline is outside the 7-day freshness SLA threshold (over 41 days stale). Loading a fresh report is required to clear GSC data blockers.

## Active Constraints

- **AIOPS-11 (Operator-Managed Profiles)**: Integrate the new `AI_OPERATOR_PROFILE` environment setting in the AI provider routing system (`src/lib/ai-provider-routing.ts` and `src/lib/ai-backup-posture.ts`). Configured profiles must support `nvidia-first`, `workers-ai-fallback`, and `openrouter-preferred` and remain audit-safe under `npm run guard:ai-config`.
- **SEO-22 (Fresh Coverage Ingestion)**: Ingest a new Coverage Drilldown file dated `2026-06-03` to satisfy the freshness SLA. Ensure the ingestion pipeline runs successfully and that down-stream recovery reports are updated.
