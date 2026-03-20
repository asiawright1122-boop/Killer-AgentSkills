# Killer-Skills Skills-first SEO Rollout Blueprint

## Objective

Complete the remaining Skills-first SEO / IA repair so the public site consistently presents Killer-Skills as an AI Agent Skills / IDE Skills product, while preserving the existing canonical / hreflang / noindex / sitemap infrastructure and preventing generator-driven regressions.

## Execution mode

- **Repository mode:** git repository on `main`, remote default branch `origin/main`
- **GitHub mode:** `gh auth status` is currently unhealthy / timing out, so execute in **direct mode** by default (focused local edits, manual PR creation later if needed)
- **Workspace risk:** the working tree is already heavily modified; every step must touch only the listed files and must not reset or overwrite unrelated changes
- **Planning context already available:** `task_plan.md`, `findings.md`, `progress.md`
- **Cold-start rule:** before starting any step, compare it against the baseline section below and skip already-complete work instead of redoing it

## Current baseline already complete

These are already done and should be treated as baseline, not as work to repeat:

- locale 404 / 4xx `X-Robots-Tag: noindex, nofollow` hotfix and related regression coverage
- canonical collection dedupe at public entry points / sitemap for the first overlap slice
- first-round Skills-first generator cleanup in `query-intent`, `blog-seo-intent`, `skill-seo-intent`, `skill-schema`, and related tests
- skills index / detail, CLI, and integrations page copy convergence slices already completed
- `vitest.config.ts` excludes `.claude/**`, removing worktree test duplication noise
- multiple featured multilingual blog cleanup slices already landed and are guarded in `src/pages/public-links.test.ts`
- latest slice already removed `ContinueWindsurf` pollution from the tracked `best-ai-agent-skills-2026` locales and fixed the tracked `de` / `ru` `what-are-ai-agent-skills` issues

## Remaining gaps this blueprint targets

- unresolved authority-surface wording gaps across `README` / `llms*` / message-backed public copy
- any remaining shared-generator outputs that still default to MCP-first phrasing
- template-level fallback metadata / schema gaps on high-value public pages
- remaining featured / high-traffic multilingual blog pollution outside the slices already locked by tests
- unresolved collections overlap decisions, especially the next suspicious pair: `top-mcp-mcp-servers.json` and `top-mcp-server-mcp-servers.json`
- upstream generator entrypoints that can regenerate ontology drift (`scripts/build-skills-cache.ts`, `scripts/lib/ai.ts`, long-tail generators, keyword opportunity analysis)
- final verification, rollout notes, and production follow-up

## Global invariants

1. Preserve existing technical SEO infrastructure: canonical, hreflang, robots, noindex, sitemap behavior must remain intact.
2. Keep fixes **incremental and test-first**. Extend regression tests before broadening implementation scope.
3. Do not reintroduce MCP-first phrasing on generic public pages. MCP remains valid only as a secondary capability on MCP-intent pages.
4. Do not start mass slug migration or 301 rollout until a canonical map artifact is explicitly prepared.
5. Do not touch unrelated dirty files outside the step’s file list.
6. Do not use destructive git commands.
7. A fresh agent must always check whether a step is already satisfied before editing.

## Anti-goals

- No full-site content rewrite in one pass
- No premature redirect migration
- No cleanup of unrelated CSS minify warnings in this blueprint
- No rename of internal i18n keys unless public output depends on it

## Dirty-workspace rollback protocol

Because the repository is already dirty, rollback must be step-scoped and hunk-scoped:

1. Capture a step-local diff / patch before broad edits if the step will touch many files.
2. If rollback is needed, reverse **only** the hunks introduced by that step.
3. Never restore an entire file if that file had pre-existing unrelated edits.
4. After rollback, rerun the step’s verification commands before proceeding.

## Dependency graph

```text
Step 1 ──▶ Step 2 ──▶ Step 3 ──┬──▶ Step 4 ──┐
                               └──▶ Step 5 ──┼──▶ Step 6 ──▶ Step 7
```

## Parallelism summary

- **Serial foundation:** Steps 1–3
- **Parallel lane A:** Step 4 (high-value blog corpus)
- **Parallel lane B:** Step 5 (collections overlap + canonical map artifact)
- **Serial finish:** Steps 6–7

## Step 1 — Lock authority surfaces and terminology contract

- **Recommended branch name:** `seo/skills-first-authority-surfaces`
- **Model tier:** strongest
- **Depends on:** none

