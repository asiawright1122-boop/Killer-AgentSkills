---
name: Killer-Skills
description: Public AI agent skills marketplace with visible review evidence and one-command install paths.
colors:
  background: 'oklch(97.5% 0.006 220)'
  foreground: 'oklch(17% 0.035 245)'
  card: 'oklch(100% 0 0)'
  card-hover: 'oklch(94.5% 0.012 220)'
  card-border: 'oklch(79% 0.025 230)'
  primary: 'oklch(79% 0.165 76)'
  accent: 'oklch(77% 0.145 188)'
  secondary: 'oklch(20% 0.04 245)'
  muted: 'oklch(91.5% 0.014 225)'
  muted-foreground: 'oklch(39% 0.035 240)'
  tag-bg: 'oklch(94% 0.058 188)'
  tag-text: 'oklch(23% 0.05 215)'
  tag-border: 'oklch(76% 0.075 188)'
typography:
  display:
    fontFamily: 'Sora, ui-sans-serif, system-ui, sans-serif'
    fontSize: 'clamp(2.4rem, 6vw, 4.5rem)'
    fontWeight: 750
    lineHeight: 0.98
    letterSpacing: '0'
  headline:
    fontFamily: 'Sora, ui-sans-serif, system-ui, sans-serif'
    fontSize: '2rem'
    fontWeight: 750
    lineHeight: 1.12
    letterSpacing: '0'
  body:
    fontFamily: 'Source Sans 3, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 600
    lineHeight: 1.6
    letterSpacing: '0'
  label:
    fontFamily: 'Sora, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 800
    lineHeight: 1
    letterSpacing: '0'
  mono:
    fontFamily: 'JetBrains Mono, ui-monospace, monospace'
    fontSize: '0.75rem'
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: '0'
rounded:
  sm: '4px'
  md: '8px'
  pill: '999px'
spacing:
  xs: '0.5rem'
  sm: '0.75rem'
  md: '1rem'
  lg: '1.25rem'
  xl: '2rem'
  section: '2.75rem'
components:
  button-primary:
    backgroundColor: '{colors.foreground}'
    textColor: '{colors.background}'
    rounded: '{rounded.md}'
    padding: '0.75rem 0.95rem'
  button-accent:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
    padding: '0.75rem 0.95rem'
  chip-evidence:
    backgroundColor: '{colors.tag-bg}'
    textColor: '{colors.tag-text}'
    rounded: '{rounded.pill}'
    padding: '0.25rem 0.5rem'
  card-marketplace:
    backgroundColor: '{colors.card}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
    padding: '1rem'
---

# Design System: Killer-Skills

## 1. Overview

**Creative North Star: "The Review Desk"**

Killer-Skills should feel like a public review desk for AI agent capabilities: fast to scan, strict about what gets listed, and calm enough that users can decide whether to install. The surface is not a mascot-led community hub and not a raw GitHub directory. It is a classified marketplace where navigation, ranking, evidence chips, and install panels all point to the same decision: can I trust this skill for my workflow?

The visual system uses restrained light and dark marketplace surfaces, Sora for compact authority, Source Sans 3 for dense readable explanations, and small JetBrains Mono labels only where evidence or commands need a technical register. Color is functional: teal marks action and active state, warm primary highlights featured trust, dark secondary carries command surfaces. Decoration is subordinate to classification and review evidence.

**Key Characteristics:**

- Classification-first: every core route answers one browsing intent before exposing the full directory.
- Evidence-forward: source, review status, risk flags, category, and install command are visible as product facts.
- Compact but not crowded: cards are scannable, headings are decisive, explanatory copy is short.
- Multilingual by default: labels cannot rely on narrow English-only spacing or hover-only disclosure.

## 2. Colors

The palette is a cool, inspectable marketplace surface with one teal action accent and one warm trust accent.

### Primary

- **Review Gold**: the primary highlight for featured or verified emphasis. It must stay rare and should not become a full-page wash.

### Secondary

- **Command Ink**: the dark secondary surface used for primary buttons, command blocks, and high-confidence actions.
- **Action Teal**: the accent for active tabs, submit actions, focus rings, hover borders, and selected filters.

### Neutral

- **Cool Marketplace Background**: the body canvas for light mode. It is near-white but tinted toward the product's blue-green axis, not beige.
- **Ink Foreground**: the main reading color and primary button background.
- **White Card Surface**: the repeated skill card and panel surface.
- **Cool Border**: the standard 1px divider, card outline, filter control border, and panel boundary.
- **Muted Slate Text**: explanatory copy, route labels, secondary metadata, and non-primary helper text.
- **Evidence Tag Surface**: the pale teal chip surface used for official/community/review/risk signals.

### Named Rules

**The Evidence Color Rule.** Teal means action, active state, or review evidence. Do not use it as generic decoration.

**The No Beige Rule.** Warm neutral backgrounds are prohibited. Warmth belongs only in the Review Gold accent.

## 3. Typography

**Display Font:** Sora with system sans fallback
**Body Font:** Source Sans 3 with system sans fallback
**Label/Mono Font:** JetBrains Mono for commands and compact evidence labels only

**Character:** The type is engineering-led without terminal cosplay. Sora gives the brand a firm classification voice; Source Sans 3 keeps dense listings readable; JetBrains Mono is reserved for command and audit evidence.

### Hierarchy

- **Display** (750, clamp from 2.4rem to 4.5rem, 0.98 line-height): route heroes and homepage identity only.
- **Headline** (750, 2rem, 1.12 line-height): section heads such as Skills lists, occupations, categories, and review policy blocks.
- **Title** (700-800, 1.125rem to 1.5rem): card names, panel titles, detail-page modules.
- **Body** (600, 1rem, 1.6 line-height): explanations, summaries, and descriptions. Keep body text at 64-68ch where possible.
- **Label** (800, 0.75rem to 0.875rem, no letter spacing): compact route labels, form labels, chips, and evidence metadata.

