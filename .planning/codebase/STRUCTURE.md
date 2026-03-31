# Directory Structure

```
Killer-Skills/
├── .github/workflows/          # CI/CD (4 workflows)
│   ├── ci.yml                  # Build + Deploy + SEO checks
│   ├── data-pipeline.yml       # Skill harvesting + AI SEO + KV/D1 sync
│   ├── i18n-update.yml         # Translation sync + blog translate
│   └── seo-monitoring.yml      # SEO health audits
│
├── config/
│   └── locales.mjs             # Locale definitions (shared across Astro + scripts)
│
├── data/                       # Static data files (git-tracked, pipeline-generated)
│   ├── skills-cache.json       # 103MB — 3477 skills, full SEO + translations
│   ├── embeddings-cache.json   # 40MB — vector embeddings
│   ├── expanded-github-skills.json  # Raw harvested data
│   ├── sitemap-skills.json     # Sitemap generation data
│   ├── official-repos.json     # GitHub repo list for data pipeline
│   └── seed-keywords.json      # SEO seed keywords
│
├── db/seeds/                   # D1 database seeds
│
├── packages/                   # Monorepo sub-packages
│   ├── cli/                    # `killer-skills` CLI tool
│   ├── killer-skills-manager/  # Skill management library
│   └── og-server/              # Open Graph image server
│
├── scripts/                    # 57 automation scripts
│   ├── lib/                    # Shared libraries
│   │   ├── ai.ts               # Multi-provider AI service (1329 lines)
│   │   ├── constants.ts        # SUPPORTED_LOCALES, SEED_KEYWORDS, categories
│   │   ├── meta-description.ts # Meta description validators
│   │   └── utils.ts            # JSON parsing, sanitization
│   ├── build-skills-cache.ts   # Core: skill harvesting → AI SEO → cache (2515 lines)
│   ├── harvest-github-skills.ts # GitHub API skill discovery
│   ├── translate-*.ts          # Translation scripts
│   ├── ai-optimize-blog-meta.ts # AI meta description optimization
│   ├── sync-*.ts               # Data sync scripts (KV, D1, translations)
│   ├── seo-*.ts                # SEO audit/monitoring scripts
│   └── auto-submitter/         # Directory submission automation
│
├── src/
│   ├── components/             # 14 Astro/React components
│   ├── content/                # Content collections
│   │   ├── blog/               # 340 blog posts (11 locale dirs)
│   │   └── collections/        # Skill collections
│   ├── islands/                # React islands (interactive)
│   ├── layouts/                # Layout components
│   ├── lib/                    # Runtime libraries (44 files)
│   │   ├── kv.ts               # Cloudflare KV read/write
│   │   ├── skills.ts           # Skill data model + search
│   │   ├── seo-keywords.ts     # SEO keyword clusters
│   │   ├── category-taxonomy.ts # Category definitions
│   │   └── *.test.ts           # Co-located tests
│   ├── messages/               # 11 locale JSON files (797 keys each)
│   ├── pages/                  # 24 Astro pages + 33 API routes
│   │   ├── [locale]/           # Locale-aware pages
│   │   ├── api/                # REST API endpoints
│   │   └── sitemap-*.xml.ts    # Dynamic sitemaps
│   ├── stores/                 # Nanostores state
│   └── styles/                 # Global CSS
│
├── tests/e2e/                  # 4 Playwright E2E specs
├── workers/                    # Cloudflare Workers (3 workflows)
├── public/                     # Static assets
└── reports/seo/                # Generated SEO reports
```

## Key Naming Conventions
- Pages: `[locale]/[section]/index.astro` — locale-prefixed routing
- API: `api/[resource]/index.ts` — RESTful structure
- Tests: `*.test.ts` — co-located with source in `src/lib/`
- Scripts: verb-noun pattern — `build-skills-cache`, `translate-locales`
- Locale files: ISO 639-1 codes — `en.json`, `zh.json`, `ja.json`
