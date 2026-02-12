/**
 * AGENTS.md Generator
 * 
 * Generates standardized XML prompt for AI agents to understand and use installed skills.
 * Compatible with OpenSkills format for cross-tool interoperability.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, basename } from 'path';

export interface SkillInfo {
    name: string;
    description: string;
    location: 'project' | 'global';
    path: string;
}

/**
 * Generate skills XML section in OpenSkills-compatible format
 */
export function generateSkillsXml(skills: SkillInfo[]): string {
    if (skills.length === 0) {
        return '';
    }

    const skillTags = skills
        .map(s => `<skill>
<name>${escapeXml(s.name)}</name>
<description>${escapeXml(s.description)}</description>
<location>${s.location}</location>
</skill>`)
        .join('\n\n');

    return `<skills_system priority="1">

## Available Skills

<!-- SKILLS_TABLE_START -->
<usage>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke: \`killer read <skill-name>\` (run in your shell)
  - For multiple: \`killer read skill-one,skill-two\`
- The skill content will load with detailed instructions on how to complete the task
- Base directory provided in output for resolving bundled resources (references/, scripts/, assets/)

Usage notes:
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already loaded in your context
- Each skill invocation is stateless
</usage>

<available_skills>

${skillTags}

</available_skills>
<!-- SKILLS_TABLE_END -->

</skills_system>`;
}

/**
 * Parse skill names currently in an AGENTS.md file
 */
export function parseCurrentSkills(content: string): string[] {
    const skillNames: string[] = [];

    // Match <skill><name>skill-name</name>...</skill>
    const skillRegex = /<skill>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/skill>/g;

    let match;
    while ((match = skillRegex.exec(content)) !== null) {
        skillNames.push(match[1].trim());
    }

    return skillNames;
}

/**
 * Replace or add skills section in a markdown file
 */
export function replaceSkillsSection(content: string, newSection: string): string {
    const startMarker = '<skills_system';
    const endMarker = '</skills_system>';

    // Check for XML markers
    if (content.includes(startMarker)) {
        const regex = /<skills_system[^>]*>[\s\S]*?<\/skills_system>/;
        return content.replace(regex, newSection);
    }

    // Fallback to HTML comments
    const htmlStartMarker = '<!-- SKILLS_TABLE_START -->';
    const htmlEndMarker = '<!-- SKILLS_TABLE_END -->';

    if (content.includes(htmlStartMarker)) {
        // Extract just the inner content without outer XML wrapper
        const innerMatch = newSection.match(/<!-- SKILLS_TABLE_START -->[\s\S]*<!-- SKILLS_TABLE_END -->/);
        if (innerMatch) {
            const regex = new RegExp(
                `${escapeRegex(htmlStartMarker)}[\\s\\S]*?${escapeRegex(htmlEndMarker)}`,
                'g'
            );
            return content.replace(regex, innerMatch[0]);
        }
    }

    // No markers found - append to end of file
    return content.trimEnd() + '\n\n' + newSection + '\n';
}

/**
 * Remove skills section from a markdown file
 */
export function removeSkillsSection(content: string): string {
    const startMarker = '<skills_system';

    if (content.includes(startMarker)) {
        const regex = /<skills_system[^>]*>[\s\S]*?<\/skills_system>/;
        return content.replace(regex, '<!-- Skills section removed -->');
    }

    const htmlStartMarker = '<!-- SKILLS_TABLE_START -->';
    const htmlEndMarker = '<!-- SKILLS_TABLE_END -->';

    if (content.includes(htmlStartMarker)) {
        const regex = new RegExp(
            `${escapeRegex(htmlStartMarker)}[\\s\\S]*?${escapeRegex(htmlEndMarker)}`,
            'g'
        );
        return content.replace(regex, `${htmlStartMarker}\n<!-- Skills section removed -->\n${htmlEndMarker}`);
    }

    return content;
}

/**
 * Ensure a markdown file exists, creating it if necessary
 */
export function ensureMarkdownFile(filePath: string, defaultTitle?: string): void {
    if (!existsSync(filePath)) {
        const dir = dirname(filePath);
        if (dir && dir !== '.' && !existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        const title = defaultTitle || basename(filePath).replace('.md', '');
        writeFileSync(filePath, `# ${title}\n\n`);
    }
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
