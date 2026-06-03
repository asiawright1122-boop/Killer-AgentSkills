# Phase 78: directory-analytics-and-scaling-escalation - Context

## Background

Under Milestone `v2.5 Directory Automation Escalation and Post-Rollout Analytics`, we focus on establishing post-rollout analytics tracking and setting up protective autoscale/alert gates for edge rendering nodes when facing search crawler spikes or traffic surges.
Now that repository directories are fully indexed and crawl-ready, we must:
1. Track how end-users and crawlers interact with these directory surfaces to gather post-rollout engagement analytics (SEO-21).
2. Protect Cloudflare Workers edge nodes from CPU time exhaustion or API quota breaches by implementing request-density monitoring, adaptive throttling, and static-fallback scaling alerts (REC-39).

## Active Constraints

- **SEO-21 (Directory Analytics Tracking)**: Implement a server-side event tracking helper in Astro SSR context. This tracking should capture locale, repository key (owner/repo), and user-agent type (separating organic human users from known crawlers) without relying on bloated client-side scripts.
- **REC-39 (Edge Rendering Auto-Scaling & Alerts)**: Establish a request-density monitor in the edge middleware to evaluate spikes. If rendering density exceeds predefined thresholds (e.g. 500 requests/min per IP or 5000 requests/min globally), trigger alert actions (such as logging warnings to D1 database and executing fallback static-pages routing).
