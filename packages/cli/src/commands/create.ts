/**
 * Create Command
 * 
 * Create a new skill from template or clone from existing.
 * Supports multiple template types for different use cases.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
import { findSkill } from '../utils/skills.js';
import { execSync } from 'child_process';

/**
 * Get git user name
 */
function getGitUser(): string {
    try {
        return execSync('git config user.name').toString().trim() || 'Your Name';
    } catch {
        return 'Your Name';
    }
}

/**
 * Template types
 */
type TemplateType = 'minimal' | 'standard' | 'full';

/**
 * Template content generators
 */
const TEMPLATES: Record<TemplateType, {
    description: string;
    files: (name: string, desc: string, author: string) => Record<string, string>;
}> = {
    minimal: {
        description: 'Single SKILL.md file only',
        files: (name, desc, author) => ({
            'SKILL.md': `---
name: ${name}
description: ${desc}
version: 1.0.0
author: ${author}
tags: []
---

# ${toTitleCase(name)}

## Overview

<!-- Describe what this skill does and when to use it -->

## Usage

<!-- Add instructions for using this skill -->
`
        })
    },

    standard: {
        description: 'SKILL.md with scripts and references directories',
        files: (name, desc, author) => ({
            'SKILL.md': `---
name: ${name}
description: ${desc}
version: 1.0.0
author: ${author}
tags: []
---

# ${toTitleCase(name)}

## Overview

<!-- Describe what this skill does and when to use it -->

## Usage

<!-- Add instructions for using this skill -->

## Examples

<!-- Add example use cases -->

## References

See the \`references/\` directory for additional documentation.
`,
            'scripts/.gitkeep': '',
            'references/README.md': `# References

Additional documentation and resources for ${toTitleCase(name)}.
`,
            '.gitignore': `# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
*.swo

# Dependencies
node_modules/
`
        })
    },

    full: {
        description: 'Complete skill with scripts, references, assets, and examples',
        files: (name, desc, author) => ({
            'SKILL.md': `---
name: ${name}
description: ${desc}
version: 1.0.0
author: ${author}
tags: []
---

# ${toTitleCase(name)}

## Overview

<!-- Describe what this skill does and when to use it -->

## When to Use

Use this skill when:
- <!-- Condition 1 -->
- <!-- Condition 2 -->

## Usage

### Basic Usage

\`\`\`
<!-- Add basic usage instructions -->
\`\`\`

### Advanced Options

<!-- Add advanced options -->

## Examples

See the \`examples/\` directory for sample implementations.

## API Reference

See \`references/api.md\` for detailed API documentation.

## Scripts

The following utility scripts are available in \`scripts/\`:

- \`example.py\` - Example Python script

## Assets

Static assets are available in \`assets/\`.
`,
            'scripts/example.py': `#!/usr/bin/env python3
"""
Example script for ${toTitleCase(name)} skill.

Usage:
    python scripts/example.py [args]
"""

def main():
    print("Hello from ${name}!")

if __name__ == "__main__":
    main()
`,
            'references/api.md': `# API Reference

## Functions

### \`function_name(arg1, arg2)\`

Description of the function.

**Parameters:**
- \`arg1\` (type): Description
- \`arg2\` (type): Description

**Returns:**
- Description of return value

**Example:**
\`\`\`
function_name("value1", "value2")
\`\`\`
`,
            'references/README.md': `# References

Additional documentation and resources for ${toTitleCase(name)}.

## Contents

- \`api.md\` - API Reference documentation
`,
            'examples/basic.md': `# Basic Example

## Setup

<!-- Setup instructions -->

## Example

<!-- Example code or usage -->

## Expected Output

<!-- Expected output -->
`,
            'assets/.gitkeep': '',
            '.gitignore': `# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
*.swo

# Dependencies
node_modules/

# Build artifacts
dist/
build/
`
        })
    }
};

