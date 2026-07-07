# Trusted Marketplace Policy Design

Date: 2026-07-07

## Decision

Killer-Skills will make trust a marketplace rule layer, not a documentation page. Public routes should only show skills that pass baseline review. Ranking, search, occupation pages, category pages, and skill detail pages must all use the same policy layer so users see a consistent catalog.

This design builds on the approved marketplace IA:

- Home
- Skills
- Rankings
- Occupations
- Categories

Safety remains a product promise across the marketplace. It is not a primary navigation item.

## Goals

1. Make rankings explainable without turning pages into tutorials.
2. Make public listings safer by default through admission rules.
3. Keep official status as a source attribute, not a category.
4. Make every public route use one shared marketplace policy.
5. Give detail pages enough evidence for professional users to decide whether to install.
6. Keep the UI compact: short badges on cards, fuller evidence on detail pages.

## Non-Goals

- Do not add a top-level Safety page to the primary navigation.
- Do not expose raw scoring formulas as user-facing content.
- Do not make users manually audit every risk signal before browsing.
- Do not create a creator directory.
- Do not rebuild the ingestion pipeline in this phase.

## Product Model

### Admission

A skill is public only when it passes baseline review.

Baseline review requires:

- No blocker risk flags.
- `securityLevel` is not `D`.
- `isTrustedRankingEligible` is not false.
- Source material is structured enough to produce a usable skill name, description, install path, or body preview.
- Source trust is `T1` or `T2`; `T3` sources are quarantined until they gain stronger provenance or review signals.

Skills that fail baseline review may stay in internal data, admin tools, or reports, but must not appear on:

- Home modules.
- Skills directory.
- Rankings.
- Occupation pages.
- Category pages.
- Search results.
- Related skill blocks.

### Quarantine

Quarantine is an internal state for skills that exist in source data but should not be public.

Quarantine reasons include:

- Destructive shell pattern.
- Credential capture pattern.
- Thin source.
- Stale source combined with low source trust.
- Unstructured skill metadata.
- Broken or missing install path.
- Unknown provenance.
- `sourceTrust=T3`.

The public site should not show quarantined items. Admin or report surfaces can show them with reasons.

### Ranking

Rankings are product views over approved skills only.

Popular ranking should use a blended score:

- Safety score.
- Source trust score.
- Installability score.
- Freshness score.
- Popularity signals such as stars.
- Quality score where available.

Latest ranking should sort by `updatedAt` or equivalent freshness data, but it must still apply the same baseline admission rule.

The public UI should explain ranking in one sentence, for example:

> Ranked from reviewed skills using trust, source quality, installability, freshness, and popularity signals.

This sentence belongs near the ranking controls or in a small tooltip, not as a large instructional block.

### Official Status

Official is a source signal.

Official skills:

- Remain in their natural categories and occupations.
- Can rank higher when source trust supports it.
- Can be filtered on the Skills directory.
- Carry an Official badge on cards and detail pages.
- Must still pass baseline review.

Official is not a category and not a separate primary route.

## Public Signals

### Card Signals

Cards should show only compact decision signals:

- Reviewed.
- Official or Community.
- Token required, when detected.
- Network access, when detected.
- File write, when detected.
- Recently updated, when applicable.

Cards should not show raw chain-of-thought, scoring internals, long safety explanations, or "how to use this site" copy.

### Detail Signals

Skill detail pages should show a fuller trust panel:

- Safety level.
- Source trust level.
- Review status.
- Risk flags.
- Last audited time.
- Source repository.
- Install path or skill file path.
- A short "why this is listed" explanation.

The detail page should help a professional user make an install decision quickly. It should not teach general security concepts.

### Ranking Signals

Rankings should expose:

- Rank position.
- Skill name and short description.
- Official or community source.
- Reviewed badge.
- Key risk badges.
- Freshness or update date.

The ranking page should support Popular and Latest tabs. It should not create separate "safe ranking" or "trusted ranking" tabs because safety is already a marketplace gate.

## Data Flow

### Existing Inputs

The current codebase already has useful signals:

- `securityLevel`
- `securityScore`
- `sourceTrust`
- `sourceScore`
- `rankScore`
- `qualityScore`
- `riskFlags`
- `isTrustedRankingEligible`
- `sourceKind`
- `updatedAt`
- `stars`
- `filePath`
- `category`
- occupation and task mapping helpers

### Policy Layer

