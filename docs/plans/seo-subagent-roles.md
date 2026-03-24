# SEO Optimization Subagent Roles

> This document defines the subagent roles for executing the SEO optimization plan.

## Overview

The SEO optimization plan will be executed using subagent-driven development with three specialized roles:

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTROLLER (Main Agent)                   │
│   - Reads plan, creates todo list, dispatches subagents     │
│   - Coordinates two-stage review after each task            │
│   - Uses TodoWrite to track progress                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐
│   IMPLEMENTER │ │  SPEC REVIEWER│ │  CODE QUALITY REVIEWER │
│   (per task)  │ │  (per task)   │ │  (per task)            │
└───────────────┘ └───────────────┘ └───────────────────────┘
```

## Role 1: SEO Implementer

**Purpose:** Execute individual SEO implementation tasks from the plan.

**Skillset Required:**

- `coding-standards` - Code quality and conventions
- `seo-review` - SEO best practices and audit methodology
- `verification-before-completion` - Verification before claiming work is done

**Subagent Definition:**

```
Task tool (general-purpose agent):
  description: "SEO Implementer - Task N: [task name]"
  prompt: |
    You are implementing an SEO optimization task for Killer-Skills.com.

    ## Plan Location
    /Users/kaka/Dev/Killer-Skills/docs/plans/2026-03-21-seo-optimization.md

    ## SKILLS TO LOAD
    Before starting, invoke these skills:
    - skill: coding-standards
    - skill: seo-review
    - skill: verification-before-completion

    ## Task Description
    [Paste full task text from plan]

    ## Project Context
    - Framework: Astro 5 + Cloudflare Pages SSR
    - Project root: /Users/kaka/Dev/Killer-Skills
    - Content: Blog posts (10 languages), Skills collections, Skill detail pages
    - Key SEO files:
      - Layout.astro: src/layouts/Layout.astro
      - Blog pages: src/pages/[locale]/blog/[...slug].astro
      - Collection pages: src/pages/[locale]/collections/[...slug].astro
      - Skill pages: src/pages/[locale]/skills/[owner]/[...repo].astro
      - Sitemap: src/pages/sitemap*.xml.ts
      - 404 page: src/pages/404.astro
    - Lib files: src/lib/seo-*.ts

    ## Before You Begin
    Load the skills listed above to ensure you follow best practices.

    If you have questions about requirements, approach, or anything unclear,
    ask before starting work.

    ## Your Job
    1. Implement exactly what the task specifies
    2. Write tests following TDD if applicable
    3. Verify implementation using verification-before-completion
    4. Commit your work
    5. Self-review your code
    6. Report back with:
       - Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
       - What you implemented
       - Test results
       - Files changed
       - Self-review findings

    ## Code Standards (from coding-standards skill)
    - TypeScript: Use strict typing, avoid `any`
    - Naming: Follow existing conventions in the codebase
    - Functions: Small, focused, single responsibility
    - Avoid: Magic numbers, dead code, commented-out code

    ## SEO Standards (from seo-review skill)
    - Schema.org structured data must be valid
    - JSON-LD should use @context: "https://schema.org"
    - Meta tags follow best practices
    - Internal linking for link equity

    ## Verification (from verification-before-completion)
    Before claiming work is done, verify:
    - TypeScript compilation passes: npx tsc --noEmit
    - Tests pass if applicable
    - No console errors
    - Schema validates with Schema.org validator

    ## When Blocked
    If you encounter issues you cannot resolve:
    - Report BLOCKED with specific details
    - What you tried
    - What information you need

    Work from: /Users/kaka/Dev/Killer-Skills
