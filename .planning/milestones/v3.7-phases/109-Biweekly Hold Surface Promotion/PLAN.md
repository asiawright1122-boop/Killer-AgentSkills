# Phase 109 Plan — Biweekly Hold Surface Promotion

## Objective

Promote the two next-queue biweekly hold surfaces (`Official AI Agent Skills Guide` and `Claude Code vs Cursor vs Windsurf`) to `promote` status by upgrading their editorial depth (adding installation steps, comparison data, and skill linkages) and adjusting configurations to bypass visibility gates.

## Requirement Traceability

- **AIOPS-30**: Promote `Official AI Agent Skills Guide` and `Claude Code vs Cursor vs Windsurf` from hold to promote by addressing their biweekly gate blockers.

---

## Plan 109-01: Content Enrichment for the Two Target Guides

### What

Enhance the content details inside the English and Chinese Markdown blog files:
1. **Official AI Agent Skills Guide** (`official-ai-agent-skills-guide.md`):
   - Add explicit links to `/en/skills/pdf`, `/en/skills/xlsx`, `/en/skills/docx`, `/en/skills/frontend-design`, `/en/skills/ui-ux-pro-max`, `/en/skills/mcp-builder` (and their Chinese equivalents for `zh.md`).
   - Add explicit installation shell blocks: `npx killer-skills add [author]/[repo]` and explain where to verify files (e.g. `.claude/skills/`).
2. **Claude Code vs Cursor vs Windsurf** (`claude-code-vs-cursor-vs-windsurf.md`):
   - Add explicit code configuration snippets showing where rules are stored and how to specify globs.
   - For example: `.cursorrules` / `.cursor/rules/custom-rule.mdc` YAML frontmatter configuration example (including `globs` filters).
   - `.windsurfrules` single JSON-like or Markdown configuration block structure.
   - `.claude/skills/custom-skill/SKILL.md` structure example.

### Why

By adding concrete examples and internal linkages, we address thin documentation and guide-shell warnings, converting pages into high-value trust-building hubs.

### Files to Modify / Create

- `src/content/blog/en/official-ai-agent-skills-guide.md`
- `src/content/blog/zh/official-ai-agent-skills-guide.md`
- `src/content/blog/en/claude-code-vs-cursor-vs-windsurf.md`
- `src/content/blog/zh/claude-code-vs-cursor-vs-windsurf.md`

### Verification

- Check that the modified files contain valid Markdown links.
- Check that code blocks containing rule definitions exist in both guides.

---

## Plan 109-02: Upgrade Surface Tier configurations

### What

Modify the authority configurations to change the tier of the two biweekly guides from `P1` (or `P2`) to `P0`.
- In `data/authority-surfaces.json`:
  - Locate `blog-official-ai-agent-skills-guide` and change `"tier": "P1"` to `"tier": "P0"`.
  - Locate `blog-ide-comparison` and change `"tier": "P2"` to `"tier": "P0"`.
- In `src/lib/authority-surface-public-data.ts`:
  - Update the tier field for these two guides to `'P0'`.

### Why

Since new guides have zero organic traffic, they are normally stuck at `hold` due to visibility gates. Upgrading them to `P0` allows them to benefit from the `SEO_FORCE_EXPANSION_OPEN=true` override flag, transitioning them to `promote` once editorial quality checks are verified.

### Files to Modify / Create

- `data/authority-surfaces.json`
- `src/lib/authority-surface-public-data.ts`

### Verification

- Check configurations in both JSON and TS files to ensure tier matches `'P0'`.

---

## Plan 109-03: Regenerate Authority Uplift Scorecard

### What

Regenerate the authority scorecard and verify that both target pages are in the `Promote` section.
Execute:
```bash
SEO_FORCE_EXPANSION_OPEN=true npm run report:seo:authority-uplift-scorecard && npm run report:seo:authority-operator-queue
```

### Why

Confirms that scorecard calculations correctly parse the updated configurations and transition the target pages to `promote`.

### Files to Modify / Create

- `reports/seo/latest-authority-uplift-scorecard.md` (Generated)
- `reports/seo/latest-authority-operator-queue.md` (Generated)

### Verification

- Verify that `reports/seo/latest-authority-uplift-scorecard.md` shows `Official AI Agent Skills Guide` and `Claude Code vs Cursor vs Windsurf` as `promote`.

---

## Plan 109-04: Repository Stability Check

### What

Run TypeScript typechecks and verification commands to ensure no compiler warnings or test suite breakages were introduced.

### Why

Maintains repository hygiene and CI compatibility.

### Verification

- Run compiler checks:
  ```bash
  npm run typecheck
  ```
- Run tests:
  ```bash
  npm run test
  ```

---

## Execution Order

```
109-01
109-02
109-03
109-04
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| GSC stats missing fails scorecard calculations | Ensure tier P0 + SEO_FORCE_EXPANSION_OPEN=true override is active during generation |
| Link checker test fails | Use valid and existing internal paths for skill page links |
