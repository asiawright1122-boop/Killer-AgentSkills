# Technology Stack

## Core Technologies
- **Framework**: [Astro](https://astro.build/) (v5.17+) supporting hybrid SSR/SSG.
- **UI Libraries**: [React](https://react.dev/) (v19.2) integrated via `@astrojs/react`.
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (v4.1.18) with `@tailwindcss/vite` and typography plugins.
- **Language**: TypeScript (v5.9.3) natively configured across the monorepo-style setup.

## Cloud & Edge Architecture
- **Adapter**: Cloudflare Pages (`@astrojs/cloudflare` v12.6.12).
- **Database**: Cloudflare D1 (managed via SQLite adapters `better-sqlite3`).
- **Cache / Storage**: Cloudflare KV.
- **Execution CLI**: Wrangler (CF deployment).

## Advanced Capabilities
- **In-Browser Compute**: WebContainers API (`@webcontainer/api` v1.6.1) for live sandbox terminals.
- **Terminal Rendering**: Xterm.js (`@xterm/xterm` v6.0) used alongside `@xterm/addon-fit`.
- **Search Engine**: Local fuzzy indexing powered by `fuse.js` (v7.1).
- **Markdown Processing**: `react-markdown` paired with `remark-gfm` for robust GitHub-flavored rendering.
- **State Management**: `nanostores` (v1.1) and `@nanostores/react` for framework-agnostic atom states.

## Build Tools & DX
- **Testing**:
  - Unit/Integrations: Vitest (`@vitest/coverage-v8`).
  - End-to-End: Playwright (`@playwright/test` v1.58.2).
- **Code Quality**:
  - ESLint with TypeScript and Astro plugins (`eslint-plugin-astro`, `typescript-eslint`).
  - Prettier for formatting (`prettier-plugin-astro`).
  - Git Hooks: `husky` and `lint-staged` with strict `--max-warnings 0` constraints.
- **Scripting Execution**: `tsx` for on-the-fly TypeScript automation scripts.