### Context brief

The repo already fixed several public outputs, but the highest-authority definition surfaces may still have unresolved wording gaps. This step is only for the remaining gaps, not for redoing already-green slices. The main authority layer is `README.md`, `src/pages/llms.txt.ts`, `src/pages/llms-full.txt.ts`, and public message-backed copy.

### Skip condition

Skip this step if authority-surface wording is already aligned and the verification suite below is green without edits.

### Files in scope

- `README.md`
- `src/pages/llms.txt.ts`
- `src/pages/llms-full.txt.ts`
- `src/messages/en.json`
- `src/messages/*.json` only if a public string actually renders and cannot be fixed from `en.json`
- `src/messages/public-copy.test.ts`
- `src/pages/llms-full.txt.test.ts`
- `src/pages/public-links.test.ts` if new public contracts are needed

### Task list

1. Audit authority-surface copy for any remaining MCP-first default framing.
2. Standardize the installation verb and command shape around `npx killer-skills add owner/repo`.
3. Make the Skills vs MCP hierarchy explicit in machine-readable surfaces.
4. Emit an explicit terminology contract in tests / plan notes:
   - banned default framing
   - allowed MCP-intent exceptions
   - canonical install command wording
5. Add or extend regression tests that fail if forbidden authority-surface phrases return.
6. Keep internal key names stable unless public output requires change.

### Verification

```bash
npx vitest run src/messages/public-copy.test.ts src/pages/llms-full.txt.test.ts src/pages/public-links.test.ts
npm run check:astro
```

### Exit criteria

- Authority surfaces identify the product as Skills-first by default
- Public machine-readable docs no longer imply “MCP marketplace” as the main entity
- Guardrail tests cover the changed phrases and terminology contract

### Rollback strategy

Reverse only the hunks introduced in this step using the dirty-workspace rollback protocol. Never restore whole authority-surface files if they already had unrelated local edits.

---

## Step 2 — Rebalance shared SEO generators and install minimal upstream guardrails

- **Recommended branch name:** `seo/skills-first-generators`
- **Model tier:** strongest
- **Depends on:** Step 1

### Context brief

Ontology drift still originates in shared generator code. Existing repo knowledge points to `seo-keywords`, `query-intent`, `blog-seo-intent`, `skill-seo-intent`, and `skill-schema` as the main propagation layer. This step must also install **minimal upstream guardrails** in the earliest generation entrypoints before more corpus cleanup, so later content sweeps do not fight regenerated drift.

### Skip condition

Skip only if both conditions hold:

- shared SEO generators already emit Skills-first defaults on generic outputs, and
- upstream generation entrypoints already enforce the minimal terminology floor

### Files in scope

- `src/lib/seo-keywords.ts`
- `src/lib/query-intent.ts`
- `src/lib/blog-seo-intent.ts`
- `src/lib/skill-seo-intent.ts`
- `src/lib/skill-schema.ts`
- `scripts/build-skills-cache.ts`
- `scripts/lib/ai.ts`
- `src/lib/seo-keywords.test.ts`
- `src/lib/query-intent.test.ts`
- `src/lib/blog-seo-intent.test.ts`
- `src/lib/skill-seo-intent.test.ts`
- `src/lib/skill-schema.test.ts`
- Paired tests for any touched generation entrypoint if they do not already exist

### Task list

1. Reweight default keyword clusters so Skills / IDE / workflow terms outrank MCP on generic intents.
2. Preserve MCP-specific recall on clearly MCP-targeted queries without letting it dominate sitewide defaults.
3. Ensure schema descriptions and keywords stay Skills-first.
4. Install a minimum forbidden-term / canonical-command guardrail in `scripts/build-skills-cache.ts` and `scripts/lib/ai.ts` so upstream generation cannot silently revert to MCP-first defaults.
5. Add or strengthen tests for display text, descriptions, keyword output, schema contracts, and the new minimal upstream guardrails.
6. Keep the implementation minimal; rebalance rather than rewrite from scratch.

### Verification

```bash
npx vitest run src/lib/seo-keywords.test.ts src/lib/query-intent.test.ts src/lib/blog-seo-intent.test.ts src/lib/skill-seo-intent.test.ts src/lib/skill-schema.test.ts
npm run check:astro
npm run audit:seo:index-integrity
```

### Exit criteria

