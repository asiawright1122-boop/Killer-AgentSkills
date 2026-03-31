# External Integrations

## Cloudflare Platform
| Service | Files | Purpose |
|---------|-------|---------|
| Pages | `wrangler.toml`, `astro.config.mjs` | Site hosting + SSR |
| KV | `src/lib/kv.ts` | Translations + Skills cache |
| D1 | `db/seeds/`, `scripts/sync-d1-delta.ts` | Structured data (skills, admin) |
| Workers | `workers/index.ts` | 3 async workflows |
| Vectorize | `scripts/generate-embeddings.ts` | Semantic search |
| Workers AI | `scripts/lib/ai.ts` (Llama 3.3 70B) | SEO generation fallback |

## AI API Providers
- **NVIDIA** (`integrate.api.nvidia.com`) — Primary SEO/translation, Llama 3.3 70B
- **SiliconFlow** (`api.siliconflow.cn`) — Qwen 2.5 72B
- **OpenRouter** (`openrouter.ai/api`) — Gemini 2.5 Flash
- **All configured via** `scripts/lib/ai.ts`, race strategy (Promise.any)

## GitHub API
| Feature | Files |
|---------|-------|
| Skill harvesting | `scripts/harvest-github-skills.ts` |
| Repo metadata | `src/lib/github.ts` |
| Webhook verification | `workers/index.ts` |
| GitHub Actions | `.github/workflows/*.yml` |

## Search Engine Integrations
| Engine | Files | Method |
|--------|-------|--------|
| Google Search Console | `scripts/gsc-*.ts` | OAuth2, Search Analytics API |
| IndexNow | `scripts/submit-indexnow.mjs` | POST API |
| Baidu Push | `scripts/submit-baidu.mjs` | URL Push API |
| Google Indexing | `scripts/submit-google.mjs` | Indexing API |
| Bing Webmasters | via IndexNow | Automatic |

## Directory Submitters
- **Auto-submitter system**: `scripts/auto-submitter/src/`
  - Automated submission to AI tool directories
  - Auth setup: `scripts/auto-submitter/src/auth-setup.ts`
  - Discovery: `scripts/auto-submitter/src/discover.ts`

## Sitemaps
| File | Content |
|------|---------|
| `sitemap.xml.ts` | Index (links to sub-sitemaps) |
| `sitemap-skills-[page].xml.ts` | Skills pages (paginated) |
| `sitemap-blog.xml.ts` | Blog posts |
| `sitemap-collections.xml.ts` | Collection pages |
| `sitemap-docs.xml.ts` | Documentation |
| `sitemap-static.xml.ts` | Static pages |
| `sitemap-owners-[page].xml.ts` | Owner/repo pages |

## LLM Integration
- `llms.txt.ts` — Structured data for LLM crawlers
- `llms-full.txt.ts` — Full skill directory dump for LLM training
