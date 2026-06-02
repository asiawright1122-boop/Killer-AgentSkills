# Phase 70 Deep SEO Audit Report

Generated: 2026-06-01
Scope: All authority surfaces + key public pages
Method: seo-review skill methodology adapted for Killer-Skills

---

## 1. On-Page Metadata Audit

### Title Tag Analysis

| Page | Title | Length | Status |
|------|-------|--------|--------|
| Home | AI Agent Skills Directory for Claude Code, Cursor & Windsurf | 60 | ✅ Ideal |
| Collections Hub | AI Skill Collections for Claude Code, Cursor & Windsurf | 55 | ✅ Good |
| Skills/Marketplace | Browse and Install AI Agent Skills | 37 | ⚠️ Too short |
| Categories | AI Agent Skill Categories by Use Case | 44 | ⚠️ Short, missing IDE names |
| Solutions | Installable AI Agent Workflow Solutions for Docs, Browser & Data Automation | 76 | ❌ Too long |
| CLI | AI Agent Skills CLI for Install, Sync & Automation Workflows | 63 | ⚠️ Slightly over 60 |
| Integrations | Cursor, Claude Code & VS Code AI Skill Setup for Automation Workflows | 72 | ❌ Too long |
| Blog Index | AI Agent Skills Guides, Workflow Tutorials, and Automation Blog | 63 | ⚠️ Slightly over 60 |
| Community | (uses Community.title — likely generic) | ? | ❌ No dedicated SEO title |
| Labs | Skill Online Trial Demo | 25 | ❌ Too short, no keyword |

### Meta Description Analysis

| Page | Description | Length | Status |
|------|-------------|--------|--------|
| Home | Browse 3,400+ AI agent skills and MCP servers, compare trusted tools, and install them in Claude Code, Cursor, Windsurf, and 19+ IDEs. | 134 | ⚠️ Under 140 |
| Collections | Browse trusted AI skill collections and compare the best options for Claude Code, Cursor, Windsurf, and related workflows. | 122 | ⚠️ Under 140 |
| Skills | Browse and install AI Agent skills for Claude Code, Cursor, Windsurf, and more with filtering by search, category, topic, and official sources. | 147 | ✅ Good |
| Categories | Browse N+ AI agent skills by category, from developer tools to data, AI, and design workflows for Claude Code, Cursor, and Windsurf. | ~130 | ⚠️ Under 140 |
| Solutions | Browse installable AI agent workflow solutions for document, browser, data, and process automation, with clear paths into collections, skills, and installation docs. | 160 | ✅ Good |
| CLI | Use the Killer-Skills CLI to install, manage, and sync AI agent skills in Cursor, Claude Code, VS Code, and Windsurf for process automation and template-based workflows, with no global install. | 191 | ❌ Too long |
| Integrations | See how Killer-Skills works with Cursor, Claude Code, VS Code, Windsurf, and 19+ IDEs to install, configure, and sync AI agent skills for workflow automation and process automation. | 181 | ❌ Too long |

### Issues Found

1. **Skills page title too short** (37 chars) — missing IDE brand names that drive search intent
2. **Solutions title too long** (76 chars) — Google will truncate
3. **Integrations title too long** (72 chars) — will truncate
4. **CLI description too long** (191 chars) — will truncate
5. **Home description under-optimized** (134 chars) — can add more value proposition
6. **Community page has no dedicated SEO metadata** — uses generic UI title
7. **Labs page title too short** — no keyword targeting

---

## 2. Keyword Coverage Analysis

### Target Keyword Clusters

| Cluster | Primary Keyword | Home | Skills | Collections | Solutions | Blog |
|---------|----------------|------|--------|-------------|-----------|------|
| AI Skills | AI agent skills | ✅ | ✅ | ✅ | ✅ | ✅ |
| IDE-specific | Claude Code skills | ✅ | ⚠️ | ✅ | ❌ | ✅ |
| IDE-specific | Cursor skills | ✅ | ⚠️ | ✅ | ❌ | ✅ |
| IDE-specific | Windsurf skills | ✅ | ⚠️ | ✅ | ❌ | ✅ |
| MCP | MCP servers directory | ✅ | ❌ | ❌ | ❌ | ✅ |
| Install | install AI skills | ✅ | ✅ | ❌ | ❌ | ✅ |
| Automation | AI workflow automation | ❌ | ❌ | ❌ | ✅ | ✅ |
| Comparison | IDE comparison | ❌ | ❌ | ❌ | ❌ | ✅ |

### Missing Keyword Placements

- **Skills page**: Missing "Claude Code", "Cursor", "Windsurf" in title
- **Solutions**: Missing IDE brand names in title/description
- **Home**: "MCP servers" mentioned in description but not title
- **No page targets "MCP server directory"** as primary keyword
- **No page targets "AI coding assistant skills"** as a variant

---

## 3. Internal Linking Audit

### Placement Count by Surface

