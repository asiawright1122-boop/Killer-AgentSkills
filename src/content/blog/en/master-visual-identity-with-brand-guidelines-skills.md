---
title: "The DNA of Design: Mastering the Brand-Guidelines Skill"
description: "Discover how to apply official branding to your AI-generated assets using the brand-guidelines skill. Learn the secrets of Anthropic's visual identity."
pubDate: 2026-02-13
author: "Killer-Skills Team"
tags: ["Branding", "Visual Identity", "Agent Skills", "Design Systems"]
lang: "en"
featured: false
category: "enterprise-solutions"
heroImage: "https://images.unsplash.com/photo-1557200134-90327ee9fafa?q=80&w=2560&auto=format&fit=crop"
---

# Design with Authority: Unlocking the Brand-Guidelines Skill

In the world of professional communication, consistency is everything. When you generate a dashboard or a presentation with an AI agent, it often identifies as "AI-generated" because it follows generic design patterns. To build trust, your output needs to feel like it comes from a living, breathing organization with a clear identity.

The official **brand-guidelines** skill from Anthropic solves this by providing your agent with the complete visual DNA of the organization. It goes beyond simple color-picking; it implements a philosophy of typography and spatial harmony that makes every artifact look like it was designed by a corporate brand team.

```bash
# Equip your agent with the brand-guidelines skill
npx killer-skills add anthropics/skills/brand-guidelines
```

## What is the Brand-Guidelines Skill?

The `brand-guidelines` skill is a design engine that enforces strict visual standards. It is designed to be used in conjunction with other creative skills like [pptx](https://killer-skills.com/en/skills/anthropics/skills/pptx) or [canvas-design](https://killer-skills.com/en/skills/anthropics/skills/canvas-design) to ensure they stay "on-brand."

### 1. The Official Color Palette
The skill provides precise RGB and HEX values for the official identity:
- **Core Tones**: `Dark (#141413)` for primary text and `Light (#faf9f5)` for backgrounds.
- **Accent Hierarchy**: A distinct hierarchy of `Orange (#d97757)`, `Blue (#6a9bcc)`, and `Green (#788c5d)` to guide the eye.
- **Neutral Grays**: Carefully selected mid and light grays for subtle UI elements.

### 2. High-End Typography
Typography is the voice of a brand. This skill implements a sophisticated pairing:
- **Headings**: **Poppins**—a geometric sans-serif that feels modern and approachable.
- **Body Text**: **Lora**—a contemporary serif with roots in calligraphy, providing excellent readability for long-form content.
- **Smart Fallbacks**: Built-in logic to gracefully degrade to Arial or Georgia if custom fonts aren't available.

## How the Skill Works

When you trigger the `brand-guidelines` skill, the agent doesn't just apply styles randomly. It performs a "brand audit" of the current artifact:
- **Spatial Hierarchy**: It ensures headings are at least 24pt and uses Poppins for impact.
- **Contrast Logic**: It intelligently selects text colors based on the background to ensure accessibility.
- **Shape Syncing**: Non-text elements (like buttons or chart bars) are automatically cycled through the accent colors (Orange, Blue, Green) to maintain visual interest.

## Practical Use Cases

### Corporate Presentations
Take a generic pitch deck and instantly transform it into an "Official" presentation that matches the company's website and marketing materials.

### Internal Tooling
Design dashboards or internal reports that feel like a seamless extension of the company's product ecosystem.

### Marketing Assets
Generate social media graphics or PDF whitepapers that are instantly recognizable through their consistent use of color and type.

## How to use it with Killer-Skills

1.  **Install**: `npx killer-skills add anthropics/skills/brand-guidelines`
2.  **Command**: "Take this current presentation and apply the official brand guidelines. Use the primary orange for callouts."
3.  **Refine**: "Does this layout follow our typography standards? If not, adjust the headings to Poppins 24pt."

## Conclusion

The `brand-guidelines` skill is the final polish that turns "AI-output" into "Professional Asset." It ensures that your coding agent understands the importance of visual context and brand authority.

Install the [brand-guidelines skill](https://killer-skills.com/en/skills/anthropics/skills/brand-guidelines) from the Killer-Skills Marketplace and start designing with authority.

---

*Looking for more styling options? Explore [theme-factory](https://killer-skills.com/en/skills/anthropics/skills/theme-factory) for a wider range of pre-set professional themes.*
