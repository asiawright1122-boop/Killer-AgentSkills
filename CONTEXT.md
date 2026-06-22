# Killer-Skills Agent Directory

Killer-Skills is a public directory for AI agent skills, MCP servers, and workflow tools. Its domain language separates public discovery surfaces from raw operator data so trust, selection proof, and setup guidance stay safe for visitors.

## Language

**Skill**:
An installable AI agent capability discovered from a repository or curated source.

**Skill Repository**:
A source repository that may contain one or more **Skills** and setup files.
_Avoid_: repo when the public concept is the installable skill.

**Public Skill Projection**:
The visitor-safe view of a **Skill** after filtering, field narrowing, and public-output sanitization.
_Avoid_: raw skill, cache row, D1 row.

**Public Skill Catalog**:
The read model that public pages and public APIs use to access **Public Skill Projections**.
_Avoid_: KV helper, raw storage access.

**Raw Skill Store**:
The operator-facing store of unprojected skill records used for administration, sync, and internal maintenance.
_Avoid_: public catalog.

## Relationships

- A **Skill Repository** may contain one or more **Skills**.
- A **Skill** has zero or one **Public Skill Projection**.
- The **Public Skill Catalog** exposes **Public Skill Projections**.
- The **Raw Skill Store** may contain records that never become **Public Skill Projections**.

## Example Dialogue

> **Dev:** "Can the skill file API read from the raw D1 row to find the branch?"
> **Domain expert:** "Only behind the **Public Skill Catalog**. The public API may use safe repository metadata, but it should not consume the **Raw Skill Store** directly."

## Flagged Ambiguities

- "skill data" can mean either **Public Skill Projection** or **Raw Skill Store** records; resolved: public pages and public APIs mean **Public Skill Projection** unless explicitly marked operator/admin.
