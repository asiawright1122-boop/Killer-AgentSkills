---
status: passed
phase: 34-locale-content-governance-guards
started: 2026-04-06
updated: 2026-04-06
requirements_completed:
  - GOV-01
  - GOV-02
  - GOV-03
---

## Phase Goal
Detect translation, metadata, tutorial-shell, and SEO drift before it accumulates into another broad repair cycle.

## Verification Run

- ✓ Confirmed one canonical governance command now aggregates structured collection drift plus representative localized route/content contracts.
- ✓ Confirmed the governance lane emits both Markdown and JSON artifacts from one shared report model.
- ✓ Confirmed severity is explicit (`clear`, `warning`, `blocking`) and can be threshold-gated.
- ✓ Confirmed representative localized public-route verification is part of the governance lane through targeted suites covering translation, breadcrumb, metadata, and tutorial-shell contracts.
- ✓ `npx vitest run scripts/lib/content-governance.test.ts src/pages/public-links.test.ts src/messages/public-copy.test.ts src/lib/markdown-headings.test.ts src/lib/site/breadcrumbs.test.ts src/lib/site/metadata.test.ts` passed (`55` tests).
- ✓ `npm run report:content:governance` passed and wrote refreshed `reports/seo/latest-content-governance.{md,json}` artifacts.
- ✓ Current governance severity is `clear`.
- ✓ `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze` passed.

## Residual Risks

- CI and scheduled monitoring are not yet consuming the new governance lane automatically.
- Broader production smoke and crawl-health remain separate lanes; they complement governance but are not yet merged into the same command.

## Conclusion
Phase 34 is verified complete: locale/content governance now has one reusable reporting lane with blocking semantics and machine-readable outputs.
