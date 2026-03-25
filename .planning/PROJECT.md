# Killer-Skills — Project Overview

## Mission
Killer-Skills.com is an AI Agent Skill discovery platform. It indexes SKILL.md-based skills from GitHub, serving developers who use Claude Code, Cursor, Windsurf, and other AI coding assistants.

**Core SEO theme: Programming tools × AI Agent Skills × Developer workflows**

## Current Milestone: v1.0 — Theme Integrity & SEO Precision

### Problem Statement (discovered 2026-03)
3319 skills in index. Analysis revealed:
- **1046 skills** had SEO fields but zero theme terms in keywords
- **2108 skill titles** were truncated (`...` ending) — need regeneration
- **369 skill titles** had no theme identifier at all
- **Root cause**: `isSkillFullyOptimized()` was marking skills as done without verifying theme compliance in keywords/titles, causing AI regeneration to be skipped
- **Secondary cause**: AI prompt rules existed but `sanitizeSeoKeywordList()` returned generic tech keywords without injecting theme terms
- **Tertiary cause**: No positive keyword gate at ingestion — any SKILL.md passing structural checks could enter the index

## Architecture
See `.planning/codebase/ARCHITECTURE.md` for full system map.

**Key pipeline:**
```
GitHub → harvest-github-skills.ts → build-skills-cache.ts (AI enrich) → sync-to-kv.ts / sync-d1-delta.ts → Cloudflare KV + D1 → SSR pages
```

## Key Files
- `src/lib/shared/validation.ts` — shared validation & scoring (runs in Workers + Node)
- `scripts/build-skills-cache.ts` — main AI enrichment pipeline
- `scripts/lib/ai.ts` — AIService: SEO generation, translations, sanitization
- `scripts/harvest-github-skills.ts` — GitHub crawler
- `data/skills-cache.json` — local dev cache (3319 skills)
- `data/terminology-glossary.json` — canonical term translations
