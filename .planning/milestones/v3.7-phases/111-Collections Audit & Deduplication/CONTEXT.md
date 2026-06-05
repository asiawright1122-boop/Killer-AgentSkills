# Phase 111 Context — Collections Audit & Deduplication

## Decisions Reached

- **Scope & Targets**: Audit all top collections for duplicate elements, thin entries, and dead links. Establish a comprehensive quality checklist for collections.
- **Remediation**: Correct paths, remove dead repositories, and ensure CJK alignment across all 10 target locales.

## Scope of Phase 111

- Audit existing collections to filter out inactive repositories and format issues.
- Create the automated audit script `scripts/seo-collection-quality-audit.ts`.
- Generate locale and drift tracking reports (`data/seo-collection-locale-gaps.json` and `data/seo-collection-drift.json`).
- Write `docs/collections-quality-checklist.md` defining strict schema and copy constraints.

## Key Files

| File | Role |
|------|------|
| `scripts/seo-collection-quality-audit.ts` | Collections quality auditor script |
| `docs/collections-quality-checklist.md` | Collection quality checklist documentation |
| `data/seo-collection-drift.json` | CJK and translation drift report |
| `data/seo-collection-locale-gaps.json` | Locale gaps analysis report |
| `src/content/collections/*.json` | Modified collection files |
