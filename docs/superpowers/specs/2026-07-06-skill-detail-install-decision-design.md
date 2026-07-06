# Skill Detail Install Decision Page Design

Date: 2026-07-06
Status: Approved for implementation planning

## Context

The current skill detail page still behaves like an older README/document page. It exposes useful data, but the hierarchy is wrong for a marketplace:

- The first screen does not clearly answer whether a skill is worth installing.
- Install actions, trust review, use cases, and README evidence are split across old page regions.
- README content can introduce duplicate headings and stale source structure into the page.
- The page visually differs from the newly rebuilt marketplace routes.

The redesigned detail page should serve one primary task: help a user decide whether to install a skill, then install it.

## Goals

- Make the first viewport answer: what is this skill, who is it for, can I trust it, and how do I install it?
- Treat platform review as a product value, not a user education page.
- Keep source material available as evidence, but move it below the decision surface.
- Reuse existing data and behavior where it is sound: install command, file switching, README rendering, actions, schema, SEO data.
- Match the new marketplace information architecture: Home, Skills, Rankings, Occupations, Categories.

## Non-Goals

- Do not redesign the global header or listing pages in this slice.
- Do not change crawler/indexability logic except where markup order requires safer rendering.
- Do not rebuild ingestion, ranking, or safety scoring logic.
- Do not remove README access; demote it to source evidence.

## Page Structure

### 1. Decision Hero

The hero becomes a two-column decision surface on desktop and a stacked flow on mobile.

Left column:
- Breadcrumbs.
- Skill name.
- Source identity: official/community, owner, category, version.
- One concise recommendation sentence from existing recommendation/suitability/description data.
- Task chips from use cases or topics.
- Lightweight stats: stars, forks, updated date.

Right column:
- Sticky install decision panel.
- Platform review outcome: security level, source trust, rank/trust score, blocker count.
- Risk chips: token, file write, network, destructive shell, stale/thin source when present.
- Primary install command and copy/install action.
- Secondary actions: GitHub, favorite/share.

The first viewport must not show README content before the install decision is visible.

### 2. Fit And Tasks

This section answers "should I use this?" using existing fields:

- Recommendation / core value.
- Ideal agent or workflow fit.
- Use cases as compact task rows, not large explanatory cards.
- Limitations as explicit constraints.

Empty arrays should not render empty blocks. If data is thin, fall back to the sanitized public description.

### 3. Review And Permissions

This section turns safety into platform value:

- Explain admission status through the score rows, not long guidance copy.
- Show source trust, security level, risk flags, and whether the skill is promoted/indexable.
- Link to `/safe` as "Review policy" / "审核政策" only as secondary context.

The tone should be concise and product-like. Avoid telling users how to think; present the platform verdict.

### 4. Install And Source Evidence

Below the decision sections:

- Keep the install command visible in the sticky panel and repeat a compact install block before README on mobile if needed.
- Render source files and README as "Source evidence" / "来源材料".
- Prevent source README H1 from competing with the page H1. The rendered markdown should behave as nested source material.
- File manager and README can keep their existing vanilla JS behavior, but their visual shell should match the new marketplace surface.

### 5. Related Skills

Keep related skills after source evidence. The section should use the same card/list vocabulary as marketplace list pages.

## Components

Preferred implementation:

- Add small local view-model helpers inside the detail page or a nearby library only if needed to avoid duplicating label fallback logic.
- Add detail-specific presentational components only when a section becomes too large to read comfortably.
- Reuse `SkillInstall`, `SkillReadmeNative`, `SkillFileManagerNative`, `SkillActionsNative`, `SkillFaq`, and `SkillRelated` behavior where possible.
- Update component styling when necessary, but avoid broad refactors that affect unrelated pages.

## Data Flow

The page should continue deriving content from existing variables:

- `skillDisplayName`, `owner`, `repo`, `category`, `version`.
- `renderedRecommendation`, `renderedSuitability`, `renderedUseCases`, `renderedLimitations`.
- `trustReviewRows`, `visibleRiskLabels`, `skillRiskFlags`, `skillSecurityLevel`, `skillSourceTrust`, `skillRankScore`.
- `installCommand`, `githubUrl`, `publicReadmeContent`, `files`, `relatedSkills`.

When optional data is missing:

- Use sanitized public description as the fallback recommendation.
- Hide empty task, limitation, risk, or feature groups.
- Keep install command and source repository links visible as long as the page has a valid skill.

## Responsive Behavior

- Desktop: two-column hero with a sticky install panel.
- Tablet: install panel stays near the top, sections stack cleanly.
- Mobile: order is title, verdict, install command, task fit, review, source evidence.
- No horizontal overflow at 390px width.
- Avoid viewport-scaled typography; use fixed responsive steps.

## Accessibility And UX

- Keep exactly one visible page H1.
- Buttons must have clear accessible names.
- Copy/install actions need visible feedback.
- Review/risk chips must not rely on color alone.
- Source README should remain keyboard-scrollable and copyable.
- Motion should be limited to hover/focus state transitions and respect reduced motion.

## Testing And Verification

Run:

- Unit tests for existing marketplace/trust/search helpers.
- `npx tsc --noEmit --project tsconfig.json`.
- `npm run check:astro`.
- `npm run build`.
- Playwright smoke over one valid detail route on desktop and mobile:
  - status 200
  - one visible H1
  - install command present above README
  - no horizontal overflow
  - global nav remains `首页 / Skills / 榜单 / 职业 / 分类`

## Acceptance Criteria

- A user can decide and install from the first viewport.
- README/source content no longer dominates the page hierarchy.
- Platform review is presented as an admission/verdict layer.
- Old page artifacts such as duplicate H1s, doc-like layout dominance, and scattered install actions are removed.
- The design stays visually consistent with the rebuilt marketplace pages.
