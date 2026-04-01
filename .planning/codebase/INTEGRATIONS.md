# External Integrations

## Hosting and Cloud Services
- **Cloudflare Pages**: Primary hosting and edge deployment target (`wrangler pages deploy`).
- **Cloudflare KV**: Session management, intermediate caching, and high-read document storage.
- **Cloudflare D1**: Primary relational database for tracking skill caches and complex query capabilities.

## AI Infrastructure
The project integrates multiple AI data pipelines for autonomous content harvesting and translation via scripts (as seen in GitHub actions):
- **Nvidia API**: High-performance AI model inferences.
- **SiliconFlow API**: Primary generative APIs for translations.
- **OpenRouter**: Intelligent model routing for data pipeline fallback processing.

## Browsing & Web Interactions
- **Playwright**: Utilized via `--with-deps chromium` inside `auto-submitter` workflows to crawl and perform blind submissions across skill aggregator directories.

## Developer Portals & Third-Party Platforms
- **WebContainers API**: Allows initializing isolated Node.js environments inside the frontend (React + Xterm) for the `WebTerminal.tsx` simulator island.
- **GitHub Actions**: Heavily entrenched CI/CD runner. Responsible for running SEO sweeps, D1 seeding, translation generation, caching, and edge bounds logic.
- **Search Engines**: Integrated webhooks/APIs invoking IndexNow, Baidu, and Google Search Console data fetching pipelines.
