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
            description: 'List all installed Killer-Skills (killer list)',
            content: `---
description: List all installed Killer-Skills (killer list)
---

Run the following command to list all installed skills:

// turbo
1. Run \`killer list --verbose\` in the terminal and display the results to the user.
`,
        },
        {
            filename: 'killer-install.md',
            description: 'Install a skill via Killer-Skills CLI (killer install <skill-name>)',
            content: `---
description: Install a skill via Killer-Skills CLI (killer install <skill-name>)
---

Install a skill from the registry, GitHub, or a local path.

1. Ask the user which skill they want to install. If they already provided a skill name in their message, use that.

// turbo
2. Run \`killer install <skill-name> -i windsurf -y\` in the terminal, replacing \`<skill-name>\` with the actual skill name.

3. After installation, run \`killer sync -i windsurf -y\` to update the rules file so skills are discoverable.

4. Report the installation result to the user.
`,
        },
        {
            filename: 'killer-read.md',
            description: 'Read and load a skill\'s content (killer read <skill-name>)',
            content: `---
description: Read and load a skill's content (killer read <skill-name>)
---

Read a skill's content and load its instructions into context.

1. If the user didn't specify a skill name, run \`killer list\` first to show available skills and ask which one to load.

// turbo
2. Run \`killer read <skill-name>\` in the terminal, replacing \`<skill-name>\` with the actual skill name.

3. Parse the output and follow the skill's instructions for the current task.
`,
        },
        {
            filename: 'killer-sync.md',
            description: 'Sync installed skills to make them discoverable by AI (killer sync)',
            content: `---
description: Sync installed skills to make them discoverable by AI (killer sync)
---

Sync all installed skills to the Windsurf rules file.

// turbo
1. Run \`killer sync -i windsurf -y\` in the terminal.

2. Report the sync result to the user.
`,
        },
        {
            filename: 'killer-search.md',
            description: 'Search for skills in the registry (killer search <keyword>)',
            content: `---
description: Search for skills in the registry (killer search <keyword>)
---

Search for available skills in the Killer-Skills registry.

1. Ask the user what kind of skill they are looking for. If they already provided a keyword, use that.

// turbo
2. Run \`killer search <keyword>\` in the terminal, replacing \`<keyword>\` with the search term.

3. Display the search results and ask the user if they want to install any of the found skills.
`,
        },
        {
            filename: 'killer-create.md',
            description: 'Create a new custom skill (killer create <name>)',
            content: `---
description: Create a new custom skill (killer create <name>)
---

Create a new custom skill from a template.

1. Ask the user for the skill name and a brief description. If they already provided these, use them.

// turbo
2. Run \`killer create <name> -i windsurf -y\` in the terminal, replacing \`<name>\` with the skill name.

3. Report the result and suggest the user edit the generated SKILL.md to customize the skill content.
`,
        },
        {
            filename: 'killer-manage.md',
            description: 'Manage installed skills - enable, disable, or remove (killer manage)',
            content: `---
description: Manage installed skills - enable, disable, or remove (killer manage)
---

Interactively manage installed skills.

// turbo
1. Run \`killer list --verbose\` in the terminal to show all installed skills with details.

2. Ask the user what they want to do: enable, disable, or remove a skill.

// turbo
3. Run the appropriate \`killer\` command based on the user's choice.
`,
        },
        {
            filename: 'killer-update.md',
            description: 'Update installed skills to their latest versions (killer update)',
            content: `---
description: Update installed skills to their latest versions (killer update)
---

Update all installed skills from their original sources.

// turbo
1. Run \`killer update\` in the terminal.

2. After the update completes, run \`killer sync -i windsurf -y\` to refresh the rules file.

3. Report the update results to the user.
`,
        },
        {
            filename: 'killer-validate.md',
            description: 'Validate a skill\'s structure and metadata quality (killer validate)',
            content: `---
description: Validate a skill's structure and metadata quality (killer validate)
---

Validate a skill to ensure it meets quality standards before publishing.

1. If the user specified a skill path, use that. Otherwise default to the current directory.

// turbo
2. Run \`killer validate <path>\` in the terminal, replacing \`<path>\` with the skill directory path (or \`.\` for current).

3. Report any validation issues and suggest fixes.
`,
        },
        {
            filename: 'killer-outdated.md',
            description: 'Check for outdated skills that can be updated (killer outdated)',
            content: `---
description: Check for outdated skills that can be updated (killer outdated)
---

Check which installed skills have newer versions available.

// turbo
1. Run \`killer outdated --verbose\` in the terminal.

2. Display the results and ask the user if they want to update any outdated skills.

3. If the user wants to update, run \`killer update\` followed by \`killer sync -i windsurf -y\`.
`,
        },
        {
            filename: 'killer-deps.md',
            description: 'Check and manage skill dependencies (killer deps)',
            content: `---
description: Check and manage skill dependencies (killer deps)
---

Check skill dependencies and identify missing ones.

// turbo
1. Run \`killer deps --tree\` in the terminal to show the full dependency tree.

2. If there are missing dependencies, ask the user if they want to install them.

// turbo
3. If yes, run \`killer deps --install\` to install missing dependencies.
`,
        },
        {
            filename: 'killer-do.md',
            description: 'Execute a task using natural language to auto-match skills (killer do)',
            content: `---
description: Execute a task using natural language to auto-match skills (killer do)
---

Use natural language to find and execute the best matching skill for a task.

1. Ask the user to describe what they want to do. If they already provided a description, use that.

// turbo
2. Run \`killer do "<task description>"\` in the terminal, replacing \`<task description>\` with the user's input.

3. Follow the matched skill's instructions to complete the task.
`,
        },
        {
            filename: 'killer-init.md',
            description: 'Initialize Killer-Skills configuration in the current project (killer init)',
            content: `---
description: Initialize Killer-Skills configuration in the current project (killer init)
---

Initialize the project for use with Killer-Skills.

// turbo
1. Run \`killer init -i windsurf -y\` in the terminal.

2. Report the initialization result and suggest next steps (install skills, sync, etc.).
`,
        },
        {
            filename: 'killer-config.md',
            description: 'View or manage Killer-Skills CLI configuration (killer config)',
            content: `---
description: View or manage Killer-Skills CLI configuration (killer config)
---

View or modify the CLI configuration.

// turbo
1. Run \`killer config --list\` in the terminal to show all current configuration.

2. If the user wants to change a setting, ask which key and value they want to set.

// turbo
3. Run \`killer config <key> <value>\` to apply the change.
`,
        },
        {
            filename: 'killer-stats.md',
            description: 'View Killer-Skills CLI usage statistics (killer stats)',
            content: `---
description: View Killer-Skills CLI usage statistics (killer stats)
---

Display CLI usage statistics including install counts and command usage.

// turbo
1. Run \`killer stats\` in the terminal.

2. Present the statistics to the user in a readable format.
`,
        },
        {
            filename: 'killer-plugin.md',
            description: 'Manage CLI plugins - list, add, or remove (killer plugin)',
            content: `---
description: Manage CLI plugins - list, add, or remove (killer plugin)
---

Manage Killer-Skills CLI plugins.

// turbo
1. Run \`killer plugin list\` in the terminal to show installed plugins.

2. Ask the user what they want to do: list, add, or remove a plugin.

// turbo
3. Run the appropriate command:
   - Add: \`killer plugin add <source>\`
   - Remove: \`killer plugin remove <name>\`
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
