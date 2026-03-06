
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { IDE_CONFIG } from '../config/ides.js';

/**
 * Universal IDE Skill Injector
 * 
 * Handles skill injection for ALL 18 supported IDEs/Agents.
 * Groups:
 *   - Native SKILL.md IDEs: claude, antigravity, aider, codex, goose, cline, roo, trae, augment, openclaw, continue, cody, amazonq
 *   - Cursor: @import reference in .cursorrules
 *   - Windsurf: Copy to .windsurf/rules/<name>.md
 *   - VS Code / Copilot: Append to .github/copilot-instructions.md
 *   - Kiro: Convert to .kiro/agents/<name>.json
 */
export async function injectSkill(
    ide: string,
    skillName: string,
    skillDir: string, // Directory containing SKILL.md
    targetDir: string // Destination directory (e.g. .cursor/skills/react)
): Promise<void> {
    const config = IDE_CONFIG[ide];
    if (!config) return;

    switch (ide) {
        // === Editors with special injection ===
        case 'cursor':
        case 'trae':
            await injectCursorOrTrae(ide, skillName, targetDir);
            break;
        case 'windsurf':
            await injectWindsurf(skillName, skillDir, targetDir);
            break;
        case 'vscode':
        case 'copilot':
            await injectCopilot(skillName, skillDir, targetDir);
            break;

        // === Kiro (AWS) — agent.json format conversion ===
        case 'kiro':
            await injectKiro(skillName, skillDir, targetDir);
            break;

        case 'claude':
            await injectClaudeDesktop(skillName, skillDir, targetDir);
            break;
        case 'antigravity':
        case 'aider':
        case 'codex':
        case 'opencode':
        case 'goose':
        case 'cline':
        case 'roo':
        case 'augment':
        case 'openclaw':
        case 'continue':
        case 'cody':
        case 'amazonq':
            await injectNativeSkillMd(ide, skillName, skillDir, targetDir);
            break;

        default:
            // Fallback: treat as native SKILL.md
            await injectNativeSkillMd(ide, skillName, skillDir, targetDir);
            break;
    }
}

/**
 * Native SKILL.md IDEs
 * These IDEs read SKILL.md directly from their skills directory.
 * We ensure the file is in place and log confirmation.
 */
async function injectNativeSkillMd(
    ide: string,
    skillName: string,
    skillDir: string,
    targetDir: string
) {
    const config = IDE_CONFIG[ide];
    const skillFile = path.join(targetDir, 'SKILL.md');

    // If SKILL.md isn't in targetDir yet, copy it
    if (!fs.existsSync(skillFile)) {
        const sourceSkill = path.join(skillDir, 'SKILL.md');
        if (fs.existsSync(sourceSkill)) {
            await fs.ensureDir(targetDir);
            await fs.copy(sourceSkill, skillFile);
        }
    }

    if (fs.existsSync(skillFile)) {
        console.log(chalk.green(`  › ${config?.name || ide}: SKILL.md installed to ${path.relative(process.cwd(), targetDir)}`));
    }
}

/**
 * Claude Desktop Adapter
 * Handles both standard prompt skills (SKILL.md) and MCP Server injection.
 */
