# Concerns & Technical Debt

## Security & Auth Risks
- **Admin Authentication Overrides**: Background GitHub runners tend to inject global environment variables (e.g. `ADMIN_USER`) which sometimes collide laterally with the local middleware test engines leading to credential leakage or false negatives locally.

## Fragile Areas
- **Sitemap Drift**: Hardcoded relative API paths such as `'./api/sitemap/collections.xml.ts'` are at risk when Astro directories refactor components to the top level root `.astro` output. Static search tests are easily broken during such transitions.
- **Typing Overlays (CF Fetchers)**: Testing components bridging Cloudflare Worker `Fetcher` typings locally via stabs/mocks leads to unstable TS compliance (such as missing `connect` bindings under newer Worker environment upgrades). High reliance on `@ts-ignore` hacks during testing.

## Performance
- **Heavy Data Extraction Load**: The ETL pipeline harvests immense volumes of GitHub code directly hitting API rate limits. Failure models (retry 1, 2, 3...) mask deep potential structural API blockage issues.
- **SEO Smoke Timeout**: Spawning `npm run dev` and verifying `curl` in the CI introduces severe timeout vulnerabilities if background Node compilation is slow due to heavy module resolution on the runner. Wait blocks manually spin on port `4321`.