| Surface | Tier | Placements | Status |
|---------|------|-----------|--------|
| home-root | P0 | 5 | ✅ |
| collections-hub | P0 | 4 | ✅ |
| collection-official-trusted-tools | P0 | 4 | ✅ |
| collection-agent-workflows | P0 | 4 | ✅ |
| docs-installation | P0 | 4 | ✅ |
| collection-cursor | P1 | 2 | ❌ Below 3 |
| collection-productivity | P1 | 2 | ❌ Below 3 |
| solution-agent-workflows | P1 | 3 | ⚠️ Borderline |
| solution-workflow-automation | P1 | 2 | ❌ Below 3 |
| solution-process-automation | P2 | 2 | ❌ Below 3 |
| solution-document-automation | P2 | 2 | ❌ Below 3 |
| solution-browser-automation | P1 | 2 | ❌ Below 3 |
| solution-data-extraction | P1 | 2 | ❌ Below 3 |
| docs-cli-overview | P1 | 2 | ❌ Below 3 |
| blog-how-to-install | P1 | 2 | ❌ Below 3 |
| blog-mcp-vs-rest-api | P2 | 2 | ❌ Below 3 |
| blog-ide-comparison | P2 | 3 | ⚠️ Borderline |

### Issues

1. **collection-cursor** only 2 placements — high-intent surface underserved
2. **8 surfaces** have only 2 placements — below the 3-link minimum
3. **editorialQueue field** is empty for all surfaces — queue priority not persisted

---

## 4. Technical SEO Analysis

### H1 Tags

| Page | H1 Content | Status |
|------|-----------|--------|
| Home | "AI Agent Skills" + "Open Directory" | ✅ Single H1 |
| Skills | Dynamic (query/category) | ✅ |
| Collections | Dynamic from data | ✅ |
| Blog | Dynamic | ✅ |

### URL Structure

| Pattern | Status | Notes |
|---------|--------|-------|
| `/{locale}/` | ✅ | Clean |
| `/{locale}/skills` | ✅ | Clean |
| `/{locale}/collections/{slug}` | ✅ | Clean |
| `/{locale}/solutions/{topic}` | ✅ | Clean |
| `/api/badge?type=skills` | ✅ | Query param on API endpoint |

### Orphan Page Risk

- **Labs page** (`/labs/skill-try`) — likely low internal linking
- **Sandbox page** (`/sandbox/{owner}/{repo}`) — likely orphan
- **Blog category pages** — may have limited cross-linking

---

## 5. Featured Snippet Opportunities

| Query | Current Coverage | Opportunity |
|-------|-----------------|-------------|
| "what are AI agent skills" | Home hero text | ✅ Add 40-60 word definition |
| "how to install AI skills" | Docs page | ✅ Add numbered steps |
| "Claude Code vs Cursor vs Windsurf" | Blog draft | ✅ Add comparison table |
| "what is MCP server" | No dedicated page | ❌ Need new content |
| "AI coding assistant comparison" | Blog draft | ✅ Table already exists |

---

## 6. Competitive Analysis

### Top Competitors for "AI agent skills"

1. **cursor.directory** — Focused on Cursor only, good SEO
2. **glama.ai/mcp/servers** — MCP server directory, strong domain
3. **smithery.ai** — MCP hub, growing fast

### Our Advantages
- Multi-IDE coverage (Claude Code + Cursor + Windsurf + 19 more)
- CLI tool for one-command install
- Curated collections with editorial oversight
- Structured comparison content

### Gaps to Fill
- No dedicated "What is MCP" explainer page
- No "AI coding assistant comparison" standalone page
- Skills page title lacks IDE brand names
- Multiple surfaces under-linked

---

## Priority Fixes

### ✅ All High Priority Fixed

1. ~~**Skills page title**~~ → Fixed: "AI Agent Skills for Claude Code, Cursor & Windsurf" (55 chars)
2. ~~**Solutions title**~~ → Fixed: "AI Workflow Solutions for Docs, Browser & Data Automation" (57 chars)
3. ~~**collection-cursor**~~ → Fixed: 4 placements (was 2)
4. ~~**Home description**~~ → Fixed: 150 chars (was 134)
5. ~~**CLI title+description**~~ → Fixed: 55/137 chars (was 63/191)
6. ~~**Integrations title+description**~~ → Fixed: 55/140 chars (was 72/181)
7. ~~**Community page SEO**~~ → Fixed: dedicated seoTitle/seoDescription added
8. ~~**8 under-linked surfaces**~~ → Fixed: all upgraded from 2→3+ placements
9. ~~**Labs page title**~~ → Fixed: "Try AI Agent Skills Online — Live Preview & Demo" (52 chars)
10. ~~**Categories title**~~ → Fixed: "AI Skill Categories for Claude Code, Cursor & Windsurf" (55 chars, was 44)
11. ~~**Blog Index title**~~ → Fixed: "AI Agent Skills Guides, Tutorials & Automation Blog" (58 chars, was 63)
12. ~~**Solutions hub BreadcrumbList**~~ → Fixed: added BreadcrumbList schema
13. ~~**Categories/CLI/Blog Speakable**~~ → Fixed: added SpeakableSpecification to 4 pages
14. ~~**Blog category cross-linking**~~ → Fixed: added "Explore Other Categories" section
15. ~~**Blog category sitemap**~~ → Fixed: added 4 category pages × 10 locales to sitemap-blog.xml

### Remaining Low Priority

10. **editorialQueue**: Already persisted in authority-surfaces.json (7 queue items + 3 linking rules)
11. **Create "What is MCP" explainer** → Done: FAQ6 added to homepage across 10 locales
12. **Blog category pages**: Cross-linking depth verified and improved ✅
