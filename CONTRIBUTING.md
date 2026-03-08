# Contributing to Killer-Skills

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/asiawright1122-boop/Killer-AgentSkills.git
cd Killer-AgentSkills

# Install dependencies
npm install

# Start dev server
npm run dev
```

## Code Quality Standards

All contributions must pass these CI gates before merging:

1. **ESLint** — zero warnings (`npm run lint`)
2. **Prettier** — consistent formatting (`npm run format:check`)
3. **Vitest** — all tests pass (`npm test`)

### Pre-commit Hooks

The project uses [Husky](https://typicode.github.io/husky/) + lint-staged to automatically run ESLint and Prettier on staged files before each commit.

## Project Conventions

### File Organization

- **Astro pages** → `src/pages/[locale]/`
- **React islands** → `src/islands/` (client-side interactive components)
- **Server components** → `src/components/` (Astro, rendered at build/request time)
- **Shared logic** → `src/lib/`
- **State stores** → `src/stores/` (Nanostores)
- **Translations** → `src/messages/*.json`

### React Islands

All React islands should be wrapped with the `withErrorBoundary` HOC:

```tsx
import withErrorBoundary from './withErrorBoundary';

function MyIsland(props: MyIslandProps) {
  // ...
}

export default withErrorBoundary(MyIsland);
```

### API Routes

Use the structured error handling utilities from `src/lib/api-utils.ts`:

```ts
import { jsonResponse, errorResponse, ApiError } from '../../lib/api-utils';

export const GET: APIRoute = async ({ locals }) => {
  try {
    // ... your logic
    return jsonResponse({ data });
  } catch (error) {
    return errorResponse(error);
  }
};
```

### Environment Access

Access Cloudflare runtime bindings via:

```ts
const env = locals.runtime?.env as Env | undefined;
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npx vitest run --coverage

# Run a specific test file
npx vitest run src/lib/skills.test.ts
```

### Writing Tests

- Place test files next to the source: `foo.ts` → `foo.test.ts`
- Use `vi.fn()` for mocks, create helper factories for complex mocks (see `src/lib/skills.test.ts`)
- Prefix unused catch variables with `_` (e.g., `catch (_e)`)

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear, atomic commits
3. Ensure all CI gates pass locally before pushing
4. Open a PR with a descriptive title and summary
5. Address review feedback promptly

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new skill submission validation
fix: correct locale detection for Arabic
refactor: extract cache helper from skills.ts
test: add coverage for getRelatedSkills
docs: update README with API endpoints
perf: optimize bundle with lazy-loaded syntax highlighting
```

## Need Help?

- Check existing issues and PRs for context
- Review `src/lib/` for core patterns and conventions
- Run `npm test` frequently to catch regressions early
