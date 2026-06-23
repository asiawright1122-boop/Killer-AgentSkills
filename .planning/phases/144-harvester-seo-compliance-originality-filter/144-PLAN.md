---
wave: 1
depends_on: []
files_modified:
  - scripts/lib/originality-filter.ts
  - scripts/lib/originality-filter.test.ts
  - scripts/harvest-github-skills.ts
  - scripts/build-skills-cache.ts
  - scripts/lib/github.ts
  - tests/harvester/originality-filter.test.ts
autonomous: true
---

# Phase 144 Plan: Harvester SEO Compliance & Originality Filter

Refactor the automated skill harvesting (harvester) and auto-submitter workflows to filter low-originality mirror pages at harvest time. This ensures no duplicate, thin, or low-quality content enters the database.

## Goal
Implement a cosine similarity / TF-IDF check on harvested Markdown skills to skip content with >85% similarity compared to existing skills, reject thin/incomplete items, auto-inject canonical backlinks and credits, and log all filtered repositories.

## Architecture
1. **Filter Engine (`scripts/lib/originality-filter.ts`)**: Pure TypeScript implementation of tokenization (supporting Chinese and English), TF-IDF, and Cosine Similarity calculation. Also includes metadata completeness and word-count validation.
2. **Originality Block Injection**: Automatically appends a structured markdown block at the bottom of the skill's body containing repository credits, canonical links, and compatibility badges.
3. **Harvester Integration**: Integration of the validation and similarity checks into `scripts/harvest-github-skills.ts` and `scripts/build-skills-cache.ts` / `scripts/lib/github.ts` crawler steps.
4. **Skip Logger**: Appends log entries to `logs/harvester-skipped.log` for operator audit.
5. **Vitest Verification**: Direct unit tests for the filter engine and integration tests for the harvest runner.

## Tech Stack
- TypeScript (ESNext, tsx loader)
- Vitest

---

## Tasks

### Task 1: Create the Filter Engine

<read_first>
- [scripts/lib/constants.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/constants.ts)
</read_first>

<acceptance_criteria>
- File `scripts/lib/originality-filter.ts` is created.
- Exports `tokenize(text: string): string[]` supporting Chinese characters and English words.
- Exports `calculateIdf(documents: string[][]): Map<string, number>`.
- Exports `getTfIdfVector(tokens: string[], idfMap: Map<string, number>): Map<string, number>`.
- Exports `calculateCosineSimilarity(vectorA: Map<string, number>, vectorB: Map<string, number>): number`.
- Exports `validateOriginalityAndMetadata` checking `owner`, `repo`, `tags`, and body length >= 200 words.
- Exports `injectOriginalityBlock` to append canonical credits to skill body.
</acceptance_criteria>

<action>
Create `scripts/lib/originality-filter.ts` with:
- `tokenize` using regex `/[\u4e00-\u9fa5]|[a-zA-Z0-9_]+/g` for robust multilingual tokens.
- Cosine similarity calculation using dot product divided by magnitude product.
- `validateOriginalityAndMetadata` to enforce owner/repo validation, tag presence (combination of frontmatter tags and repo topics), and body length check (> 200 words).
- `injectOriginalityBlock` appending:
  - Original repository link.
  - Canonical raw source file link.
  - First-party analysis placeholder text.
</action>

---

### Task 2: Implement Filter Engine Unit Tests

<read_first>
- [scripts/lib/originality-filter.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/originality-filter.ts)
</read_first>

<acceptance_criteria>
- File `scripts/lib/originality-filter.test.ts` is created.
- Tests verify similarity calculation (high similarity for overlapping texts, low similarity for different texts).
- Tests verify thin content rejection (body < 200 words).
- Tests verify metadata validation (fails if owner, repo, or tags are missing).
- Tests verify originality block injection adds links and avoids duplicate injection.
- Run `npx vitest run scripts/lib/originality-filter.test.ts` succeeds with 100% pass rate.
</acceptance_criteria>

<action>
Create `scripts/lib/originality-filter.test.ts` with comprehensive unit tests for all functions in `scripts/lib/originality-filter.ts`. Run the tests using `npx vitest run scripts/lib/originality-filter.test.ts`.
</action>

---

### Task 3: Integrate Originality Filter into Harvester Tool

<read_first>
- [scripts/harvest-github-skills.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/harvest-github-skills.ts)
- [scripts/lib/originality-filter.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/originality-filter.ts)
</read_first>

