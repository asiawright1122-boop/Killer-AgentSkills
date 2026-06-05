# Phase 110 Context — Homepage & Collections Hub Editorial Hardening

## Decisions Reached

- **Focus Hubs**: Hardening copy and structural curation sections for Homepage Root Hub and Collections Hub.
- **Guidance & Alignment**: Resolve any copy blockers or thin guidance warnings on key hub entrypoints. Align messaging with the public trust guardrails in `INTERNAL_PUBLIC_COPY_PATTERN`.

## Scope of Phase 110

- Modify homepage and collections page template.
- Audit public messaging to avoid blacklisted phrases (e.g. review, validation, checklist, checkpoint, trusted next).
- Verify alignment with tests and run typechecks.

## Key Files

| File | Role |
|------|------|
| `src/pages/[locale]/collections/index.astro` | Collections Page template |
| `src/messages/en.json` | English translation messages |
| `src/messages/zh.json` | Chinese translation messages |
| `tests/pages/public-links.test.ts` | Verification tests |
