# Phase 131: Hindi Message Configuration Normalization - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning
**Source:** User explicit decision ("不支持印地语")

<domain>
## Phase Boundary

The objective of this phase is to normalize the locale configuration by completely removing the unused/unsupported Hindi language file `src/messages/hi.json` and any references, loading logic, or test mocks associated with it. This aligns the codebase with the actual `SUPPORTED_LOCALES` configuration.

</domain>

<decisions>
## Implementation Decisions

### Hindi Locale Removal
- Remove the file `src/messages/hi.json`.
- Perform a workspace-wide search for references to `"hi"`, `'hi'`, `hi.json` or `Hindi` to ensure no dead loading configuration, i18n keys parser, or locale routing mapping remains.
- Ensure that the build pipeline, i18n middleware, and unit/integration tests do not fail after this cleanup.

### the agent's Discretion
- Technical implementation of finding and removing references.
- Pruning related translation key verification tests (if any exists) that reference `"hi"`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locale Configurations & Messages
- `src/messages/en.json` — English master locale
- `src/messages/hi.json` — Hindi file to be removed
- `src/i18n.ts` — Translation routing & loading middleware
- `config/locales.mjs` — Master list of supported locales

</canonical_refs>

<specifics>
## Specific Ideas
- None.

</specifics>

<deferred>
## Deferred Ideas
- None.

</deferred>

---

*Phase: 131-hindi-message-configuration-normalization*
*Context gathered: 2026-06-23*