export const createCommand = new Command('create')
    .argument('<name>', 'Name of the skill to create')
    .description('Create a new skill from template')
    .option('-t, --template <type>', 'Template type: minimal, standard, full', 'standard')
    .option('-d, --description <desc>', 'Description for the skill')
    .option('-p, --path <path>', 'Directory to create the skill in', '.')
    .option('--from <skill>', 'Clone from an existing installed skill')
    .option('-y, --yes', 'Skip prompts, use defaults')
    .action(async (name: string, options: {
        template?: string;
        description?: string;
        path?: string;
        from?: string;
        yes?: boolean;
    }) => {
        const spinner = ora();

        try {
            // Validate skill name
            if (!/^[a-z][a-z0-9-]*$/.test(name)) {
                console.error(chalk.red('Invalid skill name. Use lowercase letters, numbers, and hyphens only.'));
                console.log(chalk.dim('Example: my-awesome-skill'));
                process.exit(1);
            }

            // Determine output path
            const basePath = options.path || process.cwd();
            const skillPath = path.resolve(basePath, name);

            // Check if already exists
            if (await fs.pathExists(skillPath)) {
                console.error(chalk.red(`Directory already exists: ${skillPath}`));
                process.exit(1);
            }

            // Handle clone from existing skill
            if (options.from) {
                await cloneFromSkill(options.from, skillPath, name, spinner);
                return;
            }

            // Get description
            let description = options.description;
            if (!description && !options.yes) {
                while (!description || description.length < 20) {
                    description = await prompt(chalk.cyan('? Skill description (min 20 chars): '));
                    if (description.length < 20) {
                        console.log(chalk.yellow('⚠️  Description must be at least 20 characters to ensure quality.'));
                    }
                }
            }

            // Auto-validate non-interactive description
            if (options.description && options.description.length < 20) {
                console.log(chalk.yellow('⚠️  Warning: Description is shorter than 20 characters. It may receive a low quality score.'));
            }

            description = description || 'A useful AI agent skill that solves a specific problem.';

            // Get Author
            const author = getGitUser();

            // Get template type
            const templateType = (options.template || 'standard') as TemplateType;
            if (!TEMPLATES[templateType]) {
                console.error(chalk.red(`Unknown template: ${templateType}`));
                console.log(chalk.dim('Available templates: minimal, standard, full'));
                process.exit(1);
            }

            const template = TEMPLATES[templateType];

            // Create skill
            spinner.start(`Creating ${name} with ${templateType} template...`);

            const files = template.files(name, description!, author);
            await fs.ensureDir(skillPath);

            for (const [filePath, content] of Object.entries(files)) {
                const fullPath = path.join(skillPath, filePath);
                await fs.ensureDir(path.dirname(fullPath));
                await fs.writeFile(fullPath, content);
            }

            spinner.succeed(chalk.green('Skill created!'));

            // Print summary
            console.log('');
            console.log(chalk.green('✅ Skill created successfully!'));
            console.log(chalk.dim('─'.repeat(50)));
            console.log(`  ${chalk.bold('Name:')}        ${name}`);
            console.log(`  ${chalk.bold('Path:')}        ${skillPath}`);
            console.log(`  ${chalk.bold('Template:')}    ${templateType} (${template.description})`);
            console.log(`  ${chalk.bold('Description:')} ${description}`);
            console.log(chalk.dim('─'.repeat(50)));

            // Next steps
            console.log('');
            console.log(chalk.bold('📋 Next steps:'));
            console.log(`  1. Edit ${chalk.cyan('SKILL.md')} to add your skill instructions`);

            if (templateType === 'standard' || templateType === 'full') {
                console.log(`  2. Add documentation to ${chalk.cyan('references/')}`);
            }
            if (templateType === 'full') {
                console.log(`  3. Add scripts to ${chalk.cyan('scripts/')}`);
                console.log(`  4. Add examples to ${chalk.cyan('examples/')}`);
            }

            console.log(`  ${templateType === 'minimal' ? '2' : templateType === 'standard' ? '3' : '5'}. Install locally: ${chalk.cyan(`killer install ${skillPath}`)}`);
            console.log(`  ${templateType === 'minimal' ? '3' : templateType === 'standard' ? '4' : '6'}. Publish: ${chalk.cyan(`killer publish ${skillPath}`)}`);

        } catch (error) {
            spinner.fail(chalk.red('Creation failed'));
            console.error(chalk.red(`\nError: ${(error as Error).message}`));
            process.exit(1);
        }
    });

/**
 * Clone from an existing skill
 */
async function cloneFromSkill(
    sourceName: string,
    targetPath: string,
    newName: string,
    spinner: ReturnType<typeof ora>
): Promise<void> {
    spinner.start(`Finding skill ${sourceName}...`);

    const skill = findSkill(sourceName);
    if (!skill) {
        spinner.fail(chalk.red(`Skill not found: ${sourceName}`));
        console.log(chalk.dim('Run `killer list` to see installed skills'));
        process.exit(1);
    }

    const sourceDir = path.dirname(skill.path);
    spinner.text = `Cloning ${sourceName} to ${newName}...`;

    // Copy entire directory
    await fs.copy(sourceDir, targetPath);

    // Update SKILL.md with new name
    const skillMdPath = path.join(targetPath, 'SKILL.md');
    if (await fs.pathExists(skillMdPath)) {
        let content = await fs.readFile(skillMdPath, 'utf-8');
        content = content.replace(
            /^name:\s*.+$/m,
            `name: ${newName}`
        );
        content = content.replace(
            new RegExp(`# ${escapeRegExp(sourceName)}`, 'gi'),
            `# ${toTitleCase(newName)}`
        );
        await fs.writeFile(skillMdPath, content);
    }

    spinner.succeed(chalk.green(`Cloned ${sourceName} to ${newName}`));

    console.log('');
    console.log(chalk.green('✅ Skill cloned successfully!'));
    console.log(chalk.dim('─'.repeat(50)));
    console.log(`  ${chalk.bold('Source:')} ${sourceName} (${sourceDir})`);
    console.log(`  ${chalk.bold('Target:')} ${newName} (${targetPath})`);
    console.log(chalk.dim('─'.repeat(50)));
    console.log('');
    console.log(chalk.dim('💡 Don\'t forget to update the skill description and content!'));
}

/**
 * Prompt user for input
 */
async function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

/**
 * Convert name to title case
 */
function toTitleCase(str: string): string {
    return str
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Escape special regex characters
 */
function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
