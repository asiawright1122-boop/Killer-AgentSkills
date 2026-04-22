# Phase 45: provider-resilience-under-recovery-guardrails - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Source:** Phase `44` recovery scorecard, latest AI config / health artifacts, current fallback routing logic, and the existing Workers AI `free-only` contract

<domain>
## Phase Boundary

This phase formalizes the recovery-time AI provider posture so the runtime, config guard, and operator reports all agree on which backup providers are active, burst-only, or intentionally disabled.

This phase covers:

- defining an explicit backup-provider posture contract for `siliconflow`, `openrouter`, and `cloudflare`
- ensuring runtime routing respects that posture contract
- surfacing the posture contract in AI config guard, AI provider health, and the recovery scorecard
- preserving Workers AI as `free-only` with strict `60/60` guardrails

This phase does not cover:

- changing the NVIDIA-primary policy
- adding paid Workers AI usage
- fixing provider billing or replenishing SiliconFlow credits
- claiming traffic recovery has occurred
  </domain>

<decisions>
## Implementation Decisions

- **D-01:** Keep NVIDIA as the only primary provider during recovery; posture controls apply only to backup providers.
- **D-02:** Introduce explicit backup posture states: `standby`, `burst-only`, and `disabled`.
- **D-03:** Treat Cloudflare Workers AI as `burst-only` by default so free-only budget usage remains a last-resort recovery path, not a silent everyday fallback.
- **D-04:** Backup posture must be reflected in both config validation and runtime candidate eligibility; reporting alone is not enough.
- **D-05:** Recovery reporting should surface posture separately from provider health so operators can tell the difference between "configured off on purpose" and "unhealthy by accident."
  </decisions>

<specifics>
## Specific Ideas

- `scripts/lib/ai-config-guard.ts` already validates Workers AI mode, model allowlist, and `60/60` caps, making it the natural home for posture validation.
- `scripts/lib/ai.ts` and `src/lib/live-ai-runtime.ts` both construct backup candidate lists before routing, so posture can be applied with minimal change there.
- `scripts/lib/ai-provider-health.ts` already renders fallback policy, eligible backup providers, and Workers budget state; it should also render configured backup posture.
- `reports/seo/latest-recovery-scorecard.json` already carries AI runtime posture as a weekly gate, so it should inherit the new backup posture summary.
- Current latest evidence still shows SiliconFlow billing/access problems and Cloudflare parked by policy, which makes explicit posture reporting especially important.
  </specifics>

<canonical_refs>

## Canonical References

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/milestones/v1.4-phases/44-recovery-observability-and-kpi-board/44-01-SUMMARY.md`
- `.planning/milestones/v1.4-phases/44-recovery-observability-and-kpi-board/44-VERIFICATION.md`
- `reports/seo/latest-recovery-scorecard.json`
- `reports/seo/latest-ai-provider-health.json`
- `reports/seo/latest-ai-config-guard.json`
- `scripts/lib/ai.ts`
- `src/lib/live-ai-runtime.ts`
- `scripts/lib/ai-config-guard.ts`
- `scripts/lib/ai-provider-health.ts`
- `src/lib/ai-fallback-policy.ts`
- `src/lib/ai-provider-routing.ts`
- `src/lib/ai-online-provider-pool.ts`
  </canonical_refs>

---

_Phase: 45-provider-resilience-under-recovery-guardrails_
_Context gathered: 2026-04-09_
