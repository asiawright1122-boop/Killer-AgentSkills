# Conventions

## Code Style & Formatting
- **Standard**: Prettier handles all file formatting rigorously.
- **Enforcement**: `eslint --max-warnings 0` completely rejects non-conforming commits. Unused variables, unresolved imports, and sloppy typings result in instant CI drops.
- **Language**: Strict TypeScript natively evaluated by the `astro check` diagnostics daemon.

## Patterns & Idioms
- **Environment Isolation**: Component tests must gracefully handle or ignore dynamic Node.js injected credentials (`process.env`) versus Cloudflare Worker injected `env` parameters binding natively.
- **Event Handling**: Standard DOM SyntheticEvents (`React.FormEvent<HTMLFormElement>`) are carefully enforced to migrate seamlessly onto modern React 19 standards.
- **TS Ignore Rules**: `@ts-ignore` usage must be explicitly followed by rationale documentation to pass ESLint checks (e.g., `// @ts-ignore: Mock ASSETS`).

## Internationalization Focus
- **Strict Locale Validation**: Literal string subsets are tightly controlled for languages (`"en" | "zh" | "ja"` etc.) and casting these dynamically requires careful JSDoc configuration in standalone scripts (`/** @type {any} */`).
- All interactive labels and prompts must route through the `tr()` fallback logic injected via `loadMessages`.
