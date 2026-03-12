# SEO Keyword Mapping (2026-03-12)

## Goal
Reduce low-intent impressions and improve CTR by aligning search snippets with core commercial intent.

## Query Cluster Map
| Cluster | Aliases | Preferred Intent Label | Target URL |
|---|---|---|---|
| MCP Servers | mcp, mcp server, model context protocol | MCP Servers | `/[locale]/skills` |
| AI Agent Skills | ai agent skills, agent skills, ai skills | AI Agent Skills | `/[locale]/skills` |
| Claude Code Skills | claude code, claude skills | Claude Code Skills | `/[locale]/skills` |
| Cursor Skills | cursor, cursor skills | Cursor Skills | `/[locale]/skills` |
| Windsurf Skills | windsurf, windsurf skills | Windsurf Skills | `/[locale]/skills` |

## Implementation
- Query intent normalization module: [`src/lib/query-intent.ts`](/Users/kaka/Dev/Killer-Skills/src/lib/query-intent.ts)
- Skills list metadata uses normalized intent when query matches:
  - [`src/pages/[locale]/skills/index.astro`](/Users/kaka/Dev/Killer-Skills/src/pages/[locale]/skills/index.astro)
- Query result pages now set explicit page-level `noindex` when `q/query` exists:
  - [`src/pages/[locale]/skills/index.astro`](/Users/kaka/Dev/Killer-Skills/src/pages/[locale]/skills/index.astro)
- Skill detail pages now align visible content with structured data:
  - Added visible FAQ + install steps that match `FAQPage`/`HowTo` JSON-LD
  - Localized FAQ/HowTo copy for `zh` and `en`
  - Unified skill detail canonical/schema URLs to no-trailing-slash form
  - File: [`src/pages/[locale]/skills/[owner]/[...repo].astro`](/Users/kaka/Dev/Killer-Skills/src/pages/[locale]/skills/[owner]/[...repo].astro)
- Skill detail title/description templates now segment by category intent:
  - Intent resolver: [`src/lib/skill-seo-intent.ts`](/Users/kaka/Dev/Killer-Skills/src/lib/skill-seo-intent.ts)
  - Current intent buckets: `browser`, `finance`, `productivity`, `developer`, `data`, `ai`, `design`, `documentation`, `devops`, `security`, `communication`
  - Templates fall back automatically when existing SEO copy lacks intent signals
  - Tests: [`src/lib/skill-seo-intent.test.ts`](/Users/kaka/Dev/Killer-Skills/src/lib/skill-seo-intent.test.ts)
- Category taxonomy is now normalized across pages and filters:
  - Shared taxonomy: [`src/lib/category-taxonomy.ts`](/Users/kaka/Dev/Killer-Skills/src/lib/category-taxonomy.ts)
  - `/skills` category pages use canonical descriptions and labels
  - `/categories` page now matches the sidebar taxonomy and aggregates legacy category values
  - Tests: [`src/lib/category-taxonomy.test.ts`](/Users/kaka/Dev/Killer-Skills/src/lib/category-taxonomy.test.ts)

## Title Template Experiment
- Page: skill detail page
- File: [`src/pages/[locale]/skills/[owner]/[...repo].astro`](/Users/kaka/Dev/Killer-Skills/src/pages/[locale]/skills/[owner]/[...repo].astro)
- Flags:
  - `SEO_TITLE_VARIANT=A|B|AUTO` (default `A`)
  - `SEO_FORCE_TEMPLATE=true|false` (default `false`)

### Suggested rollout
1. Week 1: `SEO_TITLE_VARIANT=A`, `SEO_FORCE_TEMPLATE=false`
2. Week 2: `SEO_TITLE_VARIANT=B`, `SEO_FORCE_TEMPLATE=true`
3. Compare GSC metrics:
   - CTR
   - Impressions
   - Clicks
   - Position
