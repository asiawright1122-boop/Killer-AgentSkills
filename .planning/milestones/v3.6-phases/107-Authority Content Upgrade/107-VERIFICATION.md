---
phase: 107-authority-content-upgrade
requirements_completed:
  - AIOPS-28
---

# Verification: Phase 107 (Authority Content Upgrade)

## Verification Steps
- Check that link placements have been injected successfully:
  - Check links in `src/components/Header.astro`.
  - Check links in `src/components/SkillsSidebar.astro`.
  - Check links in `src/components/Footer.astro`.
- Check that JSON configuration files parse correctly and contain upgraded metadata:
  - Inspect `src/content/collections/top-official-mcp-servers.json`.
  - Inspect `src/content/collections/top-cursor-mcp-servers.json`.
- Run typecheck, unit tests, and production build checks:
  ```bash
  npm run typecheck
  npm run test
  npm run build
  ```

## Expected Outcomes
- High-visibility sitewide links to the two target P0 authority collections are now injected, resolving `internal-link-support` failures.
- JSON content has been enriched with npx install commands and original descriptions.
- `npm run typecheck` reports 0 errors.
- `npm run test` reports 935 passed tests.
- `npm run build` compiles cleanly with no static prerendering or adapter errors.
