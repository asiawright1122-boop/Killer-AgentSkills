---
title: "How to install AI agent skills in 30 seconds"
description: "A quick guide to installing community AI agent skills into Claude Code, Cursor, or Windsurf using the killer-skills CLI tool."
pubDate: 2026-02-24
author: "Killer-Skills Team"
tags: ["Tutorial", "AI Agent Skills", "CLI", "Developer Tools", "Automation"]
lang: "fr"
featured: false
category: "guides"
heroImage: "https://images.unsplash.com/photo-1629654297299-c8506221ca97?q=80&w=2560&auto=format&fit=crop"
---

# How to install AI agent skills

You found an AI agent skill you want to use. Maybe it is the [docx automation skill](/en/skills/anthropics/skills/docx), or maybe a specialized frontend UI generator. Now you need to get it into your project so your coding agent can actually read it.

You can manually copy and paste the markdown text, create the right directories, and fix the frontmatter formatting yourself. Or you can run one command that does it for you.

## The killer-skills CLI

We built a command-line tool specifically for this. It handles fetching the skill from GitHub, converting it to the right format for your IDE (Claude Code, Cursor, Windsurf, or GitHub Copilot), and placing it in the correct directory.

You don't need to install it permanently. You can run it directly via `npx` (which comes with Node.js).

Open your terminal, go to your project directory, and run:

```bash
npx killer-skills add <owner>/<repo>/<skill-name>
```

For example, to install the PDF automation skill, you run:

```bash
npx killer-skills add anthropics/skills/pdf
```

The CLI detects which IDE you are using by looking at your project files. If it sees a `.cursor` directory, it formats the skill as an `.mdc` file. If it sees a `.claude` directory, it formats it as `SKILL.md`.

## Installing across multiple IDEs

If you use multiple agents on the same project (for example, Claude Code in the terminal and Cursor as your editor), you can force the CLI to install the skill for all of them at once.

Just add the `--all` flag:

```bash
npx killer-skills add anthropics/skills/pdf --all
```

This creates the necessary files in both `.claude/skills/` and `.cursor/rules/`, keeping the core instructions identical while formatting the metadata correctly for each agent.

## Finding skills to install

If you know what you are looking for but don't remember the exact repository path, you can search directly from your terminal:

```bash
npx killer-skills search auth
```

This queries the community database and returns the top matches, including their star counts and full installation paths. You can also browse the full open-source directory on the [Killer-Skills website](/en/skills).

## Keeping skills updated

Skills evolve. Authors add new edge cases, fix bad instructions, and improve prompt reliability. Because you installed the skill via the CLI, you can update it just as easily.

```bash
npx killer-skills update
```

This checks all the skills you've installed, compares them to the upstream source on GitHub, and applies any updates while preserving local modifications where possible.

## What is actually happening under the hood?

When you run the `add` command, the CLI isn't installing executable software or npm dependencies. It is just downloading text. 

A skill is simply a markdown file with instructions for a Large Language Model. The CLI fetches that markdown, wraps it in the specific YAML or JSON format your editor expects, and writes it to a local folder. 

There are no background processes, no phone-home telemetry, and no hidden payloads. It is just documentation, placed exactly where your AI agent knows to look for it.

---

*Related: [What are AI agent skills?](/fr/blog/what-are-ai-agent-skills) and [Best AI agent skills for 2026](/fr/blog/best-ai-agent-skills-2026)*
