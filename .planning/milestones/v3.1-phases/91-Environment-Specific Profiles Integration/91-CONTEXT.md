# Context: Phase 91 (Environment-Specific Profiles Integration)

## Objective
Establish a flexible, operator-managed AI provider routing system that dynamically resolves backup priorities based on the current Node/Cloudflare environment and the workload class of the execution context, closing the AIOPS-12 gap.

## Scope
- Extend `src/lib/ai-backup-posture.ts` and `src/lib/ai-provider-routing.ts` to support environment-specific defaults and workload class overrides.
- Establish a schema representation (both hardcoded config and JSON parsing via environment variable `AI_OPERATOR_PROFILES_JSON`) supporting composite profiles.
- Refactor the fallback order resolution to look up overrides under: `Active Environment -> Workload Class -> Preferred Profile Name`.

## Dependencies
- Shipped `v3.0` milestone database structure and runtime routes.
- Pre-existing vitest execution sandbox.

## Target Files
- [ai-backup-posture.ts](file:///Users/kaka/Dev/Killer-Skills/src/lib/ai-backup-posture.ts)
- [ai-provider-routing.ts](file:///Users/kaka/Dev/Killer-Skills/src/lib/ai-provider-routing.ts)

## Success Criteria
1. The AI provider router selects the correct backup order under `production` and `development` environment profiles.
2. The compilation logic falls back safely to default profiles if no JSON override or env configuration is present.
3. Unit tests prove environment-specific priority routing is evaluated correctly.