async function injectClaudeDesktop(skillName: string, skillDir: string, targetDir: string) {
    const config = IDE_CONFIG['claude'];
    const sourceSkill = path.join(skillDir, 'SKILL.md');

    // First, install the SKILL.md (if any) to the target dir so we preserve prompt usage
    const skillFile = path.join(targetDir, 'SKILL.md');
    if (!fs.existsSync(skillFile) && fs.existsSync(sourceSkill)) {
        await fs.ensureDir(targetDir);
        await fs.copy(sourceSkill, skillFile);
    }

    if (fs.existsSync(skillFile)) {
        console.log(chalk.green(`  › ${config?.name || 'Claude'}: SKILL.md installed to ${path.relative(process.cwd(), targetDir)}`));

        // Now, parse frontmatter to see if this is an MCP server needing JSON injection
        const content = await fs.readFile(skillFile, 'utf-8');
        const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);

        if (fmMatch) {
            const frontmatter = fmMatch[1];

            // Look for mcpCommand: "npx" or similar
            const mcpCmdMatch = frontmatter.match(/mcpCommand:\s*(.+)/);
            if (mcpCmdMatch) {
                let mcpCommand = mcpCmdMatch[1].trim().replace(/^["']|["']$/g, '');

                // Look for mcpArgs: ["-y", "@modelcontextprotocol/server-postgres", "..."]
                let argsArray: string[] = [];
                const mcpArgsMatch = frontmatter.match(/mcpArgs:\s*(\[.*?\])/);
                if (mcpArgsMatch) {
                    try {
                        // Very basic JSON parse for the array string
                        // We replace single quotes with double quotes internally for safety if YAML used single quotes
                        const arrayRaw = mcpArgsMatch[1].replace(/'/g, '"');
                        argsArray = JSON.parse(arrayRaw);
                    } catch (e) {
                        console.warn(chalk.yellow(`  › Claude: Failed to parse mcpArgs, using command string only.`));
                    }
                } else {
                    // Fallback to splitting command by space if no explicit args provided, e.g. "npx -y @smithery/cli"
                    const parts = mcpCommand.split(' ');
                    if (parts.length > 1) {
                        mcpCommand = parts[0];
                        argsArray = parts.slice(1);
                    }
                }

                // Call addToClaudeConfig to perform the actual JSON injection
                const { addToClaudeConfig } = await import('../config/claude.js');
                await addToClaudeConfig(skillName, mcpCommand, argsArray);
                console.log(chalk.green(`  › Claude Desktop: Successfully injected MCP Server configuration.`));
            }
        }
    }
}

/**
 * Cursor / Trae Adapter:
 * Appends an @import reference to .cursorrules or .traerules
 */
async function injectCursorOrTrae(ide: string, skillName: string, targetDir: string) {
    const projectRoot = process.cwd();
    const rulesFileName = ide === 'trae' ? '.traerules' : '.cursorrules';
    const rulesPath = path.join(projectRoot, rulesFileName);

    const relativePath = path.relative(projectRoot, path.join(targetDir, 'SKILL.md'));
    const importLine = `\n\n# Skill: ${skillName}\n@${relativePath}\n`;

    let content = '';
    if (fs.existsSync(rulesPath)) {
        content = await fs.readFile(rulesPath, 'utf-8');
    }

    if (!content.includes(relativePath)) {
        await fs.writeFile(rulesPath, content + importLine);
        const name = ide === 'trae' ? 'Trae' : 'Cursor';
        console.log(chalk.green(`  › ${name}: Added @import to ${rulesFileName}`));
    }
}

/**
 * Windsurf Adapter:
 * Copies SKILL.md to .windsurf/rules/[skillName].md
 */
async function injectWindsurf(skillName: string, skillDir: string, targetDir: string) {
    const sourceSkill = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(sourceSkill)) return;

    const rulesDir = path.dirname(targetDir);
    const targetFile = path.join(rulesDir, `${skillName}.md`);

    const content = await fs.readFile(sourceSkill, 'utf-8');
    await fs.ensureDir(rulesDir);
    await fs.writeFile(targetFile, content);
    console.log(chalk.green(`  › Windsurf: Created .windsurf/rules/${skillName}.md`));
}

/**
 * Copilot / VS Code Adapter:
 * Appends instructions to .github/copilot-instructions.md
 */
async function injectCopilot(skillName: string, skillDir: string, targetDir: string) {
    const projectRoot = process.cwd();
    const copilotPath = path.join(projectRoot, '.github', 'copilot-instructions.md');

    const sourceSkill = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(sourceSkill)) return;

    const skillContent = await fs.readFile(sourceSkill, 'utf-8');
    const block = `\n\n<!-- Skill: ${skillName} -->\n${skillContent}\n<!-- End Skill -->\n`;

    await fs.ensureDir(path.dirname(copilotPath));
    if (fs.existsSync(copilotPath)) {
        const current = await fs.readFile(copilotPath, 'utf-8');
        if (!current.includes(`Skill: ${skillName}`)) {
            await fs.appendFile(copilotPath, block);
            console.log(chalk.green(`  › Copilot: Appended to .github/copilot-instructions.md`));
        }
    } else {
        await fs.writeFile(copilotPath, "# Copilot Instructions\n" + block);
        console.log(chalk.green(`  › Copilot: Created .github/copilot-instructions.md`));
    }
}

/**
 * Kiro (AWS) Adapter:
 * Converts SKILL.md to .kiro/agents/<name>.json agent format
 * 
 * Kiro agent format:
 * {
 *   "name": "skill-name",
 *   "description": "...",
 *   "instructions": "...",
 *   "tools": []
 * }
 */
async function injectKiro(skillName: string, skillDir: string, targetDir: string) {
    const sourceSkill = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(sourceSkill)) return;

    const content = await fs.readFile(sourceSkill, 'utf-8');

    // Extract frontmatter description if present
    let description = `Skill: ${skillName}`;
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (fmMatch) {
        const descMatch = fmMatch[1].match(/description:\s*(.+)/);
        if (descMatch) {
            description = descMatch[1].trim().replace(/^["']|["']$/g, '');
        }
    }

    // Strip frontmatter for instructions
    let instructions = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '').trim();

    // Prepend universal CLI instructions
    // This is crucial for Kiro to know how to use the CLI tools
    const { SKILL_USAGE_INSTRUCTIONS } = await import('./prompt-templates.js');
    instructions = `${SKILL_USAGE_INSTRUCTIONS}\n\n${instructions}`;

    const agentJson = {
        name: skillName,
        description,
        instructions,
        tools: [],
        source: 'killer-skills'
    };

    // Write to .kiro/agents/<name>/agent.json
    await fs.ensureDir(targetDir);
    const targetFile = path.join(targetDir, 'agent.json');
    await fs.writeFile(targetFile, JSON.stringify(agentJson, null, 2));
    console.log(chalk.green(`  › Kiro: Created .kiro/agents/${skillName}/agent.json`));

    // Also keep SKILL.md for reference
    const skillMdTarget = path.join(targetDir, 'SKILL.md');
    if (!fs.existsSync(skillMdTarget)) {
        await fs.copy(sourceSkill, skillMdTarget);
    }
}
