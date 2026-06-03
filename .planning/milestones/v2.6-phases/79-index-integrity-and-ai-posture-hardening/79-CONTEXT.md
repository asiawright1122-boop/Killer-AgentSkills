# Phase 79: index-integrity-and-ai-posture-hardening - Context

## Background

Under Milestone `v2.6 Index Alignment and AI Posture Hardening`, we focus on resolving index divergence between the sitemap and indexable cache, and addressing AI configuration posture/telemetry warnings.
Now that the directory routes have evolved, we must:
1. Address sitemap/cache index divergence (REC-40) to ensure that the search engine indexability rules are perfectly consistent between sitemap generation and cache verification.
2. Hardening AI provider fallback configurations (AIOPS-12) to handle failures or billing issues elegantly (especially SiliconFlow account balance depletion), enforcing safe default routing.

## Active Constraints

- **REC-40 (Sitemap and Cache Alignment)**: Ensure that the active sitemap skills exactly match the cache state. We must resolve logic divergence by tightening canonical assessment evaluation and incorporating appropriate sitemap public skill checks.
- **AIOPS-12 (AI Posture Hardening)**: Ensure that provider status behaves correctly. Under SiliconFlow account billing warning, SiliconFlow should be dynamically set to `disabled` without raising uncaught exceptions, and Workers AI must remain a free-only last-resort fallback.
