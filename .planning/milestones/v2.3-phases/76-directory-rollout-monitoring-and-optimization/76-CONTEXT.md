# Phase 76: directory-rollout-monitoring-and-optimization - Context

## Background

Under Milestone `v2.3 Directory Rollout Monitoring and Optimization`, we focus on monitoring the organic crawler visibility, indexation status, and edge SSR response latency of newly opened multi-skill repository directories.
Previously, in Milestone v2.2, we deployed Edge routing bypasses and robots tag relaxations to index multiple skills directories (supporting repository index pages) under operator override (`OVERRIDE_EXPANSION_BOUNDARY=open`).
Now, we must establish a repeatable operator monitoring feedback loop for these repo directories and verify that crawler request volumes do not trigger performance regressions on Astro edge SSR nodes.

## Active Constraints

- **SEO-19 (Crawl & Index Monitoring)**: The current `seo-skill-indexability-report.ts` focus on individual skill paths. We need to introduce tracking for multi-skill repository directory roots (e.g. `/skills/[owner]/[repo]`) to allow operators to review their indexability and blocker status in reports.
- **REC-37 (Edge Performance Verification)**: Astro SSR execution can experience CPU cold-starts or latency spikes on Cloudflare edge worker sandboxes when crawler requests surge. We need a performance verification tool to simulate crawler traffic patterns against known repository paths in the local preview/dev environment, measuring response latency and ensuring 100% successful 200 OK outputs.
