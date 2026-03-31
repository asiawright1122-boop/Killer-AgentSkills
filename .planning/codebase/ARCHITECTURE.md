# Architecture

## Pattern: SSR Multi-tenant i18n Directory Site
Astro 5 SSR with dynamic routing per locale, backed by Cloudflare's edge infrastructure.

## System Layers

```
┌─────────────────────────────────────────────────────────┐
│  Presentation (Astro SSR + React Islands)               │
│  src/pages/[locale]/*.astro → src/components/*.tsx       │
├─────────────────────────────────────────────────────────┤
│  Data Layer (Static JSON + KV + D1)                     │
│  data/skills-cache.json → KV SKILLS_CACHE → API routes  │
├─────────────────────────────────────────────────────────┤
│  i18n Layer (11 locales)                                │
│  src/messages/*.json → src/i18n.ts → tr(key, fallback)  │
├─────────────────────────────────────────────────────────┤
│  SEO Layer (Sitemaps + Meta + Keywords)                 │
│  src/lib/seo-*.ts + src/lib/skill-seo-intent.ts         │
├─────────────────────────────────────────────────────────┤
│  Pipeline Layer (GitHub Actions → Scripts → AI → Data)  │
│  .github/workflows/* → scripts/* → scripts/lib/ai.ts    │
├─────────────────────────────────────────────────────────┤
│  Workers Layer (Async Workflows)                        │
│  workers/*.ts → translation, validation, content        │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

### Skill Discovery → Display
```
GitHub repositories → harvest-github-skills.ts → expanded-github-skills.json
                    → build-skills-cache.ts (+ AI SEO) → skills-cache.json
                    → sync-to-kv.ts → Cloudflare KV
                    → sync-d1-delta.ts → Cloudflare D1
SSR request → src/lib/kv.ts → KV read → page render
```

### Blog Content → Multilingual
```
en/*.md (source) → translate-blog.ts (AI) → {locale}/*.md
                 → sync-blog-everything.ts (metadata sync)
                 → ai-optimize-blog-meta.ts (SEO polish)
```

### UI Strings → Translation
```
en.json (source of truth) → sync-translations.ts (structure sync)
                          → translate-locales.ts (AI translation)
                          → src/i18n.ts → tr(key, fallback)
```

## Entry Points
| Type | Path | Description |
|------|------|-------------|
| SSR | `src/pages/[locale]/index.astro` | Homepage per locale |
| API | `src/pages/api/skills/*.ts` | REST API |
| Worker | `workers/index.ts` | Async workflows |
| CLI | `packages/cli/` | `killer-skills` CLI |
| Pipeline | `.github/workflows/data-pipeline.yml` | Data harvesting |

## Key Abstractions
| File | Responsibility |
|------|---------------|
| `src/lib/kv.ts` | KV 读写封装，支持 fallback 到本地 JSON |
| `src/lib/skills.ts` | Skill 数据模型，搜索，过滤 |
| `src/i18n.ts` | 翻译加载 + `tr()` 函数 |
| `scripts/lib/ai.ts` | Multi-provider AI 调用 (race strategy) |
| `scripts/lib/constants.ts` | SUPPORTED_LOCALES, categories 等 |
| `src/lib/seo-keywords.ts` | SEO 关键词集群管理 |