- Shared generators produce Skills-first defaults on generic public outputs
- MCP still appears only where intent justifies it
- The earliest active generation entrypoints enforce a minimum terminology floor
- Tests explicitly lock the new weighting and phrasing behavior

### Rollback strategy

Reverse only the hunks introduced in this step using the dirty-workspace rollback protocol. If partial regressions appear, roll back the smallest generator or entrypoint responsible instead of reverting the whole step.

---

## Step 3 — Converge high-value public page templates and rendered metadata

- **Recommended branch name:** `seo/skills-first-public-templates`
- **Model tier:** default
- **Depends on:** Step 2

### Context brief

After generators and minimum upstream guardrails are corrected, the highest-value templates must consume them consistently. Previous slices already improved skills index/detail, CLI, integrations, and collections dedupe, but this step is the deliberate template convergence pass for any remaining gaps.

### Skip condition

Skip this step if template-level fallback metadata and schema already render Skills-first across the sampled high-value routes and verification stays green.

### Files in scope

- `src/pages/[locale]/index.astro`
- `src/pages/[locale]/skills/index.astro`
- `src/pages/[locale]/skills/[owner]/[...repo].astro`
- `src/pages/[locale]/cli/index.astro`
- `src/pages/[locale]/integrations/index.astro`
- `src/pages/[locale]/collections/index.astro`
- `src/pages/[locale]/collections/[...slug].astro`
- `src/pages/[locale]/blog/index.astro`
- `src/pages/[locale]/categories/index.astro`
- `src/pages/[locale]/community/index.astro`
- `src/pages/[locale]/solutions/index.astro`
- `src/pages/[locale]/docs/[...slug].astro`
- `src/pages/public-links.test.ts`
- `src/messages/public-copy.test.ts` if page copy is sourced from messages

### Task list

1. Audit title / description / H1 / CTA / schema usage on the highest-value public templates.
2. Remove any remaining generic MCP-first framing from template-level fallbacks.
3. Keep page-specific MCP framing only where the page truly targets MCP content.
4. Audit supplemental public entry points (`community`, `solutions`, docs landing/detail) if they reuse shared fallback copy or metadata.
5. Add or extend source-level public contract tests for newly corrected copy.
6. Validate rendered output, not just source strings, for at least:
   - home
   - skills index
   - one skill detail
   - one collection detail

### Verification

```bash
npx vitest run src/pages/public-links.test.ts src/messages/public-copy.test.ts
npm run check:astro
npm run build
npm run seo:smoke
```

### Exit criteria

- High-value templates read as Skills-first even with fallback metadata
- No template-level fallback can reintroduce MCP-first copy on generic pages
- Rendered metadata / schema for sampled high-value routes is verified via build + smoke checks
- Public contract tests cover the corrected template outputs

### Rollback strategy

Reverse only the hunks introduced in this step using the dirty-workspace rollback protocol. Do not revert Step 2 generator logic unless the issue is proven to originate there.

---

## Step 4 — Sweep featured multilingual blog corpus

- **Recommended branch name:** `seo/skills-first-featured-blogs`
- **Model tier:** default
- **Depends on:** Step 3
- **Parallelizable with:** Step 5

### Context brief

High-priority multilingual blog pages have repeatedly leaked wrong-locale `/en/skills` links and template pollution such as `ContinueWindsurf`, cross-language headings, JSON remnants, and mixed-language scaffolding. The repo already has a growing source-level contract suite in `src/pages/public-links.test.ts`; this step continues using that test-first approach for the remaining slices.

### Skip condition

Skip if the candidate priority list below has been checked and no remaining wrong-locale links or known pollution markers remain for the uncovered locales.

### Priority candidate order

Work in this order unless a newly discovered higher-traffic regression appears:

1. `best-ai-agent-skills-2026`
2. `what-are-ai-agent-skills`
3. `how-to-install-ai-agent-skills`
4. `announcing-killer-skills`
5. `official-ai-agent-skills-guide`
6. `introducing-openclaw-autonomous-ai-agent`
7. Other featured slugs only after the list above is clean

### Files in scope

- `src/content/blog/{ar,de,en,es,fr,ja,ko,pt,ru,zh}/*.md` for the candidate slugs above only
- `src/pages/public-links.test.ts`
- Small helper tests only if needed for reusable content guards

### Task list

1. Search the priority candidate list for wrong-locale `/en/skills` links and obvious template pollution.
2. Extend source-level regression assertions before each new cleanup slice.
3. Repair only the specific polluted sections; avoid rewriting healthy sections.
4. Keep a running list of already-cleared slugs inside `task_plan.md` / `progress.md`.
5. Stop when the next slice becomes low-value or clearly needs generator-level work instead.

