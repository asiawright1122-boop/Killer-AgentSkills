---
wave: 1
depends_on: []
files_modified:
  - src/messages/en.json
autonomous: true
---

# Phase 137 Plan: Authority Uplift & Metadata Optimization

This phase optimizes the Search Console metadata (titles, descriptions) of core P0 primary authority surfaces in English to drive click-through rate (CTR) and nurture a second promote surface.

## Tasks

### Task 1: Optimize English Homepage Metadata in src/messages/en.json

<read_first>
- [en.json](file:///Users/kaka/Dev/Killer-Skills/src/messages/en.json) (under the `"Home"` object)
</read_first>

<acceptance_criteria>
- `src/messages/en.json` contains `"Home.seoTitle"` set to `"Killer-Skills: 3,400+ AI Agent Skills & MCP Servers"`.
- `src/messages/en.json` contains `"Home.seoDescription"` set to `"Discover, compare, and install 3,400+ verified AI agent skills and Model Context Protocol (MCP) servers for Claude Code, Cursor, Windsurf, and 19+ IDEs."`.
</acceptance_criteria>

<action>
Modify the values for the `"seoTitle"` and `"seoDescription"` keys under the `"Home"` namespace inside `src/messages/en.json`.
</action>

---

### Task 2: Optimize English Collections Hub Metadata in src/messages/en.json

<read_first>
- [en.json](file:///Users/kaka/Dev/Killer-Skills/src/messages/en.json) (under the `"Collections"` object)
</read_first>

<acceptance_criteria>
- `src/messages/en.json` contains `"Collections.seoTitle"` set to `"Curated AI Agent Skill Collections — Killer-Skills"`.
- `src/messages/en.json` contains `"Collections.seoDescription"` set to `"Compare curated collections of official, trusted, and workflow-specific AI agent skills for Claude Code, Cursor, and Windsurf to accelerate development."`.
</acceptance_criteria>

<action>
Modify the values for the `"seoTitle"` and `"seoDescription"` keys under the `"Collections"` namespace inside `src/messages/en.json`.
</action>

---

### Task 3: Execute Public Surface and System Verification

<read_first>
- [package.json](file:///Users/kaka/Dev/Killer-Skills/package.json)
</read_first>

<acceptance_criteria>
- `npm run typecheck` passes with no compilation errors.
- `npm run validate:public-surface` passes with 0 copy-leakage or formatting issues.
- `npm test` passes all unit and integration tests successfully.
- `npm run build` generates the production Astro output bundle successfully.
</acceptance_criteria>

<action>
Run the verification scripts in order:
1. Check types: `npm run typecheck`
2. Check copy guidelines: `npm run validate:public-surface`
3. Check test suites: `npm test`
4. Compile bundle: `npm run build`
</action>
