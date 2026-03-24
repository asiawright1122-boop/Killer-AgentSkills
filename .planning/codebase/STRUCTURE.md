# Project Structure

## Top-Level
```
killer-skills/
├── src/                    # Application source
├── scripts/                # Build/pipeline/SEO scripts (Node.js/tsx)
├── data/                   # Local skill cache (dev fallback)
├── docs/                   # Documentation source JSON
├── workers/                # Standalone Cloudflare Worker scripts
├── packages/               # Shared packages (excluded from TS build)
├── public/                 # Static assets
├── .planning/              # GSD planning documents
├── astro.config.mjs        # Astro + Cloudflare config
├── wrangler.toml           # CF Workers/Pages + KV/D1 bindings
├── vitest.config.ts        # Test config
└── package.json
```

## src/ Structure
```
src/
├── pages/
│   ├── index.astro                    # Root redirect
│   ├── [locale]/
│   │   ├── index.astro                # Home page
│   │   ├── skills/[owner]/[...repo].astro  # Skill detail
│   │   ├── skills/index.astro         # Skills listing
│   │   ├── collections/[...slug].astro
│   │   ├── solutions/[topic].astro
│   │   ├── blog/[...slug].astro
│   │   ├── docs/[...slug].astro
│   │   ├── favorites/index.astro
│   │   ├── history/index.astro
│   │   ├── labs/skill-try.astro       # AI skill playground
│   │   └── [legal pages]/
│   └── api/
│       ├── skills/search.ts           # GET /api/skills/search
│       ├── skills/[owner]/[repo]/*.ts # Skill CRUD
│       ├── crawled-skills/*.ts        # Crawl submission endpoints
│       └── admin/skills.ts            # Admin API
├── lib/
│   ├── kv.ts                          # Core KV/D1 data access layer
│   ├── skills.ts                      # UnifiedSkill type + public filter
│   ├── skills-config.ts               # OFFICIAL_REPOS + quality thresholds
│   ├── search.ts                      # Fuse.js search + quality scoring
│   ├── category-taxonomy.ts           # Category normalization
│   ├── favorites.ts / history.ts      # Client localStorage state
│   ├── rate-limit.ts                  # IP-based rate limiter
│   ├── api-utils.ts                   # Error response helpers
│   ├── nvidia.ts                      # NVIDIA AI API client
│   └── shared/
│       ├── validation.ts              # EXCLUDE_KEYWORDS, NON_TARGET_THEME_PATTERNS, scoring
│       ├── official-repos.ts          # OFFICIAL_REPOS list
│       └── validation.test.ts
├── islands/                           # React interactive components
│   ├── SkillActions.tsx               # Favorite/copy/share actions
│   ├── HeaderActions.tsx              # Search bar
│   └── withErrorBoundary.tsx
├── components/                        # Astro components
│   ├── CollectionCard.astro
│   ├── OfficialSkills.astro
│   ├── blog/BlogHero.astro
│   └── cli/ComparisonTable.astro
├── content/
│   └── blog/[locale]/*.md             # Blog posts (10 locales)
├── stores/                            # Nanostores state
├── styles/                            # Syntax highlight themes
├── i18n.ts                            # i18n string lookup
└── content.config.ts                  # Astro content collections config
```

## scripts/ Structure
```
scripts/
├── harvest-github-skills.ts           # Step 1: GitHub crawler
├── build-skills-cache.ts              # Step 2: AI enrichment + scoring
├── sync-to-kv.ts                      # Step 3: Push to KV
├── sync-d1-delta.ts                   # Step 3b: Push to D1 (delta)
├── build-docs-cache.ts                # Translate docs to 9 locales via AI
├── generate-collections.ts            # Generate collection pages
├── push-d1-direct.ts                  # Direct D1 push utility
├── seo-*.ts / seo-*.mjs               # SEO audit/report tools
├── submit-*.mjs                       # IndexNow / Baidu / Google submit
├── audit-*.ts                         # Quality audits
├── remove-skill.ts / clean-broken-skills.js  # Data maintenance
├── run-pipeline.sh                    # Orchestrator (harvest→build→sync)
├── run-full-automation.sh             # Extended automation
├── auto-submitter/                    # Playwright-based directory submissions
└── lib/
    ├── kv.ts                          # Script-side KV client
    ├── github.ts                      # GitHub API client
    └── utils.test.ts
```
