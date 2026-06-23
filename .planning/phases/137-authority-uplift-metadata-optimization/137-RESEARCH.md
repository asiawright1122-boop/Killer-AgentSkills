# Phase 137 Research: Authority Uplift & Metadata Optimization

## 1. Context & Objectives

The recovery program scorecard currently holds the discovery expansion gate in a `closed` state because the proof window trust verdict is `warning` and no primary authority surface (such as `Homepage Root Hub` or `Collections Hub`) is classified as `promote` in the latest GSC data.

Phase 137 targets the metadata and headers of these P0 primary authority surfaces to:
1. **Improve Click-Through Rate (CTR)**: Rewrite the title and meta snippets to focus on immediate developer intent (finding and installing verified AI agent skills/MCP servers).
2. **Harmonize H1 and Metadata**: Ensure H1 headers and meta titles are self-consistent and user-facing.
3. **Guard Public Copy Boundaries**: Keep the copywriting free of internal strategy leaks, caught exception internals, or operator jargon.

## 2. Current Metadata Definitions

Metadata for the dynamic locale routes is loaded from the locale messages JSON files (such as `src/messages/en.json`).

### Homepage Root Hub (`/en`)
- **Astro Entry**: `src/pages/[locale]/index.astro`
- **Current Title**: `"Home.seoTitle"` / `"AI Agent Skills Directory for Claude Code, Cursor & Windsurf"`
- **Current Description**: `"Home.seoDescription"` / `"Browse 3,400+ AI agent skills and MCP servers, compare trusted tools, and install them in Claude Code, Cursor, Windsurf, and 19+ IDEs."`
- **H1 Header**: `{t('Home.heroTitle')} {t('Home.heroTitleHighlight')}`

### Collections Hub (`/en/collections`)
- **Astro Entry**: `src/pages/[locale]/collections/index.astro`
- **Current Title**: `"Collections.seoTitle"` / `"AI Skill Collections for Claude Code, Cursor & Windsurf"`
- **Current Description**: `"Collections.seoDescription"` / `"Browse trusted AI skill collections and compare the best options for Claude Code, Cursor, Windsurf, and related workflows."`
- **H1 Header**: Uses `Collections.heroTitle` / `Curated Collections`.

## 3. Recommended Metadata Adjustments

To boost CTR, we should upgrade the English metadata snippets. We also need to review the CJK/non-English locale catalog equivalents to verify ending punctuation and character length compliance.

### English (`en.json`) Optimizations

#### Homepage (`Home`)
- **Title**:
  - *Old*: `AI Agent Skills Directory for Claude Code, Cursor & Windsurf`
  - *New*: `Killer-Skills: 3,400+ AI Agent Skills & MCP Servers`
  - *Rationale*: Puts the brand name and the total index count (`3,400+`) at the front. Explicitly highlights both "AI Agent Skills" and "MCP Servers".
- **Description**:
  - *Old*: `Browse 3,400+ AI agent skills and MCP servers, compare trusted tools, and install them in Claude Code, Cursor, Windsurf, and 19+ IDEs.`
  - *New*: `Discover, compare, and install 3,400+ verified AI agent skills and Model Context Protocol (MCP) servers for Claude Code, Cursor, Windsurf, and 19+ IDEs.`
  - *Rationale*: Stronger action verbs (`Discover, compare, and install`) and spells out "Model Context Protocol (MCP)" to capture expanded search variants.

#### Collections Hub (`Collections`)
- **Title**:
  - *Old*: `AI Skill Collections for Claude Code, Cursor & Windsurf`
  - *New*: `Curated AI Agent Skill Collections — Killer-Skills`
  - *Rationale*: Uses the Curated prefix to match user-facing quality search signals, branding suffix for domain consistency.
- **Description**:
  - *Old*: `Browse trusted AI skill collections and compare the best options for Claude Code, Cursor, Windsurf, and related workflows.`
  - *New*: `Compare curated collections of official, trusted, and workflow-specific AI agent skills for Claude Code, Cursor, and Windsurf to accelerate development.`
  - *Rationale*: Focuses on comparative trust-building (official, trusted, workflow-specific) and developmental value.

## 4. Verification Methods

1. **Syntax & Compile Safety**: Run `npm run typecheck` and `npm run build` to ensure JSON changes do not break loading.
2. **Public Surface Checks**: Execute `npm run validate:public-surface` to verify compliance with CJK punctuation rules and copy leakage boundaries.
3. **Link & Redirect Validation**: Execute `npm test` (specifically E2E public links tests) to ensure the layout still mounts correctly.
