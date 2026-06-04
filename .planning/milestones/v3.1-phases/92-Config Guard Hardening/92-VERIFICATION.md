---
phase: 92-config-guard-hardening
requirements_completed:
  - AIOPS-13
---

# Verification: Phase 92 (Config Guard Hardening)

## Automated Unit Tests
- Execute configuration guard unit tests:
  ```bash
  npx vitest run scripts/lib/ai-config-guard.test.ts
  ```

## Manual Verification
1. **Broken JSON Check**:
   - Set a broken environment config:
     ```bash
     AI_OPERATOR_PROFILES_JSON='{"production": {"harvest": "invalid-profile-name"}}' npx tsx scripts/ai-config-guard.ts --stdout-only
     ```
   - Assert exit status code is 1, and the report flags the failure.
2. **Valid JSON Check**:
   - Set a correct composite configuration:
     ```bash
     AI_OPERATOR_PROFILES_JSON='{"production": {"default": "nvidia-first", "harvest": "openrouter-preferred"}}' npx tsx scripts/ai-config-guard.ts --stdout-only
     ```
   - Assert exit status code is 0, and the status reports `pass`.
