# Context for Phase 81: Frontend & UX Revamp

**Milestone:** v2.8 Growth, Telemetry & UX Expansion
**Phase:** 81
**Requirements Mapped:**
- **UX-10:** Implement a fast on-site search functionality for the skill directory.
- **UX-11:** Enrich Skill Detail pages with better typography, markdown rendering, and code examples.

## Background
The directory currently has an internal search via `CommandBar.tsx` mapped to `Cmd+K`, hitting `/api/search`. This functionality is somewhat hidden and needs to be visibly exposed globally (e.g., in `Header.astro`).
Skill detail pages (`[...repo].astro`) render documentation but lack optimized typography and syntax highlighting, making them harder to read for developers evaluating skills.

## Constraints
- **Bundle size:** Minimize heavy client-side highlighting libraries if possible, or use lightweight solutions for Astro.
- **SSR/Edge Performance:** Ensure search API remains fast and doesn't impact Core Web Vitals negatively.
