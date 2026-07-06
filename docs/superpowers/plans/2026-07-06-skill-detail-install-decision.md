# Skill Detail Install Decision Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the skill detail page as an install decision page where users can judge fit, trust, and install path from the first viewport.

**Architecture:** Keep the existing SSR data pipeline and SEO/schema behavior, but introduce a small detail view-model helper so the Astro template can render concise decision sections. The page layout becomes: decision hero with sticky install panel, fit/tasks, review/permissions, source evidence, FAQ, related skills. Existing install, actions, file switching, README rendering, FAQ, and related-skill components remain functional while their placement and shells are updated.

**Tech Stack:** Astro 6, TypeScript, Vitest, Playwright, Tailwind utility classes, existing CSS tokens in `src/styles/global.css`, lucide-react icons already used by this codebase.

## Global Constraints

- Match the marketplace IA: `首页 / Skills / 榜单 / 职业 / 分类`.
- Keep exactly one visible page H1.
- Install command must appear above README/source evidence.
- Platform review is a product verdict, not user guidance.
- README/source material remains available but must not dominate the hierarchy.
- No horizontal overflow at 390px width.
- Avoid viewport-scaled typography; use fixed responsive steps.
- Do not change ingestion, ranking, safety scoring, or crawler/indexability logic except markup order required for safer rendering.
- Reuse existing behavior for install command, file switching, README rendering, actions, schema, FAQ, and related skills where possible.

---

## File Structure

- Modify `src/pages/[locale]/skills/[owner]/[...repo].astro`
  - Keep data fetching, SEO, JSON-LD, and fallback behavior.
  - Replace the non-directory skill rendering markup with the install decision page structure.
  - Add compact local arrays for task chips, source identity, and section visibility if a helper would add unnecessary churn.
- Modify `src/components/SkillInstall.astro`
  - Make the install component usable inside a compact sticky decision panel without nested-card visual clutter.
  - Keep copy and deep-link behavior intact.
- Modify `src/components/SkillReadmeNative.astro`
  - Ensure README source content does not introduce a second dominant page H1.
  - Keep file switching/copy behavior intact.
- Modify `src/components/SkillFileManagerNative.astro`
  - Reduce visual weight so it works as source evidence, not a primary IDE mockup.
- Modify `src/styles/global.css`
  - Add detail-page surface classes for decision hero, verdict panel, metadata rows, and source evidence.
- Test/create `src/lib/skill-detail-view.test.ts` only if helper functions are extracted to `src/lib/skill-detail-view.ts`.
  - If the implementation stays local to Astro, skip this file and cover behavior through existing helper tests plus browser smoke.

---

### Task 1: Add Detail Page View Helpers

**Files:**
- Create: `src/lib/skill-detail-view.ts`
- Create: `src/lib/skill-detail-view.test.ts`

**Interfaces:**
- Consumes: arrays of strings from `renderedUseCases`, `rawTopics`, and risk labels.
- Produces:
  - `pickDetailTaskChips(input: { useCases: string[]; topics: string[]; features: string[]; limit?: number }): string[]`
  - `getDetailSourceKind(input: { isVerified: boolean; sourceKind?: 'official' | 'community' | string }): 'official' | 'community'`
  - `buildDetailRiskChips(input: { visibleRiskLabels: string[]; riskFlags: Array<{ code?: string; label?: string }> }): string[]`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildDetailRiskChips, getDetailSourceKind, pickDetailTaskChips } from './skill-detail-view';

describe('pickDetailTaskChips', () => {
  it('prefers use cases, then features, then topics, and deduplicates labels', () => {
    expect(
      pickDetailTaskChips({
        useCases: ['Generate reports', 'Generate reports'],
        features: ['Read Markdown'],
        topics: ['markdown', 'automation'],
        limit: 3,
      }),
    ).toEqual(['Generate reports', 'Read Markdown', 'markdown']);
  });

  it('drops empty labels and respects the limit', () => {
    expect(
      pickDetailTaskChips({
        useCases: ['', '  ', 'Deploy'],
        features: ['Review'],
        topics: ['Audit'],
        limit: 2,
      }),
    ).toEqual(['Deploy', 'Review']);
  });
});

