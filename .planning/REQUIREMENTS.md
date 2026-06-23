# Milestone v4.1 Requirements — Multi-language Indexability Restructuring & SEO Acceleration

## 1. Active Requirements

### Multi-language Indexability Restructuring (INDEX)
- [ ] **INDEX-01**: Relax over-strict locale eligibility rules in `seo-locales.ts`. Allow non-English page variants to bypass body-locale checks if they have high-quality editorial translations (e.g. `reviewSummary` and `selectionReason`).
- [ ] **INDEX-02**: Update Astro detail rendering (`[...repo].astro`) and edge middleware (`middleware.ts`) to permit indexing (`index, follow`) on approved bilingual page variants.
- [ ] **INDEX-03**: Integrate newly indexable non-English pages into `sitemap-skills.xml` and generate correct hreflang alternate links to ensure search engine discovery.

### Verification & Deploy (DEPLOY)
- [ ] **DEPLOY-01**: Pass full local validation suite (`validate:public-surface`) without typescript errors, copy leaks, or punctuation issues.
- [ ] **DEPLOY-02**: Sync updated cache and sitemap files to production Cloudflare KV and run IndexNow to force crawler updates.

## 2. Out of Scope
- Re-enabling indexability for repository directories or listing pages with query parameters.
- Translating README body text using automatic translations during runtime (keep build-time cache translation only).

## 3. Traceability Matrix

| Req ID | Mapped Phase | Verification File | Status |
|---|---|---|---|
| INDEX-01 | | | |
| INDEX-02 | | | |
| INDEX-03 | | | |
| DEPLOY-01 | | | |
| DEPLOY-02 | | | |
