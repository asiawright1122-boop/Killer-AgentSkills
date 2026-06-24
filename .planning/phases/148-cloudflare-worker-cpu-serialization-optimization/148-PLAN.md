# Plan: Cloudflare Worker CPU & Serialization Optimization

Phase 148 focuses on optimizing edge rendering CPU times by replacing heavy `getAllSkills` (which parses full Markdown payloads) with lightweight helper methods in API paths and related skills calculation.

- **Wave:** 1
- **Depends on:** None
- **Files modified:**
  - `src/lib/skills.ts`
  - `src/pages/api/badge.ts`
  - `src/pages/api/stats/growth.ts`
  - `src/pages/api/skills/search.ts`
- **Requirements:** CPU-01
- **Autonomous:** true

## Tasks

### Task 1: Extend `src/lib/skills.ts` with `getTotalSkillsCount`

<read_first>
- [skills.ts](file:///Users/kaka/Dev/Killer-Skills/src/lib/skills.ts)
- [kv.ts](file:///Users/kaka/Dev/Killer-Skills/src/lib/kv.ts)
</read_first>

<acceptance_criteria>
- `src/lib/skills.ts` contains the exported function `getTotalSkillsCount`.
- The function invokes `getLightweightSkillsCategorySummary(env)` and returns its `total` count.
</acceptance_criteria>

<action>
Add the following helper function to `src/lib/skills.ts`:
```typescript
export async function getTotalSkillsCount(env: Env): Promise<number> {
  const summary = await getLightweightSkillsCategorySummary(env);
  return summary.total;
}
```
Ensure `getLightweightSkillsCategorySummary` is correctly imported or available from `./kv` (it is already imported on line 9).
</action>

---

### Task 2: Optimize `getRelatedSkills` and `getFeaturedSkills` in `src/lib/skills.ts`

<read_first>
- [skills.ts](file:///Users/kaka/Dev/Killer-Skills/src/lib/skills.ts)
</read_first>

<acceptance_criteria>
- `getRelatedSkills` and `getFeaturedSkills` inside `src/lib/skills.ts` invoke `getLightweightSkills` instead of `getAllSkills`.
</acceptance_criteria>

<action>
Modify `getRelatedSkills` at line 385:
```typescript
// Replace:
const allSkills = await getAllSkills(env);

// With:
const allSkills = await getLightweightSkills(env);
```

Modify `getFeaturedSkills` at line 303:
```typescript
// Replace:
const skills = await getAllSkills(env);

// With:
const skills = await getLightweightSkills(env);
```
</action>

---

### Task 3: Refactor API Routes (`badge.ts`, `growth.ts`, `search.ts`)

<read_first>
- [badge.ts](file:///Users/kaka/Dev/Killer-Skills/src/pages/api/badge.ts)
- [growth.ts](file:///Users/kaka/Dev/Killer-Skills/src/pages/api/stats/growth.ts)
- [search.ts](file:///Users/kaka/Dev/Killer-Skills/src/pages/api/skills/search.ts)
</read_first>

<acceptance_criteria>
- `src/pages/api/badge.ts` does not call `getAllSkills` and instead uses `getTotalSkillsCount`.
- `src/pages/api/stats/growth.ts` uses `getLightweightSkills` instead of `getAllSkills`.
- `src/pages/api/skills/search.ts` uses `getLightweightSkills` in the KV Fallback path.
</acceptance_criteria>

<action>
1. Edit `src/pages/api/badge.ts`:
   - Change import:
     ```typescript
     import { getAllSkills } from '../../lib/public-skill-catalog';
     ```
     to:
     ```typescript
     import { getTotalSkillsCount } from '../../lib/public-skill-catalog';
     ```
   - Change line 46:
     ```typescript
     const skills = env ? await getAllSkills(env) : [];
     const totalSkills = skills.length;
     ```
     to:
     ```typescript
     const totalSkills = env ? await getTotalSkillsCount(env) : 0;
     ```

2. Edit `src/pages/api/stats/growth.ts`:
   - Change import:
     ```typescript
     import { getAllSkills, type UnifiedSkill } from '../../../lib/public-skill-catalog';
     ```
     to:
     ```typescript
     import { getLightweightSkills, type UnifiedSkill } from '../../../lib/public-skill-catalog';
     ```
   - Change line 20:
     ```typescript
     const skills: UnifiedSkill[] = env ? await getAllSkills(env) : [];
     ```
     to:
     ```typescript
     const skills: UnifiedSkill[] = env ? await getLightweightSkills(env) : [];
     ```

3. Edit `src/pages/api/skills/search.ts`:
   - Change import from `../../../lib/public-skill-catalog`:
     Include `getLightweightSkills` and remove `getAllSkills`.
   - Change line 144 (KV Fallback path):
     ```typescript
     _skills = env ? await getAllSkills(env) : [];
     ```
     to:
     ```typescript
     _skills = env ? await getLightweightSkills(env) : [];
     ```
</action>

---

### Task 4: Run Type Checks and Vitest Suite

<read_first>
- [package.json](file:///Users/kaka/Dev/Killer-Skills/package.json)
</read_first>

<acceptance_criteria>
- `npm run typecheck` exits with code 0.
- `npm test` passes 1063 tests cleanly.
- `npm run build` succeeds without compilation errors.
</acceptance_criteria>

<action>
Execute the following verification scripts locally:
1. `npm run typecheck`
2. `npm test`
3. `npm run build`
</action>

## Verification Plan

### Automated Tests
- Run `npm test` to execute all unit tests.
- Verify `src/lib/skills.test.ts` passes cleanly.

### Manual Verification
- Deploy/simulate edge environment under wrangler or Astro build check to confirm sitemap and details compilation do not produce regression.