### Verification

```bash
npx vitest run src/pages/public-links.test.ts
npm run check:astro
```

### Exit criteria

- Priority featured multilingual blog pages no longer contain known pollution markers for the targeted slice
- Wrong-locale skills-directory links are fixed for the targeted slice
- New blog regressions are locked in `src/pages/public-links.test.ts`

### Rollback strategy

Reverse only the hunks introduced in this step using the dirty-workspace rollback protocol. Never discard entire blog files if they had unrelated local edits.

---

## Step 5 — Finish collections overlap decisions and create canonical map artifact

- **Recommended branch name:** `seo/collections-canonical-map`
- **Model tier:** strongest
- **Depends on:** Step 3
- **Parallelizable with:** Step 4

### Context brief

One cannibalization slice is already complete (`top-ai-agents-mcp-servers` consolidated into `top-agentic-ai-platforms-orchestration-tools`). Current findings say the next most suspicious overlaps are `top-mcp-mcp-servers.json` and `top-mcp-server-mcp-servers.json`. This step is not a full redirect rollout; it is a decision + artifact preparation step.

### Skip condition

Skip only if the next suspicious collection pair already has an explicit keep / merge / retire decision and the canonical map artifact below already exists and reflects that decision.

### Artifact definition

Create or update:

- `data/seo-collection-canonical-map.json`

Suggested structure:

```json
{
  "generatedAt": "2026-03-19",
  "collections": [
    {
      "sourceSlug": "top-mcp-mcp-servers",
      "decision": "keep|merge|retire",
      "canonicalSlug": "top-agentic-ai-platforms-orchestration-tools",
      "redirectPhase": "later",
      "notes": "why this decision was chosen"
    }
  ]
}
```

### Files in scope

- `src/content/collections/*.json` for the overlap candidates only
- `src/lib/collection-slugs.ts`
- `src/lib/collection-slugs.test.ts`
- `src/pages/[locale]/collections/index.astro`
- `src/pages/sitemap-collections.xml.ts`
- `src/pages/llms-full.txt.ts` if canonical collection references change
- `data/seo-collection-drift.json` / `scripts/seo-collection-drift.ts` if they are active audit inputs
- `data/seo-collection-canonical-map.json`
- `src/pages/public-links.test.ts` / `src/pages/llms-full.txt.test.ts` if public references change

### Task list

1. Audit the remaining high-overlap collection candidates, starting with `top-mcp-mcp-servers.json` and `top-mcp-server-mcp-servers.json`.
2. Decide per candidate: keep distinct, merge into existing canonical, or retire later.
3. If a canonical decision is made, update only the minimal slug metadata and public references needed.
4. Write the canonical decision artifact to `data/seo-collection-canonical-map.json` without rolling redirects yet.
5. Add or extend regression tests so canonical references stay stable.

### Verification

```bash
npx vitest run src/lib/collection-slugs.test.ts src/pages/public-links.test.ts src/pages/llms-full.txt.test.ts
npm run check:astro
```

### Exit criteria

- High-overlap collection candidates have an explicit keep / merge / retire decision
- Any new canonical slug decisions are reflected in public references and tests
- `data/seo-collection-canonical-map.json` exists and is ready for a future redirect phase to consume

### Rollback strategy

Reverse only the hunks introduced in this step using the dirty-workspace rollback protocol. Keep the written decision artifact unless it is proven incorrect.

---

## Step 6 — Expand guardrails to remaining generators and scripts

- **Recommended branch name:** `seo/generator-guardrails`
- **Model tier:** strongest
- **Depends on:** Steps 4 and 5

### Context brief

The site will regress again if secondary generators keep emitting MCP-first or duplicate-canonical outputs. Step 2 installs the minimum upstream floor; this step expands the policy to the remaining generator and audit surfaces.

### Skip condition

Skip if active generation and audit scripts already consume the terminology contract and canonical map artifact, and no active script can regenerate the known drift patterns.

### Files in scope