<acceptance_criteria>
- `scripts/harvest-github-skills.ts` loads existing skills from `data/skills-cache.json` (if available) to construct the comparison corpus.
- Calls `validateOriginalityAndMetadata` on newly fetched content.
- Calls similarity check against the corpus. If maximum similarity score > 85%, or metadata/thin validation fails:
  - Repository is skipped and not added to `expanded-github-skills.json`.
  - Appends audit logs to `logs/harvester-skipped.log` detailing the owner/repo, similarity score (if applicable), and skip reason.
</acceptance_criteria>

<action>
Modify `scripts/harvest-github-skills.ts`:
- Import similarity and metadata check utilities from `scripts/lib/originality-filter.ts`.
- Load `data/skills-cache.json` at startup to extract body texts for the similarity corpus.
- In the crawler loop, after fetching content via `fetchSkillContent`, validate it.
- Compute cosine similarity. If >85% similarity or invalid, log the skip reason into `logs/harvester-skipped.log` (with timestamp, repository name, and reason details) and skip the item.
</action>

---

### Task 4: Integrate Originality Block Injection & Discover Filtering into Cache Builder

<read_first>
- [scripts/build-skills-cache.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/build-skills-cache.ts)
- [scripts/lib/github.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/github.ts)
- [scripts/lib/originality-filter.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/originality-filter.ts)
</read_first>

<acceptance_criteria>
- `discoverNewSkillsFromGitHub` in `scripts/lib/github.ts` filters out low-originality or thin content skills during discovery.
- `buildCache` in `scripts/build-skills-cache.ts` automatically calls `injectOriginalityBlock` on new or updated skill bodies before writing them to `data/skills-cache.json`.
</acceptance_criteria>

<action>
Modify `scripts/lib/github.ts` and `scripts/build-skills-cache.ts`:
- In `discoverNewSkillsFromGitHub` (in `scripts/lib/github.ts`), integrate similarity/thin filters when a potential new skill is fetched to reject duplicates before processing.
- In `scripts/build-skills-cache.ts`, when preparing the skill Markdown data for `skills-cache.json`, run `injectOriginalityBlock` on `skillMd.body` to inject canonical backlinks and owner metadata.
</action>

---

### Task 5: Implement Harvester Integration & E2E Tests

<read_first>
- [scripts/harvest-github-skills.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/harvest-github-skills.ts)
- [scripts/lib/originality-filter.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/originality-filter.ts)
</read_first>

<acceptance_criteria>
- File `tests/harvester/originality-filter.test.ts` is created.
- Tests assert that mock low-originality, thin, and metadata-deficient skills are properly skipped and logged during a simulated crawl.
- Tests assert that valid skills are preserved and have the originality block successfully injected.
- `npx vitest run tests/harvester/originality-filter.test.ts` compiles and passes.
</acceptance_criteria>

<action>
Create `tests/harvester/originality-filter.test.ts`. Use mock skill structures to invoke the harvester filtering pipeline and assert:
- Duplicate skill (> 85% overlap) is flagged and logged.
- Thin skill (< 200 words) is flagged and logged.
- Missing crucial metadata (e.g. no topics/tags) is flagged and logged.
- Valid skill completes with an appended originality block in its final payload.
Run Vitest to verify all checks pass.
</action>

---

## Verification Criteria
To verify Phase 144 completeness, run:
1. `npx vitest run scripts/lib/originality-filter.test.ts` - Verify unit tests of similarity and validation routines.
2. `npx vitest run tests/harvester/originality-filter.test.ts` - Verify crawler filtration integration.
3. Check `logs/harvester-skipped.log` creation and format after running mock crawlers.
4. `npm run typecheck` - Verify compile stability across modified modules.
5. `npm run validate:public-surface` - Verify no public copy leakage.

## Must Haves (Goal-Backward Verification)
- [ ] Similarity filter rejects texts matching existing skills with Cosine Similarity > 85%.
- [ ] Validation rejects skill files lacking owner, repo, tags (repo topics + frontmatter tags), or having body < 200 words.
- [ ] Originality metadata block injected at crawl time featuring original repo credit, raw file canonical backlink, and first-party compatibility placeholder.
- [ ] Skipped repositories logged in `logs/harvester-skipped.log`.
- [ ] Zero TypeScript or Vitest compilation issues on all files changed.
