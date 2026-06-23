# Phase 143: System Integrity & Regression Guard

- **Wave**: 1
- **Depends On**: Phase 142
- **Files Modified**: None
- **Autonomous**: true

## Tasks

### Task 1: Run Lint and Code Style Formatter Verification
<read_first>
- [package.json](file:///Users/kaka/Dev/Killer-Skills/package.json)
</read_first>
<acceptance_criteria>
- `npm run lint` passes with exit code 0.
- `npm run format:check` passes with exit code 0.
</acceptance_criteria>
<action>
- Run linter: `npm run lint`
- Run formatter check: `npm run format:check`
</action>

### Task 2: Run Public Copywriting & Boundary Guardrails
<read_first>
- [package.json](file:///Users/kaka/Dev/Killer-Skills/package.json)
</read_first>
<acceptance_criteria>
- `npm run validate:public-surface` passes with exit code 0.
</acceptance_criteria>
<action>
- Run public copy boundary verification: `npm run validate:public-surface`
- This runs multiple checks including:
  - `guard:public-ai-output` (checks that reasoning terms/traces don't leak to users)
  - `guard:public-client-errors` (checks client error boundaries)
  - `guard:collection-cjk-punctuation` (checks localized collection punctuations)
  - `node scripts/dev-server-smoke.mjs` (smoke tests dev server)
  - `npm run build` and `guard:public-ai-output:dist` (post-build trace checks)
  - Several specific copy/middleware/routing integration test cases.
</action>

### Task 3: Execute Full Regression Suite (Vitest)
<read_first>
- [package.json](file:///Users/kaka/Dev/Killer-Skills/package.json)
</read_first>
<acceptance_criteria>
- `npm test` passes and asserts 100% success on all 1030+ tests.
</acceptance_criteria>
<action>
- Run full Vitest suite: `npm test`
</action>
