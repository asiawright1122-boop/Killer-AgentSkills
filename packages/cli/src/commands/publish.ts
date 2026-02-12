/**
 * Publish Command
 * 
 * Publish a skill to the Killer-Skills registry or prepare for GitHub publication.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

interface SkillMeta {
    name: string;
    description: string;
    version?: string;
    author?: string;
    tags?: string[];
    repo?: string;
}

export const publishCommand = new Command('publish')
    .argument('[path]', 'Path to skill directory', '.')
    .description('Publish a skill to GitHub or prepare for registry')
    .option('--dry-run', 'Validate without publishing')
    .option('--github', 'Initialize as GitHub repository')
    .option('-m, --message <msg>', 'Commit message', 'Initial skill commit')
    .action(async (skillPath: string, options: {
        dryRun?: boolean;
        github?: boolean;
        message?: string;
    }) => {
        const spinner = ora('Validating skill...').start();

        try {
            const absolutePath = path.resolve(skillPath);

            // Validate skill structure
            const skillMdPath = path.join(absolutePath, 'SKILL.md');
            if (!await fs.pathExists(skillMdPath)) {
                spinner.fail(chalk.red('No SKILL.md found'));
                console.log(chalk.dim(`\nExpected: ${skillMdPath}`));
                console.log(chalk.dim('Create a skill first: killer create <name>'));
                process.exit(1);
            }

            // Parse SKILL.md
            const content = await fs.readFile(skillMdPath, 'utf-8');
            const meta = parseSkillMeta(content);

            if (!meta.name) {
                spinner.fail(chalk.red('SKILL.md missing required "name" field'));
                process.exit(1);
            }

            if (!meta.description) {
                spinner.fail(chalk.red('SKILL.md missing required "description" field'));
                process.exit(1);
            }

            spinner.succeed('Skill validated');

            // Display skill info
            console.log('');
            console.log(chalk.bold('📦 Skill Information'));
            console.log(chalk.dim('─'.repeat(50)));
            console.log(`  ${chalk.bold('Name:')}        ${meta.name}`);
            console.log(`  ${chalk.bold('Description:')} ${meta.description}`);
            if (meta.version) console.log(`  ${chalk.bold('Version:')}     ${meta.version}`);
            if (meta.author) console.log(`  ${chalk.bold('Author:')}      ${meta.author}`);
            if (meta.tags?.length) console.log(`  ${chalk.bold('Tags:')}        ${meta.tags.join(', ')}`);
            console.log(`  ${chalk.bold('Path:')}        ${absolutePath}`);
            console.log(chalk.dim('─'.repeat(50)));

            // Validate structure
            spinner.start('Checking skill structure...');
            const issues: string[] = [];
            const warnings: string[] = [];

            // Check for common directories
            const hasScripts = await fs.pathExists(path.join(absolutePath, 'scripts'));
            const hasReferences = await fs.pathExists(path.join(absolutePath, 'references'));
            const hasExamples = await fs.pathExists(path.join(absolutePath, 'examples'));
            const hasAssets = await fs.pathExists(path.join(absolutePath, 'assets'));

            // Check content quality
            if (content.length < 200) {
                warnings.push('SKILL.md content seems short (< 200 chars)');
            }

            if (!content.includes('## ')) {
                warnings.push('SKILL.md has no sections (## headers)');
            }

            spinner.succeed('Structure validated');

            if (warnings.length > 0) {
                console.log(chalk.yellow('\n⚠️  Warnings:'));
                warnings.forEach(w => console.log(chalk.yellow(`   • ${w}`)));
            }

            if (issues.length > 0) {
                console.log(chalk.red('\n❌ Issues:'));
                issues.forEach(i => console.log(chalk.red(`   • ${i}`)));
                process.exit(1);
            }

            // Show structure summary
            console.log(chalk.dim('\n📁 Structure:'));
            console.log(chalk.dim(`   SKILL.md      ✓`));
            console.log(chalk.dim(`   scripts/      ${hasScripts ? '✓' : '○'}`));
            console.log(chalk.dim(`   references/   ${hasReferences ? '✓' : '○'}`));
            console.log(chalk.dim(`   examples/     ${hasExamples ? '✓' : '○'}`));
            console.log(chalk.dim(`   assets/       ${hasAssets ? '✓' : '○'}`));

            // Dry run stops here
            if (options.dryRun) {
                console.log(chalk.green('\n✅ Dry run complete. Skill is ready to publish.'));
                return;
            }

            // GitHub initialization
            if (options.github) {
                spinner.start('Initializing GitHub repository...');

                const gitDir = path.join(absolutePath, '.git');
                const isGitRepo = await fs.pathExists(gitDir);

                if (!isGitRepo) {
                    execSync('git init', { cwd: absolutePath, stdio: 'pipe' });
                }

                // Create .gitignore if not exists
                const gitignorePath = path.join(absolutePath, '.gitignore');
                if (!await fs.pathExists(gitignorePath)) {
                    await fs.writeFile(gitignorePath, `# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp

# Dependencies
node_modules/
`);
                }

                // Create README if not exists
                const readmePath = path.join(absolutePath, 'README.md');
                if (!await fs.pathExists(readmePath)) {
                    await fs.writeFile(readmePath, `# ${meta.name}

${meta.description}

## Installation

\`\`\`bash
npx killer-skills install ${meta.name}
\`\`\`

## Usage

See [SKILL.md](./SKILL.md) for detailed instructions.

## License

MIT
`);
                }

                // Add and commit
                try {
                    execSync('git add -A', { cwd: absolutePath, stdio: 'pipe' });
                    execSync(`git commit -m "${options.message}"`, { cwd: absolutePath, stdio: 'pipe' });
                } catch {
                    // Already committed or nothing to commit
                }

                spinner.succeed('GitHub repository initialized');

                console.log(chalk.green('\n✅ Ready for GitHub!'));
                console.log(chalk.dim('\nNext steps:'));
                console.log(chalk.cyan(`  1. Create a new repo on GitHub: ${meta.name}`));
                console.log(chalk.cyan('  2. Add remote: git remote add origin <your-repo-url>'));
                console.log(chalk.cyan('  3. Push: git push -u origin main'));
                console.log(chalk.dim('\nThen users can install with:'));
                console.log(chalk.cyan(`  killer install <your-username>/${meta.name}`));
            } else {
                // Registry publication info
                console.log(chalk.green('\n✅ Skill is ready to publish!'));
                console.log(chalk.dim('\nTo publish to GitHub:'));
                console.log(chalk.cyan(`  killer publish ${skillPath} --github`));
                console.log(chalk.dim('\nTo submit to the official registry:'));
                console.log(chalk.cyan('  Visit: https://github.com/your-org/killer-skills/issues/new'));
            }

        } catch (error) {
            spinner.fail(chalk.red('Publish failed'));
            console.error(chalk.red(`\nError: ${(error as Error).message}`));
            process.exit(1);
        }
    });

/**
 * Parse SKILL.md frontmatter
 */
function parseSkillMeta(content: string): SkillMeta {
    const meta: SkillMeta = { name: '', description: '' };

    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return meta;

    const frontmatter = frontmatterMatch[1];

    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    if (nameMatch) meta.name = nameMatch[1].trim().replace(/^["']|["']$/g, '');

    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (descMatch) meta.description = descMatch[1].trim().replace(/^["']|["']$/g, '');

    const versionMatch = frontmatter.match(/^version:\s*(.+)$/m);
    if (versionMatch) meta.version = versionMatch[1].trim();

    const authorMatch = frontmatter.match(/^author:\s*(.+)$/m);
    if (authorMatch) meta.author = authorMatch[1].trim();

    const tagsMatch = frontmatter.match(/^tags:\s*\[(.+)\]$/m);
    if (tagsMatch) {
        meta.tags = tagsMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, ''));
    }

    return meta;
}
