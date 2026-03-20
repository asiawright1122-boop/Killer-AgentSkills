/**
 * Windsurf Workflow Generator
 *
 * Generates .windsurf/workflows/ files so that Killer-Skills CLI commands
 * can be invoked as slash commands inside Windsurf's chat dialog.
 *
 * Windsurf does NOT execute CLI commands from chat input directly.
 * Instead, it uses workflow .md files in .windsurf/workflows/ to define
 * slash commands (e.g. /killer-list, /killer-install, etc.)
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

interface WorkflowDef {
    filename: string;
    description: string;
    content: string;
}

/**
 * All Killer-Skills workflows for Windsurf
 */
function getWorkflowDefinitions(): WorkflowDef[] {
    return [
        {
            filename: 'killer-list.md',
            description: 'List all installed Killer-Skills (npx killer-skills list)',
            content: `---
description: List all installed Killer-Skills (npx killer-skills list)
---

Run the following command to list all installed skills:

// turbo
1. Run \`npx killer-skills list --verbose\` in the terminal and display the results to the user.
`,
        },
        {
            filename: 'killer-install.md',
            description: 'Install a skill via Killer-Skills CLI (npx killer-skills add <skill-name>)',
            content: `---
description: Install a skill via Killer-Skills CLI (npx killer-skills add <skill-name>)
---

Install a skill from the registry, GitHub, or a local path.

1. Ask the user which skill they want to install. If they already provided a skill name in their message, use that.

// turbo
2. Run \`npx killer-skills add <skill-name> -i windsurf -y\` in the terminal, replacing \`<skill-name>\` with the actual skill name.

3. After installation, run \`npx killer-skills sync -i windsurf -y\` to update the rules file so skills are discoverable.

4. Report the installation result to the user.
`,
        },
        {
            filename: 'killer-read.md',
            description: 'Read and load a skill\'s content (npx killer-skills read <skill-name>)',
            content: `---
description: Read and load a skill's content (npx killer-skills read <skill-name>)
---

Read a skill's content and load its instructions into context.

1. If the user didn't specify a skill name, run \`npx killer-skills list\` first to show available skills and ask which one to load.

// turbo
2. Run \`npx killer-skills read <skill-name>\` in the terminal, replacing \`<skill-name>\` with the actual skill name.

3. Parse the output and follow the skill's instructions for the current task.
`,
        },
        {
            filename: 'killer-sync.md',
            description: 'Sync installed skills to make them discoverable by AI (npx killer-skills sync)',
            content: `---
description: Sync installed skills to make them discoverable by AI (npx killer-skills sync)
---

Sync all installed skills to the Windsurf rules file.

// turbo
1. Run \`npx killer-skills sync -i windsurf -y\` in the terminal.

2. Report the sync result to the user.
`,
        },
        {
            filename: 'killer-search.md',
            description: 'Search for skills in the registry (npx killer-skills search <keyword>)',
            content: `---
description: Search for skills in the registry (npx killer-skills search <keyword>)
---

Search for available skills in the Killer-Skills registry.

1. Ask the user what kind of skill they are looking for. If they already provided a keyword, use that.

// turbo
2. Run \`npx killer-skills search <keyword>\` in the terminal, replacing \`<keyword>\` with the search term.

3. Display the search results and ask the user if they want to install any of the found skills.
`,
        },
        {
            filename: 'killer-create.md',
            description: 'Create a new custom skill (npx killer-skills create <name>)',
            content: `---
description: Create a new custom skill (npx killer-skills create <name>)
---

Create a new custom skill from a template.

1. Ask the user for the skill name and a brief description. If they already provided these, use them.

// turbo
2. Run \`npx killer-skills create <name> -i windsurf -y\` in the terminal, replacing \`<name>\` with the skill name.

3. Report the result and suggest the user edit the generated SKILL.md to customize the skill content.
`,
        },
        {
            filename: 'killer-manage.md',
            description: 'Manage installed skills - enable, disable, or remove (npx killer-skills manage)',
            content: `---
description: Manage installed skills - enable, disable, or remove (npx killer-skills manage)
---

Interactively manage installed skills.

// turbo
1. Run \`npx killer-skills list --verbose\` in the terminal to show all installed skills with details.

2. Ask the user what they want to do: enable, disable, or remove a skill.

// turbo
3. Run \`npx killer-skills manage\` in the terminal and complete the requested action.
`,
        },
        {
            filename: 'killer-update.md',
            description: 'Update installed skills to their latest versions (npx killer-skills update)',
            content: `---
description: Update installed skills to their latest versions (npx killer-skills update)
---

Update all installed skills from their original sources.

// turbo
1. Run \`npx killer-skills update\` in the terminal.

2. After the update completes, run \`npx killer-skills sync -i windsurf -y\` to refresh the rules file.

3. Report the update results to the user.
`,
        },
        {
            filename: 'killer-validate.md',
            description: 'Validate a skill\'s structure and metadata quality (npx killer-skills validate)',
            content: `---
description: Validate a skill's structure and metadata quality (npx killer-skills validate)
---

Validate a skill to ensure it meets quality standards before publishing.

1. If the user specified a skill path, use that. Otherwise default to the current directory.

// turbo
2. Run \`npx killer-skills validate <path>\` in the terminal, replacing \`<path>\` with the skill directory path (or \`.\` for current).

3. Report any validation issues and suggest fixes.
`,
        },
        {
            filename: 'killer-outdated.md',
            description: 'Check for outdated skills that can be updated (npx killer-skills outdated)',
            content: `---
description: Check for outdated skills that can be updated (npx killer-skills outdated)
---

Check which installed skills have newer versions available.

// turbo
1. Run \`npx killer-skills outdated --verbose\` in the terminal.

2. Display the results and ask the user if they want to update any outdated skills.

3. If the user wants to update, run \`npx killer-skills update\` followed by \`npx killer-skills sync -i windsurf -y\`.
`,
        },
        {
            filename: 'killer-deps.md',
            description: 'Check and manage skill dependencies (npx killer-skills deps)',
            content: `---
description: Check and manage skill dependencies (npx killer-skills deps)
---

Check skill dependencies and identify missing ones.

// turbo
1. Run \`npx killer-skills deps --tree\` in the terminal to show the full dependency tree.

2. If there are missing dependencies, ask the user if they want to install them.

// turbo
3. If yes, run \`npx killer-skills deps --install\` to install missing dependencies.
`,
        },
        {
            filename: 'killer-do.md',
            description: 'Execute a task using natural language to auto-match skills (npx killer-skills do)',
            content: `---
description: Execute a task using natural language to auto-match skills (npx killer-skills do)
---

Use natural language to find and execute the best matching skill for a task.

1. Ask the user to describe what they want to do. If they already provided a description, use that.

// turbo
2. Run \`npx killer-skills do "<task description>"\` in the terminal, replacing \`<task description>\` with the user's input.

3. Follow the matched skill's instructions to complete the task.
`,
        },
        {
            filename: 'killer-init.md',
            description: 'Initialize Killer-Skills configuration in the current project (npx killer-skills init)',
            content: `---
description: Initialize Killer-Skills configuration in the current project (npx killer-skills init)
---

Initialize the project for use with Killer-Skills.

// turbo
1. Run \`npx killer-skills init -i windsurf -y\` in the terminal.

2. Report the initialization result and suggest next steps (install skills, sync, etc.).
`,
        },
        {
            filename: 'killer-config.md',
            description: 'View or manage Killer-Skills CLI configuration (npx killer-skills config)',
            content: `---
description: View or manage Killer-Skills CLI configuration (npx killer-skills config)
---

View or modify the CLI configuration.

// turbo
1. Run \`npx killer-skills config --list\` in the terminal to show all current configuration.

2. If the user wants to change a setting, ask which key and value they want to set.

// turbo
3. Run \`npx killer-skills config <key> <value>\` to apply the change.
`,
        },
        {
            filename: 'killer-stats.md',
            description: 'View Killer-Skills CLI usage statistics (npx killer-skills stats)',
            content: `---
description: View Killer-Skills CLI usage statistics (npx killer-skills stats)
---

Display CLI usage statistics including install counts and command usage.

// turbo
1. Run \`npx killer-skills stats\` in the terminal.

2. Present the statistics to the user in a readable format.
`,
        },
        {
            filename: 'killer-plugin.md',
            description: 'Manage CLI plugins - list, add, or remove (npx killer-skills plugin)',
            content: `---
description: Manage CLI plugins - list, add, or remove (npx killer-skills plugin)
---

Manage Killer-Skills CLI plugins.

// turbo
1. Run \`npx killer-skills plugin list\` in the terminal to show installed plugins.

2. Ask the user what they want to do: list, add, or remove a plugin.

// turbo
3. Run the appropriate command:
   - Add: \`npx killer-skills plugin add <source>\`
   - Remove: \`npx killer-skills plugin remove <name>\`
`,
        },
    ];
}