- `scripts/generate-longtail-collections.ts`
- `scripts/generate-blog-posts.ts` if it exists and is still active
- `scripts/analyze-keyword-opportunities.ts`
- `scripts/seo-collection-drift.ts`
- `scripts/build-skills-cache.ts` if additional guardrails are still needed after Step 2
- `scripts/lib/ai.ts` if additional guardrails are still needed after Step 2
- `src/lib/solution-intents.ts` if required by generator output
- `data/seo-collection-canonical-map.json`
- Any tests or smoke checks that validate generator policy
- Optional docs note in `README.md` or `docs/` only if necessary to document a hard stop / policy change

### Task list

1. Identify which remaining active generators still emit banned framing or noisy long-tail variants.
2. Either harden them with minimal policy logic or explicitly pause the unsafe generation path.
3. Consume the terminology contract and `data/seo-collection-canonical-map.json` where generation decisions are made.
4. If a touched generator lacks tests, add a minimal fixture-based or policy-based test before shipping.
5. Keep the change small enough to review safely in a dirty workspace.

### Verification

```bash
npx vitest run src/lib/seo-keywords.test.ts src/lib/query-intent.test.ts src/lib/blog-seo-intent.test.ts src/lib/collection-slugs.test.ts src/pages/public-links.test.ts src/pages/llms-full.txt.test.ts
npm run audit:seo:index-integrity
npm run audit:seo:index-quality
```

### Exit criteria

- Active generators no longer default to MCP-first framing on generic outputs
- Canonical overlap rules exist in executable policy, not just notes
- Audit commands remain green after the changes

### Rollback strategy

Reverse only the hunks introduced in this step using the dirty-workspace rollback protocol. If a generator hardening breaks downstream output, revert the smallest policy block possible rather than backing out unrelated guardrails.

---

## Step 7 — Full verification, rollout notes, and production follow-up checklist

- **Recommended branch name:** `seo/final-verification-rollout`
- **Model tier:** default
- **Depends on:** Steps 1–6

### Context brief

The repo already has a working verification chain, but the final step must turn the incremental work into a repeatable release checklist. This includes local verification, deploy-readiness notes, and production follow-up items (especially for GSC / canonical validation).

### Skip condition

Do not skip this step if any prior step changed code or content.

### Files in scope

- `task_plan.md`
- `progress.md`
- `findings.md` if any new durable implementation finding emerged
- Optional rollout note under `docs/plans/` or `plans/` if a dedicated handoff doc is necessary
- No broad source changes unless verification exposes a specific regression

### Task list

1. Run the full local verification chain.
2. Record pass / fail state and any non-blocking warnings.
3. Write a short rollout checklist covering deploy, crawl verification, and GSC follow-up.
4. Note any intentionally deferred work (for example CSS minify warning cleanup) so future sessions do not confuse it with SEO blockers.

### Verification

```bash
npm run check:astro
npm run build
npm run seo:smoke
npm run audit:seo:index-integrity
npm run audit:seo:index-quality
npm run report:seo:collection-locale-gaps
```

### Exit criteria

- Full local verification chain passes
- Rollout notes identify what still needs deploy / production validation
- Deferred non-blockers are explicitly documented

### Rollback strategy

No broad rollback is expected here. If verification exposes a regression, stop and reopen the responsible prior step instead of patching blindly inside the verification step.

---

## Mutation protocol

If execution reality diverges from this blueprint, mutate the plan explicitly:

- **Split a step** when a single step exceeds one reviewable PR-sized change.
- **Insert a step** when a newly discovered dependency blocks progress.
- **Reorder steps** only if invariants still hold and the dependency graph is updated.
- **Abandon a step** only with a written reason and a note describing what replaced it.
- **Never silently widen scope** from incremental repair into mass migration.

## Recommended execution order for fresh agents

1. Read this file.
2. Read `task_plan.md`, `progress.md`, and `findings.md`.
3. Compare the target step against the “Current baseline already complete” section and skip any already-satisfied step.
4. Confirm the listed files for the target step still match current repo state.
5. Write or extend tests first.
6. Implement only the target step.
7. Run the listed verification commands.
8. Update `task_plan.md` and `progress.md` before handing off.

## Current best next step

Use this decision rule:

- **If the goal is low-risk incremental progress right now:** start with **Step 4** and continue the test-first featured blog sweep.
- **If the goal is to reduce future drift before more corpus work:** execute the unresolved parts of **Step 2** first.
- **If the goal is collections IA cleanup:** start with **Step 5**, beginning at `top-mcp-mcp-servers.json` and `top-mcp-server-mcp-servers.json`.

Do **not** restart blindly from Step 1 unless the baseline check shows unresolved authority-surface gaps that are not already covered.
