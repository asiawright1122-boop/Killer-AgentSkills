/**
 * Prompt Templates
 * 
 * IDE-specific prompt templates for the sync command.
 * Each IDE may have different preferred formats for skill discovery.
 * 
 * CRITICAL: All templates include AUTO-INVOKE directives that instruct
 * AI agents to automatically match user tasks against available skills
 * and invoke them without asking for permission.
 */

import type { SkillInfo } from './agents-md.js';

/**
 * Template format types
 */
export type PromptFormat = 'xml' | 'markdown' | 'yaml' | 'json';

/**
 * Template configuration for each IDE
 */
export interface PromptTemplate {
    format: PromptFormat;
    generate: (skills: SkillInfo[]) => string;
}

// ============================================================
// AUTO-INVOKE DIRECTIVE (shared across all templates)
// ============================================================

const AUTO_INVOKE_DIRECTIVE = `IMPORTANT: You MUST automatically match user tasks against the available skills listed below.
When a user's request falls within a skill's domain, invoke the skill IMMEDIATELY by running:
  \`killer read <skill-name>\`
Do NOT ask for permission — just load the skill and follow its instructions.
If multiple skills match, load the most relevant one first.`;

const SKILL_USAGE_INSTRUCTIONS = `How to use skills:
- Invoke: \`killer read <skill-name>\` (run in your shell/terminal)
  - For multiple skills: \`killer read skill-one,skill-two\`
- The skill content will load with detailed instructions
- Base directory provided in output for resolving bundled resources (references/, scripts/, assets/)

Usage notes:
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already loaded in your context
- Each skill invocation is stateless`;

// ============================================================
// XML Template (OpenSkills-compatible) — Claude, Antigravity, Aider, Codex, etc.
// ============================================================

export function generateXmlPrompt(skills: SkillInfo[]): string {
    const skillTags = skills.map(s => `<skill>
<name>${s.name}</name>
<description>${s.description || 'No description'}</description>
<location>${s.location}</location>
</skill>`).join('\n\n');

    return `<skills_system priority="1">

## Available Skills

<!-- SKILLS_TABLE_START -->
<usage>
${AUTO_INVOKE_DIRECTIVE}

${SKILL_USAGE_INSTRUCTIONS}
</usage>

<available_skills>

${skillTags}

</available_skills>
<!-- SKILLS_TABLE_END -->

</skills_system>
`;
}

// ============================================================
// Cursor Template (Markdown rules format)
// ============================================================

export function generateCursorPrompt(skills: SkillInfo[]): string {
    const skillList = skills.map(s =>
        `  - **${s.name}**: ${s.description || 'No description'}`
    ).join('\n');

    return `# Cursor Rules - Skills Integration

## ⚡ Auto-Invoke Skills

${AUTO_INVOKE_DIRECTIVE}

## Available Skills

${skillList}

## Skill Usage

When a task matches a skill's capability:
1. Run \`killer read <skill-name>\` in the terminal
2. Follow the skill's instructions
3. For multiple skills: \`killer read skill-one,skill-two\`

## Active Skills Count: ${skills.length}

`;
}

// ============================================================
// Windsurf Template (Markdown rules format)
// ============================================================

export function generateWindsurfPrompt(skills: SkillInfo[]): string {
    const skillList = skills.map(s =>
        `| ${s.name} | ${s.description ? s.description.slice(0, 60) : 'No description'} | ${s.location} |`
    ).join('\n');

    return `# Windsurf Rules - Skills

## ⚡ Auto-Invoke Skills

${AUTO_INVOKE_DIRECTIVE}

## Skills System

| Skill | Description | Location |
|-------|-------------|----------|
${skillList}

### Usage

Invoke skills with: \`killer read <skill-name>\`

Skills provide specialized capabilities for common development tasks.

`;
}

// ============================================================
// Kiro Template (JSON-flavored Markdown for agent context)
// ============================================================

export function generateKiroPrompt(skills: SkillInfo[]): string {
    const skillEntries = skills.map(s => ({
        name: s.name,
        description: s.description || 'No description',
        invoke: `killer read ${s.name}`
    }));

    return `# Agent Skills

## ⚡ Auto-Invoke Directive

${AUTO_INVOKE_DIRECTIVE}

## Available Skills

\`\`\`json
${JSON.stringify(skillEntries, null, 2)}
\`\`\`

## Usage

Run \`killer read <skill-name>\` to load skill instructions into context.

`;
}

// ============================================================
// Copilot Template (GitHub instructions format)
// ============================================================

export function generateCopilotPrompt(skills: SkillInfo[]): string {
    const skillList = skills.map(s =>
        `- **${s.name}**: ${s.description || 'No description'}`
    ).join('\n');

    return `## Skills Integration

${AUTO_INVOKE_DIRECTIVE}

### Available Skills

${skillList}

### How to Use

Run \`killer read <skill-name>\` in the terminal to load skill instructions.
For multiple skills: \`killer read skill-one,skill-two\`

`;
}

// ============================================================
// Generic Markdown Template (fallback)
// ============================================================

export function generateMarkdownPrompt(skills: SkillInfo[]): string {
    const skillList = skills.map(s =>
        `- **${s.name}** (${s.location}): ${s.description || 'No description'}`
    ).join('\n');

    return `## Available Skills

${AUTO_INVOKE_DIRECTIVE}

### Skills List

${skillList}

### How to Use

To use a skill, run: \`killer read <skill-name>\`

For multiple skills: \`killer read skill-one,skill-two\`

---

`;
}

// ============================================================
// Template Registry
// ============================================================

export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
    // Default XML (OpenSkills-compatible)
    default: { format: 'xml', generate: generateXmlPrompt },

    // === CLI Agents (XML format) ===
    claude: { format: 'xml', generate: generateXmlPrompt },
    antigravity: { format: 'xml', generate: generateXmlPrompt },
    aider: { format: 'xml', generate: generateXmlPrompt },
    codex: { format: 'xml', generate: generateXmlPrompt },

    // === Editors (Markdown format) ===
    cursor: { format: 'markdown', generate: generateCursorPrompt },
    windsurf: { format: 'markdown', generate: generateWindsurfPrompt },
    trae: { format: 'markdown', generate: generateCursorPrompt },

    // === Agents (XML format) ===
    goose: { format: 'xml', generate: generateXmlPrompt },
    cline: { format: 'xml', generate: generateXmlPrompt },
    roo: { format: 'xml', generate: generateXmlPrompt },
    augment: { format: 'xml', generate: generateXmlPrompt },

    // === Kiro (JSON-flavored) ===
    kiro: { format: 'json', generate: generateKiroPrompt },

    // === VS Code Extensions ===
    vscode: { format: 'markdown', generate: generateCopilotPrompt },
    copilot: { format: 'markdown', generate: generateCopilotPrompt },
    continue: { format: 'xml', generate: generateXmlPrompt },
    cody: { format: 'xml', generate: generateXmlPrompt },
    amazonq: { format: 'xml', generate: generateXmlPrompt },

    // Generic fallback
    markdown: { format: 'markdown', generate: generateMarkdownPrompt }
};

/**
 * Get the appropriate template for an IDE
 */
export function getTemplateForIDE(ide: string): PromptTemplate {
    return PROMPT_TEMPLATES[ide] || PROMPT_TEMPLATES.default;
}

/**
 * Generate prompt for skills using IDE-specific template
 */
export function generatePromptForIDE(ide: string, skills: SkillInfo[]): string {
    const template = getTemplateForIDE(ide);
    return template.generate(skills);
}
