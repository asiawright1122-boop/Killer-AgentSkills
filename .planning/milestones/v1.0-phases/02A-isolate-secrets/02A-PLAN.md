---
wave: 1
depends_on: []
files_modified:
  - "src/middleware.property.test.ts"
autonomous: true
---

# Phase 2A: Isolate overlapping GitHub Action injection secrets

<objective>
Fix the property-based tests in `src/middleware.property.test.ts` to explicitly isolate themselves from CI environment variable injections (like `ADMIN_USER`) to prevent false-negative authentication failures in GitHub Actions workflows.
</objective>

<task>
<read_first>
- src/middleware.property.test.ts
</read_first>
<action>
Modify the Vitest test setup logic in `src/middleware.property.test.ts` to explicitly invoke `delete process.env.ADMIN_USER` and `delete process.env.ADMIN_PASSWORD`. This ensures that local default credential assertions do not inadvertently collide with GitHub Runner level secret injections.
</action>
<acceptance_criteria>
- `npx vitest run src/middleware.property.test.ts` exits 0 successfully without throwing unintended authentication bypass errors.
- The `delete` mechanism cleanly operates within the `beforeEach` or standard test blocks.
</acceptance_criteria>
</task>

<verification>
<must_haves>
- Vitest properties regarding empty environments MUST complete without hitting authorization lockouts.
</must_haves>
</verification>
