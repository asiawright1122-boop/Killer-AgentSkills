#!/usr/bin/env node

import { program } from 'commander';
import { addCommand } from '../src/commands/add.js';
import { removeCommand } from '../src/commands/remove.js';
import { listCommand } from '../src/commands/list.js';
import { searchCommand } from '../src/commands/search.js';
import { detectCommand } from '../src/commands/detect.js';
import { publishCommand } from '../src/commands/publish.js';
import { createCommand } from '../src/commands/create.js';

program
    .name('killer-skills')
    .description('Cross-platform CLI for installing AI agent skills')
    .version('1.0.0');

// Add skill
program
    .command('add <repo>')
    .description('Install a skill from GitHub (format: owner/repo)')
    .option('-i, --ide <ide>', 'Target IDE (claude, antigravity, cursor, vscode, windsurf, kiro)')
    .option('-s, --scope <scope>', 'Installation scope: project or global', 'project')
    .option('-p, --path <path>', 'Custom installation path')
    .action(addCommand);

// Remove skill
program
    .command('remove <name>')
    .description('Remove an installed skill')
    .option('-i, --ide <ide>', 'Target IDE')
    .option('-s, --scope <scope>', 'Installation scope: project or global', 'project')
    .action(removeCommand);

// List installed skills
program
    .command('list')
    .description('List all installed skills')
    .option('-i, --ide <ide>', 'Filter by IDE')
    .action(listCommand);

// Search skills on GitHub
program
    .command('search <query>')
    .description('Search for skills on GitHub')
    .option('-l, --limit <number>', 'Maximum results', '10')
    .action(searchCommand);

// Detect installed IDEs
program
    .command('detect')
    .description('Detect installed IDEs and show recommendations')
    .action(detectCommand);

// Publish skill to GitHub
program
    .command('publish <path>')
    .description('Publish local skill(s) to GitHub')
    .option('-o, --org <org>', 'GitHub organization (default: your personal account)')
    .option('-b, --batch', 'Publish all skills in directory')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-p, --private', 'Create private repository')
    .option('-t, --topics <topics>', 'Comma-separated topics', 'ai-skill,claude-skill')
    .action(publishCommand);

// Create new skill from template
program
    .command('create <name>')
    .description('Create a new skill from template')
    .option('-p, --path <path>', 'Output directory (default: current directory)')
    .option('-d, --description <desc>', 'Skill description')
    .option('-y, --yes', 'Skip prompts, use defaults')
    .option('--scripts', 'Include scripts directory')
    .option('--references', 'Include references directory')
    .option('--assets', 'Include assets directory')
    .option('--full', 'Include all optional directories')
    .action(createCommand);

program.parse();
