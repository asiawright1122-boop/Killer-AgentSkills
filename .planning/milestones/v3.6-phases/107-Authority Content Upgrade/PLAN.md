# Phase 107 Plan — Authority Content Upgrade

## Objective

Inject links to target P0 authority pages (`Official AI Skills & Trusted Tools` and `Cursor-Compatible Skills`) into global placements (Header, Sidebar, Footer) to satisfy `internal-link-support` requirements. Upgrade their backend JSON configurations with explicit install commands and deep selection notes. Verify compilation success via local build and test suites.

## Requirement Traceability

- **AIOPS-28**: Upgrade the content structure of the authority pages, adding rich skill linkages and localized descriptive blocks.

---

## Plan 107-01: Inject authority page links into global placements

### What

Add navigation links targeting the two P0 pages to:
1. `src/components/Header.astro` (in desktop navigation menu).
2. `src/components/SkillsSidebar.astro` (in Discover or Featured section).
3. `src/components/Footer.astro` (in Product navigation links).

### Why

Satisfies the scorecard's `internal-link-support` check by routing structural sitewide inner links to these authority entry points, raising crawler visibility and funneling organic user flows.

### Files to Modify / Create

- Modify: `src/components/Header.astro`
- Modify: `src/components/SkillsSidebar.astro`
- Modify: `src/components/Footer.astro`

### Files to Read

- `src/components/Header.astro`
- `src/components/SkillsSidebar.astro`
- `src/components/Footer.astro`

### Verification

1. Build the Astro project locally and verify compilation succeeds.
2. Verify visually or in code that pages load and contain the correct links.

---

## Plan 107-02: Upgrade metadata content for target collections

### What

Refine content details and add explicit CLI installation commands in:
1. `src/content/collections/top-official-mcp-servers.json`
2. `src/content/collections/top-cursor-mcp-servers.json`

Specifically, augment selected skill items with instructions like `npx killer-skills add <owner/repo>` and add detailed review/context descriptions in `en` and `zh` translations.

### Why

Addresses the content debt hold reasons by proving original selection logic, setup guides, and team checkpoints on the target surfaces, moving them out of the generic aggregate status.

### Files to Modify / Create

- Modify: `src/content/collections/top-official-mcp-servers.json`
- Modify: `src/content/collections/top-cursor-mcp-servers.json`

### Files to Read

- `src/content/collections/top-official-mcp-servers.json`
- `src/content/collections/top-cursor-mcp-servers.json`

### Verification

1. Verify that both JSON files parse correctly.
2. Run standard validations to confirm they build successfully.

---

## Plan 107-03: Run local typechecks, unit tests, and production build checks

### What

Execute the typecheck tool, full test suites, and production build compiles.

### Why

Confirms that none of the layout, script, or JSON content changes break Astro rendering, TypeScript declarations, or unit testing expectations.

### Files to Modify / Create

- None.

### Files to Read

- `package.json`

### Verification

1. Verify type safety:
   ```bash
   npm run typecheck
   ```
2. Verify unit tests:
   ```bash
   npm run test
   ```
3. Verify production compilation:
   ```bash
   npm run build
   ```

---

## Execution Order

```
107-01
107-02
107-03
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Layout styling breaks due to added link tags | Use appropriate Tailwind/CSS responsive classes (`hidden lg:flex`) to avoid breaking UI layout on smaller screens |
| JSON validation errors during build | Use JSON syntax validators and run `npm run build` after editing configuration files |
