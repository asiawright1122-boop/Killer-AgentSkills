# SEO Monitoring Indexability Prerequisite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the daily SEO monitoring workflow by generating the current skill indexability report before content governance and downstream production checks run.

**Architecture:** Keep the report as an explicit workflow prerequisite, matching the established CI pipeline order. Add a focused source-contract test that locks the generation command before the governance step without changing report generation, indexability policy, or failure semantics.

**Tech Stack:** GitHub Actions YAML, npm scripts, TypeScript, Vitest

## Global Constraints

- Do not alter the Data Pipeline, Cache Warmup, Auto Translate, or Lighthouse workflows.
- Do not commit generated files under `reports/seo/`.
- Do not add fallback reports, `continue-on-error`, or graceful degradation for a missing indexability report.
- Preserve the existing blocking behavior when report generation or content governance fails.
- Keep the change limited to the monitoring prerequisite and its regression test.

## File Structure

- Create `scripts/seo-monitoring-workflow.test.ts`: verifies the monitoring workflow contains the established report-generation command before content governance.
- Modify `.github/workflows/seo-monitoring.yml`: runs the existing skill indexability report generator before content governance.

---

### Task 1: Lock And Restore The Monitoring Prerequisite

**Files:**
- Create: `scripts/seo-monitoring-workflow.test.ts`
- Modify: `.github/workflows/seo-monitoring.yml`

**Interfaces:**
- Consumes: package script `report:seo:skill-indexability`, which writes `reports/seo/latest-skill-indexability.json` and `reports/seo/latest-skill-indexability.md`.
- Produces: a workflow ordering contract where `Generate SEO Indexability Report` completes before `Build Content Governance Report`.

- [ ] **Step 1: Write the failing workflow contract test**

Create `scripts/seo-monitoring-workflow.test.ts` with:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('SEO monitoring workflow', () => {
  it('generates the skill indexability report before content governance', () => {
    const workflow = readFileSync(resolve('.github/workflows/seo-monitoring.yml'), 'utf8');
    const generationStep = '- name: Generate SEO Indexability Report';
    const governanceStep = '- name: Build Content Governance Report';
    const generationIndex = workflow.indexOf(generationStep);
    const governanceIndex = workflow.indexOf(governanceStep);

    expect(generationIndex).toBeGreaterThanOrEqual(0);
    expect(governanceIndex).toBeGreaterThan(generationIndex);
    expect(workflow.slice(generationIndex, governanceIndex)).toContain(
      'run: npm run report:seo:skill-indexability',
    );
  });
});
```

- [ ] **Step 2: Run the test and verify the missing prerequisite is red**

Run:

```bash
npx vitest run scripts/seo-monitoring-workflow.test.ts
```

Expected: FAIL because `generationIndex` is `-1` on the current monitoring workflow.

- [ ] **Step 3: Add the minimal workflow step**

In `.github/workflows/seo-monitoring.yml`, insert immediately before `Build Content Governance Report`:

```yaml
      - name: Generate SEO Indexability Report
        run: npm run report:seo:skill-indexability