/**
 * Generate Windsurf workflow files in the target project directory.
 *
 * @param projectRoot - The root of the user's project (defaults to cwd)
 * @returns Number of workflows created/updated
 */
export async function generateWindsurfWorkflows(projectRoot = process.cwd()): Promise<number> {
    const workflowsDir = path.join(projectRoot, '.windsurf', 'workflows');
    await fs.ensureDir(workflowsDir);

    const definitions = getWorkflowDefinitions();
    let count = 0;

    for (const def of definitions) {
        const targetPath = path.join(workflowsDir, def.filename);
        const existing = fs.existsSync(targetPath)
            ? await fs.readFile(targetPath, 'utf-8')
            : null;

        // Only write if new or content changed
        if (existing !== def.content) {
            await fs.writeFile(targetPath, def.content);
            count++;
        }
    }

    return count;
}

/**
 * Remove Windsurf workflow files from the project.
 */
export async function removeWindsurfWorkflows(projectRoot = process.cwd()): Promise<void> {
    const workflowsDir = path.join(projectRoot, '.windsurf', 'workflows');
    const definitions = getWorkflowDefinitions();

    for (const def of definitions) {
        const targetPath = path.join(workflowsDir, def.filename);
        if (fs.existsSync(targetPath)) {
            await fs.remove(targetPath);
        }
    }
}

/**
 * Log the generated workflows summary
 */
export function logWindsurfWorkflows(): void {
    const definitions = getWorkflowDefinitions();
    console.log(chalk.green(`  › Windsurf: Generated ${definitions.length} workflow slash commands:`));
    for (const def of definitions) {
        const slashName = def.filename.replace('.md', '');
        console.log(chalk.dim(`    /${slashName} - ${def.description}`));
    }
}
