# Requirements: v3.1 AIOps Smart Gateway & Profile Hardening

## Overview

Improve the resilience, validation strictness, and environment flexibility of the AI compilation and harvesting pipeline by merging workload-aware provider routing with environment-specific profiles (AIOPS-12). Establish config compilation-time checks to prevent billing leaks while allowing local testing, testing runs, and production setups to safely fall back under a defined policy.

## Scope

### 1. Environment-Specific Profiles Integration (Phase 91)
- **Problem**: Current AI routing overrides are global and lack grain control based on whether the runner is a background harvester, translation loop, or preview page rendering.
- **Requirement**: Extend the operator profile schema (`nvidia-first`, `workers-ai-fallback`, etc.) to support environment-specific defaults (e.g. `production`, `development`, `testing`):
  - Parse provider overrides dynamically based on the current Node/Cloudflare environment.
  - Map profile targets by workload class (e.g., `harvest`, `translate`, `interactive`).
  - Keep configuration files backwards compatible or fallback to safe defaults.
- **Verification**: Runtime lookup resolving different provider classes across environments correctly.

### 2. Config Guard Hardening (Phase 92)
- **Problem**: Incorrect profile definitions or missing authentication keys for fallback providers can cause silent failovers or build crashes.
- **Requirement**: Enhance the validation rules in `scripts/lib/ai-config-guard.ts` and `scripts/ai-config-guard.ts`:
  - Enforce schema conformity checks for any environment-specific operator profiles.
  - Assert that billing-dependent backup routes (e.g., SiliconFlow, OpenRouter) are disabled when the runner is restricted to `free-only` policy.
  - Add explicit diagnostic logs in the event of compliance check failures.
- **Verification**: Compilation/pre-build scripts successfully catch and report invalid profile overrides.

### 3. Smart Fallback & Degradation Verification (Phase 93)
- **Problem**: Testing provider failovers and cost guardrails under edge-runtime constraints is fragile.
- **Requirement**: Design a testing suite to verify mock provider degradation:
  - Unit tests asserting that when a primary provider is unavailable (mocked 429, timeout, or missing key), the router degrades strictly to the next allowed provider in the active environment profile.
  - Ensure the fallback pipeline never attempts to call locked or un-profiled fallback endpoints.
- **Verification**: Core vitest suits cover routing fallback paths under 3+ mock degradation scenarios with 100% assertions green.