```

- [ ] **Step 4: Run the focused test and verify it is green**

Run:

```bash
npx vitest run scripts/seo-monitoring-workflow.test.ts
```

Expected: one test file and one test pass.

- [ ] **Step 5: Verify the real fresh-checkout failure boundary**

Run:

```bash
npm run report:seo:skill-indexability
npm run report:content:governance -- --fail-on=blocking
```

Expected: the indexability JSON and Markdown reports are generated; content governance no longer reports `ERR_MODULE_NOT_FOUND` for `latest-skill-indexability.json` and exits successfully.

- [ ] **Step 6: Run the repository verification suite**

Run:

```bash
npm test
npx prettier --check .github/workflows/seo-monitoring.yml scripts/seo-monitoring-workflow.test.ts
git diff --check
git status --short
```

Expected: all tests pass with the existing single skipped test; Prettier and `git diff --check` pass; only the workflow, contract test, design, and plan files are tracked changes or commits, while generated report files remain ignored.

- [ ] **Step 7: Commit the implementation**

```bash
git add .github/workflows/seo-monitoring.yml scripts/seo-monitoring-workflow.test.ts docs/superpowers/plans/2026-07-26-seo-monitoring-indexability.md
git commit -m "fix(ci): restore SEO monitoring prerequisites"
```

Expected: a focused implementation commit on `codex/fix-seo-monitoring-indexability`.

---

### Task 2: Review, Integrate, And Validate The Live Workflow

**Files:**
- Review only: `.github/workflows/seo-monitoring.yml`
- Review only: `scripts/seo-monitoring-workflow.test.ts`

**Interfaces:**
- Consumes: the passing branch checks and GitHub Actions `workflow_dispatch` entry point.
- Produces: a merged monitoring workflow whose production SEO smoke, GSC, URL inspection, and sitemap crawl steps are no longer skipped because of the missing report.

- [ ] **Step 1: Review the final branch diff**

Run:

```bash
git diff origin/main...HEAD --check
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- .github/workflows/seo-monitoring.yml scripts/seo-monitoring-workflow.test.ts
```

Expected: one prerequisite step, one focused contract test, and no unrelated workflow changes.

- [ ] **Step 2: Push and open a focused pull request**

Run:

```bash
git push -u origin codex/fix-seo-monitoring-indexability
gh pr create --repo asiawright1122-boop/Killer-AgentSkills \
  --base main \
  --head codex/fix-seo-monitoring-indexability \
  --title "fix(ci): restore SEO monitoring prerequisites" \
  --body $'## Root cause\n\nThe daily SEO monitoring workflow ran content governance on a fresh checkout without first generating `reports/seo/latest-skill-indexability.json`. The missing prerequisite failed the route-contract suite and skipped production SEO smoke, GSC, URL inspection, and sitemap crawl checks.\n\n## Fix\n\nGenerate the current skill indexability report before content governance, matching the established CI ordering. Add a focused workflow contract test to preserve that order. Data Pipeline remains enabled and unchanged.\n\n## Verification\n\n- Focused workflow contract test\n- Skill indexability report generation followed by blocking content governance\n- Full Vitest suite\n- Prettier and `git diff --check`'
```

Expected: a ready-for-review PR with CI checks started.

- [ ] **Step 3: Merge only after required checks pass**

Run:

```bash
PR_NUMBER=$(gh pr view codex/fix-seo-monitoring-indexability --repo asiawright1122-boop/Killer-AgentSkills --json number --jq .number)
gh pr checks --repo asiawright1122-boop/Killer-AgentSkills --watch "$PR_NUMBER"
gh pr merge --repo asiawright1122-boop/Killer-AgentSkills "$PR_NUMBER" --squash --delete-branch
```

Expected: all required checks pass before the PR is squash-merged.

- [ ] **Step 4: Manually dispatch the repaired monitoring workflow**

Run:

```bash
gh workflow run seo-monitoring.yml --repo asiawright1122-boop/Killer-AgentSkills --ref main
RUN_ID=$(gh run list --repo asiawright1122-boop/Killer-AgentSkills --workflow seo-monitoring.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch --repo asiawright1122-boop/Killer-AgentSkills "$RUN_ID" --exit-status
```

Expected: `Generate SEO Indexability Report`, `Build Content Governance Report`, `Run Production SEO Smoke`, `Fetch GSC Report`, and `Run Sitemap Crawl Health Audit` execute; the downstream steps are not skipped because of `latest-skill-indexability.json`.

- [ ] **Step 5: Record the recovery-monitoring outcome**

Run:

```bash
gh run view --repo asiawright1122-boop/Killer-AgentSkills "$RUN_ID" --json conclusion,jobs,url
```

Expected: report the final conclusion and any independently failing downstream step without conflating it with the fixed missing-report prerequisite.
