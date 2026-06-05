# Phase 113 Context — New Authority Surface Candidates

## Decisions Reached

- **Underrepresented Classes**: Add 3 new authority surfaces covering developer tools: Go (`collection-go`), Java (`collection-java`), and Mobile (`collection-mobile`).
- **Data Parity & Localization**: Fully localise each collection in all 10 standard locales. Provide valid metadata, descriptions, and correct ending punctuation.
- **Jargon Check**: Avoid any forbidden terms matching `/review(ed)?/` in the values of JSON collections.

## Scope of Phase 113

- Configure `data/authority-surfaces.json` to register the 3 new collections.
- Seed JSON content and localisations under `src/content/collections/`.
- Ensure all tests pass.

## Key Files

| File | Role |
|------|------|
| `data/authority-surfaces.json` | Register new collections |
| `src/content/collections/top-go-ai-tools-developer-workflows.json` | Go AI tools collection |
| `src/content/collections/top-java-ai-tools-developer-workflows.json` | Java AI tools collection |
| `src/content/collections/top-mobile-ai-tools-developer-workflows.json` | Mobile AI tools collection |
