# Phase 107 Context — Authority Content Upgrade

## Decisions Reached

- **Global Navigation Link Injection (Placements)**:
  - We will inject links to the two target P0 authority pages (`Official AI Skills & Trusted Tools` and `Cursor-Compatible Skills`) directly into:
    1. **Header Navigation Menu** (`src/components/Header.astro`)
    2. **Main Sidebar** (`src/components/SkillsSidebar.astro`)
    3. **Footer Product Section** (`src/components/Footer.astro`)
  - By adding links in these key global placements, we will meet the `internal-link-support` threshold for all target pages (needs >= 3 placements for hubs/collections).
- **Multi-language Link Handling**:
  - We will resolve internationalized link names using local dictionary constructs directly within the Astro components based on `locale` to avoid touching 10+ disjointed JSON files.
- **JSON Content Enrichment**:
  - Update `src/content/collections/top-official-mcp-servers.json` (Official AI Skills & Trusted Tools) and `src/content/collections/top-cursor-mcp-servers.json` (Cursor-Compatible Skills).
  - Add explicit setup and install guidance inline, including direct CLI commands (e.g. `npx killer-skills add <owner/repo>`) and original judgment summaries.
- **Verification Gates**:
  - Locally build the Astro site (`npm run build`) and run typecheck/test verification suites to ensure compilation success.

## Key Files

| File | Role |
|------|------|
| `src/components/Header.astro` | Desktop navigation bar |
| `src/components/SkillsSidebar.astro` | Sidebar filter navigation |
| `src/components/Footer.astro` | Page footer links |
| `src/content/collections/top-official-mcp-servers.json` | JSON backend for Official AI Skills |
| `src/content/collections/top-cursor-mcp-servers.json` | JSON backend for Cursor-Compatible Skills |
| `src/lib/authority-surface-public-data.ts` | Public metadata configuration for scorecard |
