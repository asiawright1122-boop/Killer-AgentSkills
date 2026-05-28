# External Integrations

**Analysis Date:** 2026-04-02

## APIs and External Services

**GitHub APIs:**
- Used for skill harvesting, repository metadata, and submission validation.
  - Integration points: `scripts/harvest-github-skills.ts`, `scripts/build-skills-cache.ts`, `src/pages/api/skills/submit.ts`, `workers/index.ts`.
  - Auth: `GITHUB_TOKEN`/`GITHUB_PAT` env vars.

**AI Model Providers:**
- NVIDIA APIs (translation/content generation), SiliconFlow fallback, OpenRouter fallback routing.
  - Integration points: `src/lib/nvidia.ts`, `scripts/lib/ai.ts`, `workers/content-workflow.ts`, `workers/translation-workflow.ts`.
  - Auth: `NVIDIA_API_KEY` or `NVIDIA_API_KEYS*`, `SILICONFLOW_API_KEY`, `OPENROUTER_API_KEY(S)`.

**Search Engine Submission APIs:**
- IndexNow, Google Indexing API, and Baidu submission scripts.
  - Integration points: `scripts/submit-indexnow.mjs`, `scripts/submit-google.mjs`, `scripts/submit-baidu.mjs`.
  - Auth: `BAIDU_TOKEN`, Google service account credentials (`GOOGLE_APPLICATION_CREDENTIALS`).

**Search Console Reporting:**
- Google Search Console report fetcher for SEO monitoring.
  - Integration points: `scripts/gsc-fetch-report.ts`, `scripts/gsc-ctr-report.ts`, `.github/workflows/seo-monitoring.yml`.
  - Auth: `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY`, `GSC_SITE_URL`.

## Data Storage

**Databases:**
- Cloudflare D1 (`DB`) as primary skills data store.
  - Schema and FTS: `db/schema.sql` (`skills` and `skills_fts` with triggers).
  - Access layer: `src/lib/kv.ts`.

**Key-Value Storage:**
- Cloudflare KV namespaces: `SKILLS_CACHE`, `TRANSLATIONS`.
  - Access layer: `src/lib/kv.ts`.
  - Sync tooling: `scripts/sync-to-kv.ts`, `scripts/build-ssr-translations.ts`.

**Vector Search:**
- Cloudflare Vectorize (`VECTORIZE`) with Workers AI embeddings for semantic search.
  - Integration points: `src/pages/api/search.ts`, `src/pages/api/admin/sync-vectors.ts`.

**Local Data Artifacts:**
- JSON cache files in `data/` used for pipeline and local fallback (`data/skills-cache.json`, `data/docs-cache.json`, `data/sitemap-skills.json`).

## Authentication and Identity

**Admin Access:**
- HTTP Basic Auth for `/admin` and `/api/admin/*` routes.
  - Enforcement in middleware: `src/middleware.ts`.
  - Credentials from `ADMIN_USER` and `ADMIN_PASSWORD` environment bindings.

**Webhook Verification:**
- GitHub webhook signature verification in Workers endpoint.
  - Integration point: `workers/index.ts` (`WEBHOOK_SECRET`).

## Monitoring and Observability

**Application Logging:**
- Structured logger for app code (`src/lib/logger.ts`) plus targeted `console.*` logging in scripts/workflows.

**Platform Observability:**
- Cloudflare observability enabled in `wrangler.toml` (`[observability] enabled = true`).

**CI Artifacts and Reports:**
- Coverage and SEO/GSC reports uploaded in GitHub Actions (`.github/workflows/ci.yml`, `.github/workflows/seo-monitoring.yml`).

## CI/CD and Deployment

**Hosting:**
- Cloudflare Workers deployment via `wrangler deploy --config dist/server/wrangler.json` in `.github/workflows/ci.yml`.

**CI Pipeline:**
- GitHub Actions for lint/test/build/deploy and data/SEO automation.
  - Key workflows: `ci.yml`, `data-pipeline.yml`, `seo-monitoring.yml`, `i18n-update.yml`, `warmup-cache.yml`.

## Environment Configuration

**Development:**
- Local env files plus Wrangler local bindings.
- Many scripts degrade gracefully when optional cloud services are unavailable (fallback to local cache).

**Production:**
- Secrets and bindings provided via GitHub Actions and Cloudflare dashboard.
- Services wired through `wrangler.toml` and `workers/wrangler.toml`.

## Webhooks and Callbacks

**Incoming:**
- Repository dispatch and workflow triggers from GitHub Actions (`repository_dispatch` workflows).
- Worker webhook endpoint in `workers/index.ts`.

**Outgoing:**
- Script-driven API calls to search engine submission endpoints and GitHub APIs.

---

*Integration audit: 2026-04-02*
*Update when adding/removing external services or credentials*
