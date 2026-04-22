# Killer-Skills

The open directory for AI Agent Skills, IDE-native skill installation, and reusable automation workflows.

面向 AI Agent Skills、IDE 原生技能安装与可复用自动化工作流的开放目录。

🌍 **[Website / 官网](https://killer-skills.com)**

---

## 🚀 Stack & Features

| Layer          | Technology                                                     |
| -------------- | -------------------------------------------------------------- |
| **Framework**  | [Astro 5.0](https://astro.build) — SSR with React Islands      |
| **Deployment** | [Cloudflare Pages](https://pages.cloudflare.com) Advanced Mode |
| **Styling**    | TailwindCSS 4.0                                                |
| **Database**   | Cloudflare D1 (SQLite) + KV (`SKILLS_CACHE`, `TRANSLATIONS`)   |
| **Search**     | Cloudflare Vectorize + Workers AI (semantic search)            |
| **i18n**       | Native Astro i18n (10 locales) + Cloudflare AI Translation     |
| **CI/CD**      | GitHub Actions — ESLint, Prettier, Vitest (hard gates)         |
| **CLI**        | `killer-skills` — install, sync, and manage skills from terminal |

**Key capabilities:**

- Universal IDE support (Cursor, Windsurf, VS Code, Copilot)
- React ErrorBoundary protection on all client islands
- Structured API error handling with `ApiError` class
- Health check endpoint (`/api/health`) for KV & D1 monitoring
- Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy)

---

## 📂 Project Structure

```
killer-skills/
├── src/
│   ├── pages/              # File-based routing (Astro)
│   │   ├── [locale]/       # Localized pages (en, zh, ja, ko, ...)
│   │   └── api/            # API routes (skills, search, health, admin)
│   ├── components/         # Astro server components
│   ├── islands/            # React client islands (hydrated on demand)
│   │   ├── ErrorBoundary.tsx
│   │   ├── SearchBar.tsx
│   │   ├── SkillReadme.tsx
│   │   ├── SkillActions.tsx
│   │   └── SkillFileManager.tsx
│   ├── lib/                # Core logic
│   │   ├── kv.ts           # KV & D1 data access layer
│   │   ├── skills.ts       # Unified skill loading & caching
│   │   ├── search.ts       # Search utilities
│   │   ├── api-utils.ts    # Structured API error handling
│   │   ├── favorites.ts    # Client-side favorites (localStorage)
│   │   └── history.ts      # Client-side browsing history
│   ├── stores/             # Nanostores (shared state for islands)
│   ├── messages/           # i18n translation files (*.json)
│   └── middleware.ts       # Locale detection, auth, security headers
├── packages/
│   ├── cli/                # Killer-Skills CLI tool
│   └── og-server/          # Open Graph image generator
├── scripts/                # Automation (cache build, skill discovery)
└── data/                   # Static data (official repos config)
```

---

## 🛠️ Development

### Prerequisites

- **Node.js** 20+
- **npm** (or pnpm)
- **Cloudflare Wrangler CLI** (for local KV/D1 bindings)

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start dev server (with Cloudflare bindings via wrangler)
npm run dev

# 3. Run tests
npm test

# 4. Lint & format
npm run lint
npm run format:check
```

### Available Scripts

| Script                                      | Description                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`                               | Start Astro dev server with Wrangler proxy                                   |
| `npm run build`                             | Production build                                                             |
| `npm run deploy`                            | Deploy to Cloudflare Pages                                                   |
| `npm test`                                  | Run Vitest unit & integration tests                                          |
| `npm run test:e2e`                          | Run Playwright E2E tests                                                     |
| `npm run lint`                              | ESLint check (zero warnings enforced)                                        |
| `npm run lint:fix`                          | ESLint auto-fix                                                              |
| `npm run format`                            | Prettier format all files                                                    |
| `npm run format:check`                      | Prettier check (CI gate)                                                     |
| `npm run build:cache`                       | Build skill cache from GitHub                                                |
| `npm run audit:seo:index-integrity`         | Audit sitemap/data drift, collection locale coverage, and thin-content risks |
| `npm run audit:seo:index-quality`           | Strict SEO quality gate: fail on missing/thin skill content                  |
| `npm run report:seo:collection-locale-gaps` | Export collection locale coverage gaps report                                |

---

## 🧪 Testing

- **Framework**: [Vitest](https://vitest.dev/) with coverage via `@vitest/coverage-v8`
- **Tests**: 292 tests across 24 files
- **Coverage**: ~50% global, 74% for `src/lib/`

```bash
# Run all tests
npm test

# Run with coverage report
npx vitest run --coverage

# Run specific test file
npx vitest run src/lib/skills.test.ts
```

### CI Hard Gates

All PRs must pass:

1. **ESLint** — zero warnings (`--max-warnings 0`)
2. **Prettier** — format check
3. **Vitest** — all tests pass

---

## 🔌 API Endpoints

| Endpoint                           | Method | Description                      |
| ---------------------------------- | ------ | -------------------------------- |
| `/api/health`                      | GET    | Health check (KV, D1 latency)    |
| `/api/skills`                      | GET    | List all skills (paginated)      |
| `/api/skills/search`               | GET    | Search skills by query           |
| `/api/skills/submit`               | POST   | Submit a new skill               |
| `/api/skills/[owner]/[repo]`       | GET    | Get machine-readable skill metadata |
| `/api/skills/[owner]/[repo]/files` | GET    | List repository helper files     |
| `/api/skills/[owner]/[repo]/file`  | GET    | Read a repository helper file    |
| `/api/search`                      | GET    | Semantic search (Vectorize + AI) |
| `/api/categories`                  | GET    | List skill categories            |
| `/api/translate`                   | GET    | AI translation                   |

Public API routes are a machine-readable helper surface for apps and automation. They are intentionally served as `noindex`; use the public site pages on `killer-skills.com` as the canonical human-readable content surface.

---

## 🌍 Internationalization

Supported locales: `en`, `zh`, `ja`, `ko`, `es`, `fr`, `de`, `pt`, `ru`, `ar`.

- Translation files: `src/messages/*.json`
- Runtime translations cached in Cloudflare KV (`TRANSLATIONS`)
- Locale detection: Cookie → CF-IPCountry → Accept-Language → default (`en`)
---

## 📄 License

MIT © Killer-Skills Inc.