describe('getDetailSourceKind', () => {
  it('treats verified skills as official when source kind is missing', () => {
    expect(getDetailSourceKind({ isVerified: true })).toBe('official');
  });

  it('keeps explicit community source kind', () => {
    expect(getDetailSourceKind({ isVerified: true, sourceKind: 'community' })).toBe('community');
  });
});

describe('buildDetailRiskChips', () => {
  it('uses visible review labels first and deduplicates risk flag labels', () => {
    expect(
      buildDetailRiskChips({
        visibleRiskLabels: ['Token', 'Network'],
        riskFlags: [{ label: 'Network' }, { label: 'File write' }],
      }),
    ).toEqual(['Token', 'Network', 'File write']);
  });

  it('falls back to no blockers when no risks exist', () => {
    expect(buildDetailRiskChips({ visibleRiskLabels: [], riskFlags: [] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/lib/skill-detail-view.test.ts`

Expected: FAIL because `src/lib/skill-detail-view.ts` does not exist.

- [ ] **Step 3: Implement helper functions**

```ts
type SkillSourceKind = 'official' | 'community';

const normalizeLabel = (value: unknown) => String(value ?? '').trim();

function uniqueNonEmpty(values: string[], limit = 6): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const label = normalizeLabel(value);
    if (!label) continue;

    const key = label.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(label);
    if (result.length >= limit) break;
  }

  return result;
}

export function pickDetailTaskChips(input: {
  useCases: string[];
  topics: string[];
  features: string[];
  limit?: number;
}): string[] {
  return uniqueNonEmpty([...(input.useCases || []), ...(input.features || []), ...(input.topics || [])], input.limit ?? 6);
}

export function getDetailSourceKind(input: {
  isVerified: boolean;
  sourceKind?: 'official' | 'community' | string;
}): SkillSourceKind {
  return input.sourceKind === 'official' || input.sourceKind === 'community'
    ? input.sourceKind
    : input.isVerified
      ? 'official'
      : 'community';
}

export function buildDetailRiskChips(input: {
  visibleRiskLabels: string[];
  riskFlags: Array<{ code?: string; label?: string }>;
}): string[] {
  const fallbackLabels = (input.riskFlags || []).map((flag) => flag.label || flag.code || '');
  return uniqueNonEmpty([...(input.visibleRiskLabels || []), ...fallbackLabels], 5);
}
```

- [ ] **Step 4: Run tests and verify pass**

Run: `npx vitest run src/lib/skill-detail-view.test.ts`

Expected: PASS with 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/skill-detail-view.ts src/lib/skill-detail-view.test.ts
git commit -m "feat: add skill detail view helpers"
```

### Task 2: Rebuild Skill Detail Decision Hero

**Files:**
- Modify: `src/pages/[locale]/skills/[owner]/[...repo].astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: Task 1 helpers.
- Produces: `detailTaskChips`, `detailSourceKind`, `detailRiskChips`, `detailSourceLabel`, and a new hero structure where install/review appears before README.

- [ ] **Step 1: Import helpers and derive view data**

In `src/pages/[locale]/skills/[owner]/[...repo].astro`, add:

```ts
import { buildDetailRiskChips, getDetailSourceKind, pickDetailTaskChips } from '../../../../lib/skill-detail-view';
```

After `const visibleRiskLabels = ...`, add:

```ts
const detailTaskChips = pickDetailTaskChips({
  useCases: renderedUseCases,
  features: renderedFeatures,
  topics: rawTopics,
  limit: 6,
});
const detailSourceKind = getDetailSourceKind({
  isVerified,
  sourceKind: (skill as { sourceKind?: string }).sourceKind,
});
const detailSourceLabel =
  detailSourceKind === 'official' ? (isZhLocale ? '官方来源' : 'Official source') : isZhLocale ? '社区来源' : 'Community source';
const detailRiskChips = buildDetailRiskChips({ visibleRiskLabels, riskFlags: skillRiskFlags });
const detailReviewStatus =
  skillSecurityLevel === 'D'
    ? isZhLocale
      ? '未进入推荐目录'
      : 'Not promoted'
    : isZhLocale
      ? '已通过基础审核'
      : 'Baseline reviewed';
```

- [ ] **Step 2: Add CSS utilities**

Append to the marketplace/detail utility section in `src/styles/global.css`:

```css
.skill-decision-shell {
  display: grid;
  gap: 1.25rem;
}

@media (min-width: 1024px) {
  .skill-decision-shell {
    grid-template-columns: minmax(0, 1fr) minmax(320px, 380px);
    align-items: start;
  }
}

.skill-decision-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: color-mix(in oklch, var(--card) 92%, var(--background));
  box-shadow: var(--card-shadow);
}

.skill-decision-command {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--secondary);
  color: var(--secondary-foreground);
}

.skill-evidence-shell {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: color-mix(in oklch, var(--card) 86%, var(--background));
  overflow: hidden;
}
```

- [ ] **Step 3: Replace the non-directory hero markup**

Replace the non-directory `<section class="skill-detail-hero ...">...</section>` block with:

```astro
<section class="mb-8 border-b border-[var(--border)] pb-8">
  <div class="skill-decision-shell">
    <div class="min-w-0">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <span class="market-chip px-2 py-1 text-xs">{detailSourceLabel}</span>
        {category && <a class="market-chip px-2 py-1 text-xs" href={`/${locale}/categories/${skill.category}`}>{category}</a>}
        <span class="market-chip px-2 py-1 text-xs">v{version}</span>
        {isVerified && (
          <span class="market-chip px-2 py-1 text-xs bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]">
            {verifiedLabel}
          </span>
        )}
      </div>

      <h1 class="text-3xl md:text-5xl font-bold leading-tight text-[var(--foreground)] break-words">
        {skillDisplayName}
      </h1>

      <p class="seo-intro-paragraph mt-4 max-w-3xl text-lg md:text-xl font-semibold leading-snug text-[var(--foreground)]">
        {renderedRecommendation || heroIntro}
      </p>

      {renderedSuitability && (
        <p class="mt-3 max-w-3xl text-sm md:text-base leading-relaxed text-[var(--muted-foreground)]">
          {renderedSuitability}
        </p>
      )}

      {detailTaskChips.length > 0 && (
        <div class="mt-5 flex flex-wrap gap-2">
          {detailTaskChips.map((chip) => (
            <span class="market-chip px-2.5 py-1.5 text-xs">{chip}</span>
          ))}
        </div>
      )}

      <div class="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[var(--border)] pt-5 text-sm font-bold text-[var(--foreground)]">
        <a href={githubUrl} target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 hover:text-[var(--accent)]">
          <img src={`https://github.com/${owner}.png`} alt={owner} width="28" height="28" class="h-8 w-8 rounded-md border border-[var(--border)]" loading="lazy" decoding="async" />
          <span>{owner}</span>
        </a>
        <span class="flex items-center gap-2"><Star size={16} strokeWidth={3} />{starsDisplay}</span>
        <span class="flex items-center gap-2"><GitFork size={16} strokeWidth={3} />{skill.forks || 0}</span>
        <span class="flex items-center gap-2"><Calendar size={16} strokeWidth={3} />{updatedLabel}: {new Date(skill.updatedAt).toLocaleDateString()}</span>
      </div>
    </div>

    <aside class="skill-decision-panel p-4 lg:sticky lg:top-24">
      <div class="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold">{isZhLocale ? '安装决策' : 'Install Decision'}</h2>
          <p class="mt-1 text-sm font-semibold text-[var(--muted-foreground)]">{detailReviewStatus}</p>
        </div>
        <SkillActionsNative
          skillId={fullId}
          skillName={skillDisplayName}
          owner={owner}
          repo={repo}
          description={description && typeof description === 'string' ? description : ''}
          locale={locale}
          labels={{
            addToFavorites: t('Aria.addToFavorites'),
            removeFromFavorites: t('Aria.removeFromFavorites'),
            shareSkill: t('Aria.shareSkill'),
          }}
          variant="button"
        />
      </div>

      <div class="grid grid-cols-2 gap-2">
        {trustReviewRows.map((row) => (
          <div class="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <span class="block text-[10px] font-mono font-black text-[var(--muted-foreground)]">{row.label}</span>
            <strong class="mt-1 block text-base font-black">{row.value}</strong>
          </div>
        ))}
      </div>

      {detailRiskChips.length > 0 && (
        <div class="mt-3 flex flex-wrap gap-2">
          {detailRiskChips.map((label) => (
            <span class="market-chip px-2 py-1 text-[10px]">{label}</span>
          ))}
        </div>
      )}

      <div class="mt-4">
        <SkillInstall
          installCommand={installCommand}
          installationLabel={t('Detail.installation')}
          installNowLabel={installNowLabel}
          universalInstallLabel={tr('Detail.universalInstall', 'Universal Install (Auto-Detect)')}
          platformSupportLabel={platformSupportLabel}
          plusMoreLabel={plusMoreLabel}
          compact={true}
        />
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2">
        <a href={githubUrl} target="_blank" rel="noopener noreferrer" class="market-button px-3 py-2 text-sm">
          <Github size={16} className="text-current" />
          <span>GitHub</span>
        </a>
        <a href={`/${locale}/safe`} class="market-button px-3 py-2 text-sm bg-[var(--card)] text-[var(--foreground)]">
          <span>{isZhLocale ? '审核政策' : 'Review policy'}</span>
        </a>
      </div>
    </aside>
  </div>
</section>
```

- [ ] **Step 4: Run Astro check for compile feedback**

Run: `npm run check:astro`

Expected: 0 errors. Existing unrelated hints may remain.

- [ ] **Step 5: Commit**

```bash
git add src/pages/[locale]/skills/[owner]/[...repo].astro src/styles/global.css
git commit -m "feat: rebuild skill detail decision hero"
```

### Task 3: Make Install And Source Components Fit The New Layout

**Files:**
- Modify: `src/components/SkillInstall.astro`
- Modify: `src/components/SkillReadmeNative.astro`
- Modify: `src/components/SkillFileManagerNative.astro`

**Interfaces:**
- Consumes: `compact?: boolean` prop in `SkillInstall`.
- Produces: compact install panel variant and lower-visual-weight source evidence components.

- [ ] **Step 1: Add `compact` prop to SkillInstall**

In `src/components/SkillInstall.astro`, update the props and destructuring:

```ts
interface Props {
  installCommand: string;
  installationLabel: string;
  installNowLabel: string;
  universalInstallLabel: string;
  platformSupportLabel: string;
  plusMoreLabel: string;
  compact?: boolean;
}

const {
  installCommand,
  installationLabel,
  installNowLabel,
  universalInstallLabel,
  platformSupportLabel,
  plusMoreLabel,
  compact = false,
} = Astro.props;
```

- [ ] **Step 2: Apply compact classes**

Change the root wrapper and padding classes so compact mode does not create a nested heavy card:

```astro
<div class:list={['overflow-hidden flex flex-col', compact ? 'rounded-md border border-[var(--border)] bg-[var(--background)]' : 'skill-detail-card']}>
  <div class:list={[
    'bg-[var(--foreground)] text-[var(--background)] flex items-center justify-between',
    compact ? 'px-3 py-2' : 'px-4 py-3',
  ]}>
```

Change the content wrapper:

```astro
<div class:list={['relative bg-[var(--background)]', compact ? 'p-3' : 'p-6']}>
```

Keep existing button IDs, `data-install-command`, `data-command`, and deep-link script unchanged.

- [ ] **Step 3: Prevent README H1 dominance**

In `src/components/SkillReadmeNative.astro`, change both prose class strings from:

```astro
prose-h1:text-4xl
```

to:

```astro
prose-h1:text-2xl prose-h1:mt-0
```

Also change the content area height from:

```astro
<div class="relative h-[400px] group/scroll">
```

to:

```astro
<div class="relative max-h-[560px] min-h-[320px] group/scroll">
```

and the inner scroll container from `h-full` to `max-h-[560px] min-h-[320px]`.

- [ ] **Step 4: Reduce file manager height**

In `src/components/SkillFileManagerNative.astro`, change:

```astro
<div class="skill-detail-card overflow-hidden flex flex-col h-[400px] transition-colors duration-300">
```

to:

```astro
<div class="skill-detail-card overflow-hidden flex flex-col min-h-[260px] transition-colors duration-300">
```

- [ ] **Step 5: Run targeted checks**

Run: `npm run check:astro`

Expected: 0 errors. Existing unrelated hints may remain.

- [ ] **Step 6: Commit**

```bash
git add src/components/SkillInstall.astro src/components/SkillReadmeNative.astro src/components/SkillFileManagerNative.astro
git commit -m "feat: adapt install and source panels for detail page"
```

### Task 4: Rebuild Body Sections And Source Evidence Order

**Files:**
- Modify: `src/pages/[locale]/skills/[owner]/[...repo].astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `detailTaskChips`, existing rendered recommendation/suitability/use cases/limitations, review rows, README/file props.
- Produces: body order: fit/tasks, review/permissions, source evidence, FAQ, related skills.

- [ ] **Step 1: Replace the old two-column main layout**

In `src/pages/[locale]/skills/[owner]/[...repo].astro`, replace the block beginning:

```astro
{/* Main Layout: Two Column - Install + Files | Overview + Readme */}
<div class="flex flex-col lg:flex-row gap-6 lg:gap-8 mt-4 pb-16">
```

through the closing `</div>` before `<SkillFaq ... />` with:

```astro
<div class="space-y-8 pb-14">
  <section class="skill-detail-surface p-5 md:p-6">
    <div class="mb-5 flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
      <div>
        <h2 class="text-2xl font-bold">{isZhLocale ? '适合什么任务' : 'Fit and Tasks'}</h2>
        <p class="mt-1 text-sm font-semibold text-[var(--muted-foreground)]">
          {isZhLocale ? '先看它能解决什么问题，再决定是否安装。' : 'Understand the job before installing.'}
        </p>
      </div>
      <Bot size={28} strokeWidth={3} className="text-[var(--accent)] shrink-0" />
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <div class="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
        <h3 class="text-sm font-bold">{isZhLocale ? '核心价值' : 'Core value'}</h3>
        <p class="mt-2 text-base font-semibold leading-relaxed">{renderedRecommendation || heroIntro}</p>
      </div>
      <div class="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
        <h3 class="text-sm font-bold">{tr('Detail.suitability', isZhLocale ? '适用 Agent 类型' : 'Ideal agent fit')}</h3>
        <p class="mt-2 text-base font-semibold leading-relaxed">{renderedSuitability}</p>
      </div>
    </div>

    {renderedUseCases.length > 0 && (
      <div class="mt-5">
        <h3 class="mb-3 text-sm font-bold">{tr('Detail.useCases', isZhLocale ? '主要任务' : 'Use cases')}</h3>
        <div class="grid gap-2 md:grid-cols-2">
          {renderedUseCases.map((useCase) => (
            <div class="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-semibold">
              {useCase}
            </div>
          ))}
        </div>
      </div>
    )}

    {renderedLimitations.length > 0 && (
      <div class="mt-5 border-t border-[var(--border)] pt-5">
        <h3 class="mb-3 text-sm font-bold text-rose-600 dark:text-rose-400">
          {tr('Detail.limitations', isZhLocale ? '使用限制与门槛' : 'Limitations')}
        </h3>
        <div class="grid gap-2 md:grid-cols-2">
          {renderedLimitations.map((limitation) => (
            <div class="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm font-semibold">
              {limitation}
            </div>
          ))}
        </div>
      </div>
    )}
  </section>

  <section class="skill-detail-surface p-5 md:p-6">
    <div class="mb-5 flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
      <div>
        <h2 class="text-2xl font-bold">{isZhLocale ? '审核与权限' : 'Review and Permissions'}</h2>
        <p class="mt-1 text-sm font-semibold text-[var(--muted-foreground)]">{detailReviewStatus}</p>
      </div>
      <a href={`/${locale}/safe`} class="text-sm font-bold text-[var(--muted-foreground)] underline underline-offset-4">
        {isZhLocale ? '审核政策' : 'Review policy'}
      </a>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {trustReviewRows.map((row) => (
        <div class="rounded-md border border-[var(--border)] bg-[var(--card)] px-4 py-3">
          <span class="block text-xs font-mono font-black text-[var(--muted-foreground)]">{row.label}</span>
          <strong class="mt-1 block text-xl font-black">{row.value}</strong>
        </div>
      ))}
    </div>

    {detailRiskChips.length > 0 ? (
      <div class="mt-4 flex flex-wrap gap-2">
        {detailRiskChips.map((label) => (
          <span class="market-chip px-2.5 py-1.5 text-xs">{label}</span>
        ))}
      </div>
    ) : (
      <p class="mt-4 text-sm font-semibold text-[var(--muted-foreground)]">
        {isZhLocale ? '未发现阻断性风险旗标。' : 'No blocking risk flags detected.'}
      </p>
    )}
  </section>

  {skillTier === 2 && (
    <div class="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <p class="text-sm font-semibold text-amber-700 dark:text-amber-300">
        {isZhLocale
          ? '此页面提供安装与来源参考，但不会作为主推荐结果展示。'
          : 'This page provides installation and source reference but is not promoted as a primary result.'}
      </p>
    </div>
  )}

  {!skillIndexability?.isIndexable && (
    <div class="rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3">
      <p class="text-sm font-semibold text-amber-700 dark:text-amber-300">
        {isZhLocale
          ? '来源材料偏薄或未达到推荐标准，页面保留为查阅证据。'
          : 'Source material is thin or below promotion standards; this page remains available as evidence.'}
      </p>
    </div>
  )}

  <section class="skill-evidence-shell">
    <div class="border-b border-[var(--border)] px-5 py-4">
      <h2 class="text-2xl font-bold">{isZhLocale ? '来源材料' : 'Source Evidence'}</h2>
      <p class="mt-1 text-sm font-semibold text-[var(--muted-foreground)]">
        {isZhLocale ? 'README 和文件仅作为上游证据。' : 'README and files are shown as upstream evidence.'}
      </p>
    </div>
    <div class="grid gap-4 p-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <SkillFileManagerNative
        files={files}
        selectedFile="SKILL.md"
        labels={{
          explorer: t('Detail.explorer'),
          project: t('Detail.project'),
        }}
      />
      {isCrawlerRequest ? (
        <pre class="m-0 max-h-none whitespace-pre-wrap break-words border border-[var(--border)] bg-[var(--background)] p-5 text-sm leading-7 text-[var(--foreground)]">
          {crawlerSourceEvidenceContent}
        </pre>
      ) : (
        <SkillReadmeNative
          initialContent={publicReadmeContent}
          initialFiles={{
            'SKILL.md': publicReadmeContent,
            '.cursorrules': `# Skill: ${skill.name}\n\n// Auto-generated by Killer-Skills Universal CLI\n// Import this skill into your Cursor AI context\n\n@import "skills/${owner}/${repo}/SKILL.md";\n\n// Usage:\n// Run 'npx killer-skills add ${owner}/${repo}' to install automatically.`,
            'package.json': JSON.stringify(
              {
                name: `${owner}-${repo}-skill`,
                version,
                description: `Killer Skill: ${description && typeof description === 'string' ? description : ''}`,
                keywords: topics,
                author: owner,
                license: 'MIT',
                homepage: canonicalSkillUrl,
                repository: {
                  type: 'git',
                  url: `https://github.com/${owner}/${repo}`,
                },
              },
              null,
              2,
            ),
          }}
          sourceRepositoryOwner={owner}
          sourceRepositoryRepo={repo}
          sourceFilePath={skill.filePath || 'SKILL.md'}
        />
      )}
    </div>
  </section>