Introduce or consolidate a `marketplace-policy` module that owns:

- Public admission.
- Quarantine reasons.
- Popular sorting.
- Latest sorting.
- Public trust badges.
- Detail trust panel data.
- Public route filtering.

Current functions in `marketplace-filters` and `skill-trust` can feed this layer, but route pages should not duplicate policy decisions.

### Route Usage

All public marketplace routes should load skills through the policy layer:

- `/[locale]`
- `/[locale]/skills`
- `/[locale]/popular`
- `/[locale]/occupations`
- `/[locale]/occupations/[slug]`
- `/[locale]/categories`
- `/[locale]/categories/[slug]`
- `/[locale]/search`
- `/[locale]/skills/[owner]/[repo]`

Related skill blocks and home modules should also use the same public admission rule.

## Crawler and Update Logic

The product should communicate freshness through data, not claims.

The crawler/update pipeline should maintain:

- Last synced time.
- Source updated time.
- Review time.
- Source path.
- Source status.

The UI should distinguish:

- Recently updated: source changed recently.
- Recently reviewed: marketplace policy reviewed recently.
- Stale source: source has not changed for a long time.

Freshness should influence ranking but should not override safety.

## User Experience

### Home

Home should show trusted entry points:

- Search.
- Popular preview.
- Latest preview.
- Occupations preview.
- Categories preview.

Each module uses approved skills only.

### Skills Directory

The directory is the complete public catalog.

Filters:

- Source: all, official, community.
- Category.
- Occupation or task, when available.
- Risk signals where useful, such as token required or network access.
- Sort: popular, latest.

### Rankings

Rankings stay simple:

- Popular.
- Latest.

No extra ranking taxonomy is needed in this phase.

### Occupations

Occupation pages should use approved skills mapped to role tasks. The page should answer "what can this role do with AI Agent Skills?"

### Categories

Category pages should use approved skills mapped to capability areas. Official skills appear inside the relevant capability area, not in a separate official category.

### Skill Detail

The detail page should be redesigned around install decision support:

- What it does.
- Who maintains it.
- Why it is listed.
- What risks were detected.
- How to install.
- Related approved skills.

## Implementation Shape

### Modules

Add or consolidate:

- `src/lib/marketplace-policy.ts`
- `src/lib/marketplace-policy.test.ts`

Reuse:

- `src/lib/skill-trust.ts`
- `src/lib/marketplace-filters.ts`
- `src/lib/public-skill-catalog.ts`
- `src/lib/occupations.ts`
- `src/lib/category-taxonomy.ts`

### Types

The policy layer should expose small, stable types:

- `MarketplaceAdmission`
- `MarketplaceQuarantineReason`
- `MarketplaceBadge`
- `MarketplaceCardTrust`
- `MarketplaceDetailTrust`
- `MarketplaceRankKind`

Route pages should consume these types rather than inspect raw risk flags directly.

### Migration

1. Create the policy module using current scoring fields.
2. Move route filtering and sorting to the policy module.
3. Update cards to use policy badges.
4. Update detail pages to use the detail trust panel model.
5. Add regression tests for public route eligibility.
6. Keep existing URLs stable.

## Testing

Unit tests must cover:

- `D` level skills are not public.
- Blocker risk flags quarantine a skill.
- `isTrustedRankingEligible=false` excludes a skill.
- Official skills still require baseline review.
- Popular sorting is stable and deterministic.
- Latest sorting respects freshness after admission.
- Risk flags map to compact public badges.
- Quarantined skills do not appear in related skill results.

Build or integration checks should cover:

- Public route data does not include quarantined skills.
- Home modules use approved skills only.
- Search results use approved skills only.
- SEO crawl still passes against production preview.

## Rollout

Phase 1:

- Introduce `marketplace-policy`.
- Add tests.
- Move rankings and search onto the policy layer.

Phase 2:

- Move home, category, occupation, and related skill blocks onto the policy layer.
- Update card badges.

Phase 3:

- Redesign detail trust panel.
- Add compact ranking explanation.
- Add internal quarantine reporting if existing reports do not already cover it.

## Success Criteria

- A blocked or quarantined skill cannot appear on any public marketplace route.
- Popular and Latest rankings are explainable from the same policy module.
- Official skills are visible as source signals, not categories.
- The UI shows trust evidence without verbose instructional copy.
- Tests fail if any route bypasses baseline admission.
- Deployment SEO crawl remains green.
