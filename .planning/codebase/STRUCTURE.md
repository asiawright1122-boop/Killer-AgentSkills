# Directory Structure

## High-Level Layout
The project follows a monorepo-lite design that splits concerns between the web frontend, local ETL data pipelines, and workflow automation.

### Frontend (`src/`)
- `src/components/`: Astro components that deal with layout, UI blocks, headers, and SEO properties (e.g., `SkillTryBox.astro`, `Header.astro`).
- `src/islands/`: Interactive React components compiled exclusively for client-side hydration (e.g., `SubmitSkillModal.tsx`, `WebTerminal.tsx`).
- `src/layouts/`: Baseline shells ensuring global styles, web font preloads, and Astro view transitions (`Layout.astro`).
- `src/pages/`: Astro routing controllers.
  - `src/pages/api/`: Edge serverless functions acting as lightweight backend routes (e.g., form submissions).
  - `src/pages/[locale]/`: The core dynamic router handling internationalized content routes.
  - Sitemaps (`src/pages/*.xml.ts`): Highly optimized dynamically generated sitemap indices.
- `src/lib/`: Core service logic, adapters for Cloudflare D1/KV, and shared configuration.
- `src/messages/`: JSON translation dictionaries.
- `src/content/`: Managed Astro content collections spanning Markdown blogs to structured JSON schemas.

### ETL & Tasks (`scripts/`)
- `scripts/`: Holds imperative `tsx` and shell scripts controlling AI content harvesting, KV synchronizations, automated Github deployments, crawler scripts, and massive bulk search-engine submissions.

### DevSecOps (`.github/workflows/`)
- `.github/workflows/`: Full suite of deeply integrated CI/CD workflows spanning QA validation (`ci.yml`), DB syncing (`data-pipeline.yml`), and bot automations (`i18n-update.yml`).

## Naming Conventions
- React Client Components use `PascalCase.tsx`.
- Astro components use `PascalCase.astro`.
- General utilities use `kebab-case.ts`.
- Sub-category routes map directly to URL paths.
