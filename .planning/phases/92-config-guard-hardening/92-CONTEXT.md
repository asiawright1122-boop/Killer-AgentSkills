# Context: Phase 92 (Config Guard Hardening)

## Objective
Harden the compilation-time and pre-build configuration guard by verifying that any composite environment profiles defined under `AI_OPERATOR_PROFILES_JSON` are syntactically and semantically valid, and that no profile definitions bypass cost-containment rules.

## Scope
- Update [ai-config-guard.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/ai-config-guard.ts) to parse and validate `AI_OPERATOR_PROFILES_JSON`.
- Perform Schema conformance check on the JSON contents:
  - Verify keys represent allowed environment names.
  - Verify values map to supported `AIOperatorProfileName` settings.
- Enforce check to align both single and composite configs with `VALID_OPERATOR_PROFILES` (integrating `budget` and `speed` profiles).
- Enforce check that billing-dependent backup routes (e.g. SiliconFlow, OpenRouter) are blocked under explicit free-only constraint environments.

## Target Files
- [ai-config-guard.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/ai-config-guard.ts)
- [ai-config-guard.test.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/ai-config-guard.test.ts)

## Success Criteria
1. Invalid JSON or invalid profile configurations are caught by `inspectAiConfigGuard()` and flagged with exit code 1.
2. Building or compiling with a broken `AI_OPERATOR_PROFILES_JSON` config causes the command to fail.
3. Unit tests cover configuration issues with 100% assertions passed.