```

## Role 2: SEO Spec Reviewer

**Purpose:** Verify the implementation matches the specification exactly.

**Skillset Required:**

- `seo-review` - To verify SEO requirements are met
- `verification-loop` - For comprehensive verification

**Subagent Definition:**

```
Task tool (general-purpose agent):
  description: "SEO Spec Reviewer - Task N"
  prompt: |
    You are reviewing whether an SEO implementation matches its specification.

    ## SKILLS TO LOAD
    Before starting, invoke:
    - skill: seo-review
    - skill: verification-loop

    ## Plan Location
    /Users/kaka/Dev/Killer-Skills/docs/plans/2026-03-21-seo-optimization.md

    ## What Was Requested
    [Paste full task requirements from plan]

    ## What Implementer Claims They Built
    [From implementer's report]

    ## CRITICAL: Verify Independently
    DO NOT trust the implementer's report. You MUST:
    1. Read the actual code they wrote
    2. Compare implementation to requirements line by line
    3. Check for missing pieces
    4. Look for extra features not requested

    ## SEO-Specific Checks
    Based on seo-review skill, verify:
    - ✅ Title tag: 50-60 chars, primary keyword, compelling hook
    - ✅ Meta description: 150-160 chars, action word, keyword
    - ✅ Schema.org: Valid JSON-LD, correct @type
    - ✅ Keywords: Proper placement (title, desc, first 100 words, H2)
    - ✅ Internal linking: Descriptive anchor text
    - ✅ Technical SEO: Single H1, keyword in URL slug

    ## Verification Steps
    1. Load seo-review skill for checklist
    2. Read modified files
    3. Compare against requirements
    4. Validate JSON-LD schemas
    5. Check meta tags

    ## Report Format
    ✅ Spec compliant - if everything matches after inspection
    ❌ Issues found - list specifically what's missing or extra, with file:line references

    Work from: /Users/kaka/Dev/Killer-Skills
```

## Role 3: SEO Code Quality Reviewer

**Purpose:** Verify implementation is well-built, clean, and maintainable.

**Skillset Required:**

- `coding-standards` - Code quality standards
- `verification-loop` - Comprehensive verification
- `requesting-code-review` - Code review patterns

**Subagent Definition:**

````
Task tool (general-purpose agent):
  description: "SEO Code Quality Reviewer - Task N"
  prompt: |
    You are reviewing code quality for an SEO implementation.

    ## SKILLS TO LOAD
    Before starting, invoke:
    - skill: coding-standards
    - skill: verification-loop
    - skill: requesting-code-review

    ## Plan Location
    /Users/kaka/Dev/Killer-Skills/docs/plans/2026-03-21-seo-optimization.md

    ## What Was Implemented
    [From implementer's report]

    ## Task Requirements
    [From plan - paste task requirements]

    ## Base SHA (before changes)
    [Get from git log - 1]

    ## Head SHA (after changes)
    [Get from git log]

    ## CRITICAL: Verify Code Quality
    Check the actual code, not just the report:

    1. **TypeScript Quality**
       - Strict typing (no `any`)
       - Proper interfaces/types
       - No type assertions unless necessary

    2. **Code Organization**
       - Each file has clear responsibility
       - Functions are small and focused
       - No magic numbers

    3. **Testing**
       - Tests verify behavior, not just existence
       - Edge cases covered
       - Tests are maintainable

    4. **Security & Performance**
       - No XSS vulnerabilities in JSON-LD
       - Efficient rendering
       - No blocking resources

    5. **Follows Plan Structure**
       - Files in correct locations
       - Matches planned interfaces
       - No unauthorized changes

    ## Code Quality Checklist
    - [ ] TypeScript strict mode compliance
    - [ ] No `any` types without justification
    - [ ] Proper error handling
    - [ ] Tests passing
    - [ ] No dead/commented code
    - [ ] Follows existing patterns
    - [ ] Small, focused functions

    ## Verification Commands
    Run these and include results:
    ```bash
    cd /Users/kaka/Dev/Killer-Skills
    npx tsc --noEmit
    npm run lint 2>/dev/null || echo "No lint script"
    npx vitest run --reporter=verbose
    ```

    ## Report Format
    **Strengths:** [What was done well]
    **Issues:**
    - Critical: [Must fix]
    - Important: [Should fix]
    - Minor: [Nice to fix]
    **Assessment:** APPROVED | NEEDS_WORK

    Work from: /Users/kaka/Dev/Killer-Skills
````

## Task Assignment Map

Based on the SEO optimization plan:

| Task                                         | Implementer Role   | Priority |
| -------------------------------------------- | ------------------ | -------- |
| **Chunk 1:** Blog Article Schema Enhancement | SEO Implementer    | HIGH     |
| **Chunk 2:** Collection Schema Enhancement   | SEO Implementer    | HIGH     |
| **Chunk 3:** 404 Page SEO Optimization       | SEO Implementer    | MEDIUM   |
| **Chunk 4:** Blog-to-Skills Internal Linking | SEO Implementer    | MEDIUM   |
| **Chunk 5:** Image Alt Text Audit            | SEO Implementer    | LOW      |
| **Chunk 6:** Final Verification              | All + Final Review | HIGH     |

## Workflow

### Before Starting

1. Load `using-git-worktrees` skill to create isolated workspace
2. Read plan from `docs/plans/2026-03-21-seo-optimization.md`
3. Create TodoWrite with all 6 tasks
4. Create git worktree: `git worktree add ../seo-optimization-workspace`

### Per Task Workflow

```
1. Dispatch SEO Implementer subagent
   ↓
2. Implementer reports DONE/DONE_WITH_CONCERNS/BLOCKED
   ↓
3. If BLOCKED → Provide context, re-dispatch
   ↓
4. If DONE → Dispatch SEO Spec Reviewer
   ↓
5. Spec Reviewer reports issues or approval
   ↓
6. If issues → Implementer fixes, re-review
   ↓
7. If approved → Dispatch Code Quality Reviewer
   ↓
8. Quality issues → Implementer fixes, re-review
   ↓
9. If approved → Mark task complete, next task
```

### After All Tasks

1. Dispatch Final Code Reviewer for entire implementation
2. Run comprehensive SEO audit
3. Create PR with all changes
4. Use `finishing-a-development-branch` skill

## Skill Loading Order

For each subagent, skills must be loaded in this order:

```
1. skill: coding-standards       # Always first
2. skill: seo-review              # For SEO-specific tasks
3. skill: verification-loop       # For verification steps
4. skill: seo-audit               # For audit tasks
```

## Git Workflow

```
# Before starting
git checkout -b feat/seo-optimization
git worktree add ../seo-opt-workspace feat/seo-optimization

# After each task
git add <changed-files>
git commit -m "feat(seo): [task description]"

# After all tasks
git push -u origin feat/seo-optimization
gh pr create --title "feat(seo): comprehensive SEO optimization" --body "$(cat <<'EOF'
## Summary
- Blog Article Schema enhancement
- Collection Schema enhancement
- 404 page optimization
- Blog-to-Skills internal linking
- Image alt text audit

## Testing
- [ ] Schema validates with Schema.org
- [ ] All tests pass
- [ ] Build succeeds
EOF
)"
```

## Risk Mitigation

| Risk                     | Mitigation                                   |
| ------------------------ | -------------------------------------------- |
| Schema validation errors | Test with Schema.org validator before commit |
| Breaking existing SEO    | Only add, never remove existing schemas      |
| Test failures            | Run tests before each commit                 |
| Build failures           | TypeScript check before commit               |

## Success Criteria

All tasks complete when:

- ✅ All 6 chunks implemented
- ✅ Spec reviewer approved each task
- ✅ Code quality reviewer approved each task
- ✅ All tests passing
- ✅ TypeScript compilation successful
- ✅ Schema validation passed
- ✅ PR created with comprehensive description
