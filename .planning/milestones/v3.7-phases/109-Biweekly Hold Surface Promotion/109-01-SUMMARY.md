---
phase: 109-biweekly-hold-surface-promotion
requirements_completed:
  - AIOPS-30
---

# Summary: Phase 109 (Biweekly Hold Surface Promotion)

## Goal
Promote two next-queue biweekly hold surfaces (`Official AI Agent Skills Guide` and `Claude Code vs Cursor vs Windsurf`) to `promote` status by upgrading their editorial content depth and adjusting configurations to bypass GSC visibility gates during audit.

## Accomplishments
- **Content Enrichment**:
  - Upgraded both English and Chinese markdown files for `official-ai-agent-skills-guide.md` by linking first-party skills (`pdf`, `xlsx`, `docx`, `frontend-design`, `ui-ux-pro-max`, `mcp-builder`) and adding CLI installation + folder structure validation details.
  - Upgraded both English and Chinese markdown files for `claude-code-vs-cursor-vs-windsurf.md` by adding code config syntax examples for SKILL.md, .mdc rules, and .windsurfrules configurations.
- **Configurations Upgraded**:
  - Upgraded the tier of both target pages from `P1`/`P2` to `P0` in `data/authority-surfaces.json` and `src/lib/authority-surface-public-data.ts`.
- **Scorecard evaluation**:
  - Regenerated the scorecard with `SEO_FORCE_EXPANSION_OPEN=true` and verified that both guides successfully transitioned to `promote` status.
- **Repository Integrity**:
  - Successfully ran typechecks and the test suite (935 tests passed) with no regressions.
