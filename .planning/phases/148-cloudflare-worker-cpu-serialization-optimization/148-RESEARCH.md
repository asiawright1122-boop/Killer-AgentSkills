# Phase 148 Research: Cloudflare Worker CPU & Serialization Optimization

## 1. Background & Problem Statement
Cloudflare Worker (Edge Platform) has strict limits on CPU execution times. Exceeding these limits triggers Cloudflare Error 1102.
In the current codebase, several rendering paths, helper methods, and API routes import or invoke `getAllSkills(env)`. This fetches the full skill dataset (which includes the large Markdown `body` and `bodyPreview` fields for each skill). When running at the edge with ~1900 skills, this JSON dataset totals ~56MB. Performing `JSON.parse` and array operations on a 56MB string in the edge runtime consumes excessive CPU time and memory, leading directly to performance degradation and CPU limit errors.

## 2. Key Findings & Bottlenecks

### Bottleneck A: Related Skills Calculation (`getRelatedSkills`)
In `src/lib/skills.ts`, `getRelatedSkills` is used to find alternatives or related skills for display in cards.
- **Current code**: `const allSkills = await getAllSkills(env);`
- **Impact**: Detail page SSR has to fetch and parse the entire ~56MB skills payload just to display a few related skill cards.
- **Solution**: Replace `getAllSkills(env)` with `getLightweightSkills(env)`. Lightweight skills exclude the large markdown `body` payload but retain all metadata (`category`, `stars`, `topics`, `name`, etc.) required to compute and render the card items. This reduces data load size by ~98%.

### Bottleneck B: Badge SVG API (`src/pages/api/badge.ts`)
The Badge API returns a shields.io-style SVG badge with the total number of skills.
- **Current code**: `const skills = env ? await getAllSkills(env) : [];` followed by `skills.length`.
- **Impact**: Every single README badge request triggers a massive KV load and parsing of all ~1900 skills.
- **Solution**: Implement a dedicated `getTotalSkillsCount(env)` function that reads only the aggregate count via cache or a simple `COUNT(*)` query, bypassing `getAllSkills` completely.

### Bottleneck C: Growth Statistics API (`src/pages/api/stats/growth.ts`)
Provides statistics on total skills, star counts, categories, and recent updates.
- **Current code**: `const skills: UnifiedSkill[] = env ? await getAllSkills(env) : [];`
- **Impact**: Pulls the full body of all skills for aggregation.
- **Solution**: Replace with `getLightweightSkills(env)`.

### Bottleneck D: Search API Fallback (`src/pages/api/skills/search.ts`)
The fallback path for the Search API (when D1 database binding is unavailable) performs keyword search in-memory.
- **Current code**: `_skills = env ? await getAllSkills(env) : [];`
- **Solution**: Replace with `getLightweightSkills(env)`.

### Bottleneck E: Featured Skills Fallback (`getFeaturedSkills`)
In `src/lib/skills.ts`, the fallback path for fetching featured skills (when D1 is missing) uses full parsing.
- **Current code**: `const skills = await getAllSkills(env);`
- **Solution**: Replace with `getLightweightSkills(env)`.

## 3. Implementation Plan Proposal

### 3.1. Extend `src/lib/skills.ts`
Introduce:
```typescript
export async function getTotalSkillsCount(env: Env): Promise<number> {
  const summary = await getLightweightSkillsCategorySummary(env);
  return summary.total;
}
```

### 3.2. Refactor Library Callers
1. Modify `getRelatedSkills` in `src/lib/skills.ts` to call `getLightweightSkills(env)`.
2. Modify `getFeaturedSkills` in `src/lib/skills.ts` to call `getLightweightSkills(env)`.

### 3.3. Refactor API Routes
1. Update `src/pages/api/badge.ts` to import and call `getTotalSkillsCount(env)` instead of `getAllSkills(env)`.
2. Update `src/pages/api/stats/growth.ts` to use `getLightweightSkills(env)` instead of `getAllSkills(env)`.
3. Update `src/pages/api/skills/search.ts` (KV fallback path) to use `getLightweightSkills(env)` instead of `getAllSkills(env)`.

## 4. Verification Plan
- **TypeScript Compilation**: `npm run typecheck`
- **Unit and Integration Tests**: `npm test` (verify all tests in `src/lib/skills.test.ts` and others pass)
- **Astro Build**: `npm run build`
