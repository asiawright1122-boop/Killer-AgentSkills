# Technology Stack

## Runtime & Framework
- **Framework**: Astro 5.17 (SSR mode, `output: 'server'`)
- **UI**: React 19 (islands architecture via `@astrojs/react`)
- **Styling**: Tailwind CSS 4.1 (via `@tailwindcss/vite`)
- **Language**: TypeScript 5.9
- **Build**: Vite (bundled with Astro)
- **Hosting**: Cloudflare Pages + Workers

## Cloudflare Services
| Service | Binding | Purpose |
|---------|---------|---------|
| KV `TRANSLATIONS` | d5ab5c6705774d779d9b1342eda5f9ac | 翻译缓存 |
| KV `SKILLS_CACHE` | 6130f39a06e14319b0ee4becb0d09842 | Skills 数据缓存 |
| D1 `DB` | killer-skills-db | 结构化数据持久化 |
| Workers `WORKFLOWS_SERVICE` | killer-skills-workflows | 异步工作流 |
| Vectorize `VECTORIZE` | — | 向量搜索 |
| R2 (inferred) | — | 对象存储 |

## Key Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `astro` | ^5.17.1 | Core framework |
| `react` / `react-dom` | ^19.2.4 | UI components |
| `tailwindcss` | ^4.1.18 | Styling |
| `fuse.js` | ^7.1.0 | Client-side fuzzy search |
| `better-sqlite3` | ^12.6.2 | Local D1 development |
| `nanostores` | ^1.1.0 | State management |
| `lucide-react` | ^0.563.0 | Icons |
| `react-markdown` | ^10.1.0 | Markdown rendering |
| `react-syntax-highlighter` | ^16.1.0 | Code highlighting |
| `dotenv` | ^17.2.4 | Env management |

## Dev & Testing
| Tool | Purpose |
|------|---------|
| Vitest + coverage-v8 | Unit/integration tests (222 test files) |
| Playwright | E2E testing (4 specs) |
| ESLint + Prettier | Linting + formatting |
| fast-check | Property-based testing |
| Husky + lint-staged | Git hooks |
| PM2 | Process management |

## AI Providers (for SEO/Translation)
| Provider | Model | Usage |
|----------|-------|-------|
| NVIDIA | Llama 3.3 70B Instruct | Primary AI (SEO, translation) |
| SiliconFlow | Qwen 2.5 72B | Fallback |
| OpenRouter | Gemini 2.5 Flash | Fallback |
| Cloudflare Workers AI | Llama 3.3 70B FP8 | Fallback |

## Data Files
| File | Size | Content |
|------|------|---------|
| `data/skills-cache.json` | 103 MB | 3477 skills with SEO, translations, agent analysis |
| `data/embeddings-cache.json` | 40 MB | Vector embeddings for search |
| `data/expanded-github-skills.json` | 662 KB | Raw harvested GitHub data |
| `data/sitemap-skills.json` | 308 KB | Sitemap generation data |
| `data/docs-cache.json` | 189 KB | Documentation cache |

## Monorepo Packages
| Package | Path | Purpose |
|---------|------|---------|
| `cli` | `packages/cli/` | `killer-skills` CLI tool |
| `killer-skills-manager` | `packages/killer-skills-manager/` | Skill management library |
| `og-server` | `packages/og-server/` | Open Graph image generation |
