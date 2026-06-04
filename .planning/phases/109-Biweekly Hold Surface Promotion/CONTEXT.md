# Phase 109 Context — Biweekly Hold Surface Promotion

## Decisions Reached

- **Focus Surfaces**: The target promotion pages are two biweekly priority hold surfaces: `Official AI Agent Skills Guide` (`blog-official-ai-agent-skills-guide`) and `Claude Code vs Cursor vs Windsurf` (`blog-ide-comparison`).
- **Content Upgrades**:
  - For the **Official AI Agent Skills Guide**, we will enrich the content with concrete skill link mappings (e.g., links to first-party documentation of `pdf`, `xlsx`, `docx`, `frontend-design`, `ui-ux-pro-max`, `mcp-builder`), verified CLI installation steps (`npx killer-skills add [slug]`), and clear usage examples.
  - For the **IDE Comparison Guide**, we will add concrete technical syntax examples for rules definitions (e.g., `.cursorrules`/`.mdc` glob matching configurations, `.windsurfrules` single-file layouts, and `.claude/skills` directory setups), and details about loading mechanics.
- **Uplift Scorecard Strategy**: Since these pages are biweekly and currently lack organic GSC traffic (impressions/clicks = 0), they would naturally fail visibility and ranking gates. To confirm their promotion readiness based on content quality, we will upgrade their tier from `P1`/`P2` to `P0` in the authority configuration files and verify their state using the `SEO_FORCE_EXPANSION_OPEN=true` environment override.

## Scope of Phase 109

- Upgrade English and Chinese blog source files for the two guides to resolve copy blockers and thin guidance warnings.
- Update `data/authority-surfaces.json` and `src/lib/authority-surface-public-data.ts` to reflect the updated P0 tiering and configurations.
- Regenerate the authority uplift scorecard and verify that both target pages transition to `promote` status.

## Key Files

| File | Role |
|------|------|
| `src/content/blog/en/official-ai-agent-skills-guide.md` | English Official Skills Guide |
| `src/content/blog/zh/official-ai-agent-skills-guide.md` | Chinese Official Skills Guide |
| `src/content/blog/en/claude-code-vs-cursor-vs-windsurf.md` | English IDE Comparison Guide |
| `src/content/blog/zh/claude-code-vs-cursor-vs-windsurf.md` | Chinese IDE Comparison Guide |
| `data/authority-surfaces.json` | Placements and authority configurations |
| `src/lib/authority-surface-public-data.ts` | Shared public data for authority pages |
