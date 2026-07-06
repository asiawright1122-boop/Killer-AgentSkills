# Killer-Skills Marketplace IA Redesign

Date: 2026-07-06

## Decision

Killer-Skills will use a marketplace structure inspired by competitor skill directories, but not copy their layout or route taxonomy. The site should help users find a useful AI Agent Skill by task, popularity, freshness, or occupation with a short learning path.

The approved primary navigation is:

- Home
- Skills
- Rankings
- Occupations
- Categories

Chinese labels:

- 首页
- Skills
- 榜单
- 职业
- 分类

Creators are not a primary navigation item. Official or creator identity is a source attribute used for trust and filtering.

Safety is not a primary navigation item. Safety is a platform admission rule and a visible trust signal across listings and detail pages.

## Product Principles

1. Users should start from what they want to do, not from how the site is organized internally.
2. Rankings should be easy to understand: Popular and Latest.
3. Occupations should map skills to real work roles and tasks.
4. Categories should support users who already know the capability type they need.
5. Official status should answer "who made this?" but not replace task-based discovery.
6. Safety should be a promise of the marketplace, not a separate channel users must learn.

## Route Map

### `/[locale]` Home

Purpose: Landing page and marketplace hub.

Required sections:

- Hero with search for skills, tasks, tools, and workflow names.
- Popular Skills preview.
- Occupations preview.
- Latest Skills preview.
- Categories preview.
- Short trust statement explaining that public listings pass baseline review.

The home page should not become a long documentation page. It should get users into search, rankings, occupations, or categories quickly.

### `/[locale]/skills`

Purpose: Full skill directory.

Behavior:

- Shows all public, baseline-approved skills.
- Supports search, category filter, occupation/task filter where available, source filter, and sort.
- Source filter options: All, Official, Community.
- Official skills appear with an Official badge but remain grouped by use case and category.

This route is the complete browseable catalog, not a redirect.

### `/[locale]/popular`

Purpose: Rankings.

Tabs:

- Popular
- Latest

Chinese:

- 热门
- 最新

Rules:

- Do not expose "trusted ranking" or "safety ranking" as user-facing rank types.
- All ranking entries must already pass baseline safety review.
- Popular sort may use a blended score including rank score, stars, source trust, and usage/quality signals.
- Latest sort is based on freshness but still excludes baseline safety failures.

### `/[locale]/occupations`

Purpose: Occupation-based discovery.

Occupation examples:

- Developer
- Data Analyst
- Designer
- DevOps Engineer
- Product Manager
- Security Engineer
- Content Operator
- Researcher
- QA Engineer
- Business/Operations

Each occupation card should show:

- Occupation name.
- A short task-oriented description.
- Representative tasks.
- Skill count.
- 2-3 representative skills.

### `/[locale]/occupations/[slug]`

Purpose: Dedicated occupation page.

Required content:

- Occupation overview.
- Task clusters for that occupation.
- Recommended skills grouped by task cluster.
- Popular and latest skills within the occupation.
- Related categories.
- Trust/source badges on every visible skill.

This page should feel like "what can this role do with AI Agent Skills?" rather than a generic list.

### `/[locale]/categories`

Purpose: Capability taxonomy.

Category examples:

- Development
- Testing
- Data
- Documentation
- Design
- Automation
- MCP
- DevOps
- Security
- Productivity

Each category should show:

- Category name.
- Short capability description.
- Skill count.
- Popular skills.
- Related occupations.

This route must be a real category index, not a redirect to search.

### `/[locale]/categories/[slug]`

Purpose: Category listing page.

Required content:

- Category overview.
- Skill list with filters and sorting.
- Related occupations.
- Popular and latest sections.

## Safety Model

Safety is a baseline admission rule:

- Skills that fail baseline safety review do not appear on Home, Skills, Rankings, Occupations, Categories, or search results.
- Failed or quarantined skills may remain in internal/admin data, but they are not public marketplace entries.

Visible safety evidence:

- Cards show concise trust badges, for example Reviewed, Official, Community, Token Required, File Write, Network Access.
- Detail pages show the full review block with source trust, safety level, risk flags, and audit timestamp.
- Footer may link to a lightweight policy page such as `/trust` or `/security-policy`.

No standalone Safety top-level page is required for the main user journey.

## Official Skills

Official is a source attribute, not a category.

Official skills should:

- Appear in their natural occupation and category.
- Be filterable in `/skills`.
- Be eligible for home modules such as Official Picks.
- Carry a visible Official badge.
- Influence trust/ranking scores.

Examples:

- A deployment skill belongs to DevOps and Developer occupations, Deployment/DevOps category, source Official if it comes from a verified official repo.
- A prompt workflow skill belongs to Developer, Product, or Content occupations depending on task mapping, with source Official only when provenance supports it.

## Data Requirements

Each public skill should support:

- `securityLevel`
- `sourceTrust`
- `rankScore`
- `riskFlags`
- `isTrustedRankingEligible`
- `occupationIds`
- `taskClusterIds`
- `category`
- `sourceKind`: official or community

Occupation mapping can start rule-based:

- Use category, topics, description, repository metadata, and known official repos.
- Allow manual overrides later.

## UX Requirements

- No instructional "how to use the site" blocks on primary routes.
- Keep ranking labels simple.
- Use source and safety as badges/evidence, not page concepts users must study.
- Avoid dense all-in-one dashboards on landing pages.
- Do not nest cards inside cards.
- Keep cards compact and comparable.
- Preserve dark/light theme support.

## Non-Goals

- No creator directory in primary navigation.
- No public unsafe/quarantined marketplace.
- No separate trusted/safety ranking tabs.
- No long security tutorial as a primary route.
- No copying competitor visual style or exact category names.

## Acceptance Criteria

1. Header shows Home, Skills, Rankings, Occupations, Categories.
2. `/[locale]/categories` is a real category index.
3. `/[locale]/occupations` exists and lists occupation cards.
4. `/[locale]/occupations/[slug]` exists for at least the initial occupation set.
5. Rankings expose only Popular and Latest.
6. Official skills are represented as source badges and filters, not a nav item.
7. Baseline safety failures are excluded from public listings and search.
8. Skill cards and detail pages still show concise safety/source evidence.
9. Home page routes users into search, rankings, occupations, and categories without verbose guidance copy.
