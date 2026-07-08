# Marketplace IA Tightening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the remaining old primary category navigation with a tighter marketplace IA centered on Skills, rankings, occupations, curated collections, and installation docs.

**Architecture:** `src/lib/site-ia.ts` remains the single source of truth for Header, Footer, and marketplace featured routes. Legacy category routes stay crawlable and usable, but become compatibility bridges into Skills filters and Collections instead of top-level directory destinations.

**Tech Stack:** Astro pages/components, TypeScript shared IA module, Vitest source assertions, Playwright route audits.

## Global Constraints

- Primary public navigation is `Home / Skills / Rankings / Occupations / Collections / Install`.
- Categories remain available by URL for compatibility and SEO, but must not appear in Header/Footer primary navigation.
- Safety is expressed as review evidence, collection review notes, and policy links, not as a standalone empty-feeling top-level nav item.
- Public UI must not expose internal strategy, chain-of-thought, rollout, recovery, or implementation rationale.
- Keep edits scoped to IA, Categories bridge copy, Collections density, Footer grouping, llms-full route list, and tests.

---

### Task 1: Centralize The New Primary IA

**Files:**
- Modify: `src/lib/site-ia.ts`
- Modify: `src/components/HeaderActionsNative.astro`
- Modify: `src/components/Footer.astro`
- Modify: `src/lib/marketplace-overview.test.ts`
- Modify: `tests/pages/public-links.test.ts`
- Modify: `tests/e2e/navigation.spec.ts`
- Modify: `tests/e2e/marketplace-ui.spec.ts`

**Interfaces:**
- Produces: `getPrimaryNavItems(locale): SiteNavItem[]` with ids `home`, `skills`, `rankings`, `occupations`, `collections`, `install`.
- Consumes: existing Header/Footer/mobile drawer loops over `primaryNavItems`.

- [x] **Step 1: Update `SiteNavItem` ids and href mapping**

Replace the categories id with `collections` and add `install` mapping to `/${locale}/docs/installation`.

- [x] **Step 2: Add mobile icons for the new ids**

Use the existing `layers` icon for Collections and `book` icon for Install.

- [x] **Step 3: Refactor Footer columns**

Use primary nav as the Discover column; replace the current Personal column with Trust & Install links: review policy, official sources, install docs, CLI overview.

- [x] **Step 4: Update route/order tests**

Update source tests and e2e expectations to the new navigation order.

### Task 2: Demote Categories Into A Compatibility Bridge

**Files:**
- Modify: `src/pages/[locale]/categories/index.astro`
- Modify: `src/pages/[locale]/categories/[slug].astro`
- Modify: `src/pages/[locale]/occupations/index.astro`
- Modify: `src/pages/[locale]/occupations/[slug].astro`
- Modify: `src/pages/sitemap-static.xml.ts`
- Modify: `tests/pages/public-links.test.ts`
- Modify: `tests/e2e/marketplace-ui.spec.ts`

**Interfaces:**
- Produces: category pages with `MarketplaceSimplePage`/marketplace sections that point to Skills search and Collections.
- Consumes: existing category taxonomy and overview data.

- [x] **Step 1: Rewrite Categories index copy**

Title it as a compatibility/filter page, not a primary directory.

- [x] **Step 2: Change category cards to route into Skills filters first**

Cards should link to `/${locale}/skills?category=<id>` and include a secondary link to the legacy category URL only where needed.

- [x] **Step 3: Remove Categories from occupation page actions**

Occupation pages should point to Skills, Rankings, and Collections.

- [x] **Step 4: Remove `/categories` from static sitemap**

Keep dynamic category pages accessible, but stop presenting the category index as a top static route.

### Task 3: Reduce Collections Page Density

**Files:**
- Modify: `src/pages/[locale]/collections/index.astro`
- Modify: `tests/pages/public-links.test.ts`

**Interfaces:**
- Produces: a collections index that shows a small recommended set first and moves the full list behind a compact secondary section.

- [x] **Step 1: Limit primary collection cards**

Show at most 8 P0/P1 collections in the first grid.

- [x] **Step 2: Convert remaining collections into compact links**

Use smaller row/list styling instead of full cards for the long tail.

- [x] **Step 3: Keep Next Steps focused**

Next steps stay Install Docs, Solutions, and Skills.

### Task 4: Update Machine-Readable Route Lists

**Files:**
- Modify: `src/pages/llms-full.txt.ts` or current `src/pages/llms-full.txt`
- Modify: `tests/pages/llms-full.txt.test.ts`

**Interfaces:**
- Produces: llms-full route table with Collections and Install instead of Categories.

- [x] **Step 1: Update route table copy**

Replace Categories with Collections and Install.

- [x] **Step 2: Update tests**

Assert the new route table and keep collection detail URLs excluded.

### Task 5: Verify, Commit, Push, Deploy

**Files:**
- Modify: only files changed in Tasks 1-4.

**Interfaces:**
- Produces: deployed Worker version.

- [x] **Step 1: Run focused tests**

Run `npx vitest run tests/pages/public-links.test.ts tests/pages/llms-full.txt.test.ts src/lib/marketplace-overview.test.ts`.

- [x] **Step 2: Run format, typecheck, build**

Run `npm run format:check`, `npm run typecheck`, and `npm run build`.

- [ ] **Step 3: Commit and push**

Commit as `feat: tighten marketplace navigation ia` and push `main`.

- [ ] **Step 4: Deploy and smoke test**

Run `npm run deploy`, then curl `/zh`, `/zh/collections`, `/zh/categories`, `/zh/docs/installation`, `/robots.txt`, and `/sitemap.xml`.