</div>
```

- [ ] **Step 2: Remove duplicated old overview/source blocks**

After replacement, run:

```bash
rg -n "技能概览|Skill Overview|Source Material: Readme Only|Main Layout: Two Column|Install Card|Files Card" 'src/pages/[locale]/skills/[owner]/[...repo].astro'
```

Expected: no matches.

- [ ] **Step 3: Run Astro check**

Run: `npm run check:astro`

Expected: 0 errors. Existing unrelated hints may remain.

- [ ] **Step 4: Commit**

```bash
git add src/pages/[locale]/skills/[owner]/[...repo].astro src/styles/global.css
git commit -m "feat: restructure skill detail body"
```

### Task 5: Browser Verification And Fixes

**Files:**
- Modify if needed: `src/pages/[locale]/skills/[owner]/[...repo].astro`
- Modify if needed: `src/components/SkillInstall.astro`
- Modify if needed: `src/components/SkillReadmeNative.astro`
- Modify if needed: `src/components/SkillFileManagerNative.astro`
- Modify if needed: `src/styles/global.css`

**Interfaces:**
- Consumes: rendered route `/zh/skills/n8n-io/n8n`.
- Produces: verified final UI with no duplicate visible H1 and no overflow.

- [ ] **Step 1: Run full targeted tests**

Run:

```bash
npx vitest run src/lib/skill-detail-view.test.ts src/lib/marketplace-filters.test.ts src/lib/occupations.test.ts src/lib/marketplace-overview.test.ts src/lib/kv.test.ts src/lib/search.test.ts src/lib/skill-trust.test.ts
npx tsc --noEmit --project tsconfig.json
npm run check:astro
npm run build
```

Expected:
- Vitest passes.
- TypeScript exits 0.
- Astro check reports 0 errors.
- Build completes.

- [ ] **Step 2: Run Playwright detail smoke**

Run:

```bash
node - <<'NODE'
const { chromium } = require('playwright');
const route = '/zh/skills/n8n-io/n8n';
const viewports = [
  { width: 1440, height: 1100, name: 'desktop' },
  { width: 390, height: 900, name: 'mobile' },
];
(async () => {
  const browser = await chromium.launch({ headless: true });
  let failed = false;
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const response = await page.goto('http://127.0.0.1:4321' + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(600);
    const result = await page.evaluate(() => {
      const visible = (el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };
      const h1s = [...document.querySelectorAll('h1')].filter(visible).map((el) => el.textContent.trim());
      const bodyText = document.body.textContent || '';
      const readme = document.querySelector('.skill-readme');
      const installButton = document.querySelector('#install-btn');
      return {
        statusTitle: document.title,
        h1s,
        hasInstallCommand: bodyText.includes('npx killer-skills add'),
        installBeforeReadme:
          installButton && readme
            ? installButton.getBoundingClientRect().top < readme.getBoundingClientRect().top
            : false,
        nav: [...document.querySelectorAll('header nav a:not(.header-mobile-nav-link)')]
          .map((a) => a.textContent.trim().replace(/\s+/g, ' '))
          .filter(Boolean),
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      };
    });
    const navOk = viewport.name === 'mobile' || result.nav.join('|') === '首页|Skills|榜单|职业|分类';
    const ok =
      response &&
      response.ok() &&
      result.h1s.length === 1 &&
      result.hasInstallCommand &&
      result.installBeforeReadme &&
      navOk &&
      result.scrollWidth <= viewport.width + 8;
    console.log(viewport.name, JSON.stringify(result, null, 2));
    if (!ok) failed = true;
    await page.close();
  }
  await browser.close();
  if (failed) process.exit(1);
})();
NODE
```

Expected: command exits 0.

- [ ] **Step 3: Capture screenshots for visual review**

Run:

```bash
node - <<'NODE'
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const viewport of [
    { width: 1440, height: 1100, name: 'desktop' },
    { width: 390, height: 900, name: 'mobile' },
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto('http://127.0.0.1:4321/zh/skills/n8n-io/n8n', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `/tmp/killer-skill-detail-${viewport.name}.png`, fullPage: false });
    await page.close();
  }
  await browser.close();
})();
NODE
```

Expected:
- `/tmp/killer-skill-detail-desktop.png`
- `/tmp/killer-skill-detail-mobile.png`

- [ ] **Step 4: Fix any visual/test failures**

If Step 2 fails:
- Duplicate H1: demote README H1 via `SkillReadmeNative.astro` prose classes or transform source H1 into H2 in the markdown processor.
- Install not before README: move the install panel higher in the Astro template.
- Overflow: inspect offending element with Playwright and add `min-w-0`, `break-words`, or narrower grid tracks.
- Nav mismatch: update `src/lib/site-ia.ts` or header rendering only if the detail route is using stale nav.

- [ ] **Step 5: Final commit**

```bash
git add src/pages/[locale]/skills/[owner]/[...repo].astro src/components/SkillInstall.astro src/components/SkillReadmeNative.astro src/components/SkillFileManagerNative.astro src/styles/global.css src/lib/skill-detail-view.ts src/lib/skill-detail-view.test.ts
git commit -m "feat: redesign skill detail install decision page"
```

## Self-Review

- Spec coverage: Tasks cover decision hero, install panel, platform review, fit/tasks, source evidence, related/FAQ preservation, mobile order, one H1, and verification.
- Placeholder scan: No placeholder red flags are present.
- Type consistency: Helper names and signatures are defined in Task 1 and reused in Task 2.
- Scope check: This plan touches only the skill detail route, its direct child components, CSS utilities, and a tiny helper/test file.
