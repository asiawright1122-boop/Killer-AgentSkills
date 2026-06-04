---
phase: 91-environment-specific-profiles-integration
requirements_completed:
  - AIOPS-12
---

# Verification: Phase 91 (Environment-Specific Profiles Integration)

## Automated Unit Tests
- Execute vitest suite against the fallback posture and provider routing tests to ensure compatibility and correct routing output:
  ```bash
  npx vitest run src/lib/ai-backup-posture.test.ts src/lib/ai-provider-routing.test.ts
  ```

## Test Scenarios to Verify
1. **Invalid JSON profile**: Ensuring `parseCompositeOperatorProfile` handles syntactically broken JSON and returns `null`.
2. **Missing Env Overrides**: Resolve fallback priority correctly when `AI_OPERATOR_PROFILES_JSON` is missing, defaulting to the global `AI_OPERATOR_PROFILE` setting.
3. **Environment/Workload Matching**: In production context under `harvest` workload, assert priority orders resolve `openrouter` (or custom preferred target) over `cloudflare`.
4. **Environment/Workload Fallback**: When matching a workload not specified in the environment's configuration, verify it falls back to the environment-level `default` profile.
