# Phase 4: Keyword Research Integration — PLAN-01

## Objective
Inject proven seed keywords into the AI SEO pipeline so every generated keyword set clusters around high-intent, theme-aligned search terms. Maximum organic traffic from the AI agent / Claude Code / Cursor / Windsurf niche.

---

## 4a. Create `data/seed-keywords.json`

**File**: `data/seed-keywords.json`

Structure: categories → array of seed terms. Used by the AI prompt and by `sanitizeSeoKeywordList` fallback injection.

```json
{
  "navigational": [
    "claude code skills", "claude code agent skills", "cursor rules", "cursorrules",
    "windsurf skills", "windsurf rules", "killer-skills", "killer skills mcp"
  ],
  "informational": [
    "ai coding agent workflow", "mcp server tools", "ai agent skill installation",
    "how to install claude code skills", "agentic workflow automation",
    "claude code mcp integration", "cursor ai productivity"
  ],
  "transactional": [
    "install agent skill", "claude code skill setup", "cursor skill install",
    "windsurf skill setup", "mcp server install", "skill installation guide"
  ],
  "long_tail": [
    "claude code playwright automation skill", "cursor github copilot alternative",
    "windsurf mcp server workflow", "ai agent skill for developers",
    "claude code sql database skill", "cursor react component skill",
    "mcp server for claude code", "ai agent code review skill"
  ],
  "theme_anchors": [
    "AI agent skill", "agent skill", "claude code", "cursor", "windsurf",
    "MCP", "mcp server", ".claude", "skill installation", "agentic"
  ]
}
```

**Acceptance criteria**: File exists, valid JSON, ≥5 entries per category.

---

## 4b. Inject Seed Keywords into AI SEO Prompt

**File**: `scripts/lib/ai.ts`

**Change**: In the `enPrompt` (line ~761), replace the static keyword examples in section F with dynamic examples drawn from `seed-keywords.json`.

Current section F:
```
### F. Keywords (6-10 items)
MUST include theme terms. Use: "capability + technology" format.
GOOD: "playwright browser automation", "claude code mcp server", "notion workflow sync"
BAD: "how to use playwright", "what is automation"
```

New section F (inject 3 random seed examples per call):
```
### F. Keywords (6-10 items)
MUST include theme terms. Use: "capability + technology" format.
Always include at least 2 of these proven high-traffic terms (adapt to this skill's context):
  ${seedExamples}
GOOD format: "playwright browser automation", "claude code mcp server"
BAD: "how to use playwright", "what is automation"
```

**Implementation**:
1. Load `data/seed-keywords.json` at module init (top of `ai.ts`)
2. Create helper `getSeedExamples(category?: string): string` — returns 3 random theme_anchors + 2 from matching category
3. Inject into enPrompt before calling `callAI()`

**Code location**: `scripts/lib/ai.ts` line ~707 (enPrompt construction)

**Acceptance criteria**:
- `getSeedExamples()` returns formatted string with 5 seed terms
- enPrompt contains seed examples on every call
- Existing tests still pass

---

## 4c. New Long-tail Collections

**Goal**: Create 4 new collection landing pages, each a dedicated SEO target.

**Files to create** (in `src/content/collections/`):
- `top-cursor-skills.json`
- `top-windsurf-skills.json`
- `top-mcp-servers-for-claude.json`
- `top-claude-code-extensions.json`

Each collection file format (copy from `top-community-skills.json` structure):
```json
{
  "title": { "en": "...", "zh": "...", ... },
  "description": { "en": "...", "zh": "...", ... },
  "skills": ["owner/repo", ...],
  "keywords": { "en": ["cursor skills", "cursor rules", ...] }
}
```

**Skill selection for each**:
- `cursor-skills`: skills with cursor tag or cursor keyword
- `windsurf-skills`: skills with windsurf tag or windsurf keyword
- `mcp-servers-for-claude`: skills with mcp tag
- `claude-code-extensions`: skills with claude/anthropics origin

**Query to find skills**: search `data/sitemap-skills.json` for relevant tags/keywords.

**Acceptance criteria**:
- 4 new collection JSON files exist
- Each has ≥10 skills
- Each has title/description in all 10 locales
- Collection pages render without error (`astro build` passes)

---

## Execution Order

1. `[ ]` Create `data/seed-keywords.json`
2. `[ ]` Add `getSeedExamples()` helper to `scripts/lib/ai.ts`
3. `[ ]` Inject seed examples into `enPrompt`
4. `[ ]` Run `npx vitest --run` — all tests pass
5. `[ ]` Query `data/sitemap-skills.json` for skills per category
6. `[ ]` Create 4 collection JSON files
7. `[ ]` Commit: `feat(seo): Phase 4 — seed keywords + long-tail collections`

---

## Files Changed
- `data/seed-keywords.json` (new)
- `scripts/lib/ai.ts` (inject seed examples into enPrompt)
- `src/content/collections/top-cursor-skills.json` (new)
- `src/content/collections/top-windsurf-skills.json` (new)
- `src/content/collections/top-mcp-servers-for-claude.json` (new)
- `src/content/collections/top-claude-code-extensions.json` (new)