### Named Rules

**The No Tracking Rule.** Letter spacing is 0 across the public marketplace. Do not revive tracked uppercase section grammar.

**The Mono Is Evidence Rule.** Use mono for commands, scores, and audit labels. Do not use monospace as a generic "developer" aesthetic.

## 4. Elevation

The system uses a hybrid of flat borders and restrained ambient shadows. Listings and detail surfaces are mostly flat at rest; shadows appear on marketplace panels and hoverable cards to separate dense information without turning the page into a floating-card collage.

### Shadow Vocabulary

- **Marketplace Ambient** (`var(--card-shadow)`): card and panel separation on listing surfaces.
- **Detail Flat** (`box-shadow: none`): detail modules, evidence panels, and source material sections. Trust content should look inspectable, not decorative.

### Named Rules

**The Border-First Rule.** A 1px border is the default separator. Shadows are allowed only when a surface needs clear click or panel affordance.

**The No Ghost Card Rule.** Do not pair decorative wide shadows with decorative borders. If a card already has a heavy shadow, reduce the border's visual role.

## 5. Components

### Buttons

- **Shape:** firm rectangle with gentle corners (8px).
- **Primary:** Command Ink background with Cool Marketplace Background text; used for search, filter, and high-confidence navigation.
- **Accent:** Action Teal background with Ink Foreground text; used for submit and selected state.
- **Hover / Focus:** hover may lift by 1px or shift border to Action Teal. Focus-visible is a 3px Action Teal outline with 2px offset.

### Chips

- **Style:** pill shape with Evidence Tag Surface, Evidence Tag Border, and Evidence Tag Text.
- **Role:** chips are evidence, filters, source, risk, category, or review-state markers. They are not decorative badges.
- **State:** selected filters use Action Teal fill; neutral evidence keeps the pale teal surface.

### Cards / Containers

- **Corner Style:** 8px radius.
- **Background:** White Card Surface mixed with the page background for marketplace panels and cards.
- **Shadow Strategy:** marketplace cards may use Marketplace Ambient; detail modules stay flat unless they are sticky decision panels.
- **Border:** always 1px Cool Border unless active or hovered.
- **Internal Padding:** 1rem on listing cards, 1.25rem to 1.5rem on detail modules.

### Inputs / Fields

- **Style:** 1px Cool Border, 8px radius, Cool Marketplace Background fill, Ink Foreground text.
- **Placeholder:** must maintain readable contrast; never rely on low-opacity gray.
- **Focus:** Action Teal focus outline. Do not remove native focus semantics.
- **Filter Bars:** collapse to one column below 800px; never force horizontal overflow.

### Navigation

- **Desktop:** one primary nav only: Home, Skills, Rankings, Occupations, Categories. Active nav uses Evidence Tag Surface and Action Teal border.
- **Mobile:** a body-hoisted drawer with full-height panel, visible close control, primary routes first, then submit/search/favorites/theme/language actions.
- **Legacy Routes:** collections, solutions, docs, community, cli, integrations, and article/blog surfaces may exist, but they must route users back to the new marketplace IA instead of reintroducing old nav taxonomies.

### Skill Cards

- **Purpose:** quick comparison, not final decision. Cards show name, owner, source kind, review state, risk signals, short description, stars/forks, and category.
- **Install:** desktop hover copy is allowed as a shortcut, but the full install decision belongs on the detail page and must not depend on hover.
- **Density:** no more than three risk chips on cards. Put deeper evidence on the detail page.

### Skill Detail Decision Panel

- **Purpose:** the install decision surface. It must combine review status, source trust, risk flags, one-command install, GitHub link, review policy link, and favorite/share actions.
- **Layout:** content first, sticky decision panel second on desktop; single column on mobile.
- **Evidence:** fit/tasks, review/permissions, limitations, source material, and related skills must be separate sections with clear headings.

## 6. Do's and Don'ts

### Do:

- **Do** keep the primary IA to Home, Skills, Rankings, Occupations, and Categories.
- **Do** treat official/community as source evidence, not as a top-level category.
- **Do** show only marketplace-approved skills in public listings; D-level or ineligible skills stay out of Skills, Rankings, Occupations, and Categories.
- **Do** make Popular mean rankScore/qualityScore first, then stars, then name; make Latest mean updatedAt first, then Popular as tie-break.
- **Do** expose safety as review policy and evidence, not as user-facing lectures.
- **Do** preserve readable Chinese and English first, then test long German, Russian, Arabic, and translated category labels.
- **Do** keep mobile drawer overlays hoisted or fixed so sticky headers cannot clip them.
- **Do** use the detail page as the trustworthy installation decision point.

### Don't:

- **Don't** copy CocoLoop's mascot or personality system.
- **Don't** ship a flat raw directory as the primary experience.
- **Don't** use generic AI landing-page tropes: gradient text, decorative AI gradients, metric-heavy hero sections, fake trust badges, repeated tiny section eyebrows, decorative grid backgrounds, or nested card grids.
- **Don't** make the site look like a dashboard unless the surface is actually an app workflow.
- **Don't** reintroduce old header items such as Topics, Hot, Explore, or Docs into the primary marketplace header.
- **Don't** hide critical installation or review evidence behind hover-only interactions.
- **Don't** show internal strategy, chain-of-thought, recovery jargon, or implementation rationale in public UI.
- **Don't** over-round cards, inputs, or panels beyond the 8px system unless the element is a chip or icon button.
