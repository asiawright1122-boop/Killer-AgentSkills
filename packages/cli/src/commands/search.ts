/**
 * Search Command
 * 
 * Search for skills on GitHub and the registry.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { searchSkillsOnGitHub } from '../utils/github.js';
import { searchSkills as searchRegistry } from '../registry.js';

interface SearchResult {
    name: string;
    description: string;
    source: 'github' | 'registry';
    repo?: string;
    url?: string;
}

export const searchCommand = new Command('search')
    .argument('<query>', 'Search query')
    .description('Search for skills on GitHub and registry')
    .option('-s, --source <source>', 'Search source: all, github, registry', 'all')
    .option('-l, --limit <number>', 'Maximum results per source', '10')
    .action(async (query: string, options: { source: string; limit: string }) => {
        const spinner = ora(`Searching for "${query}"...`).start();

        try {
            const results: SearchResult[] = [];
            const limit = parseInt(options.limit) || 10;

            // Search registry
            if (options.source === 'all' || options.source === 'registry') {
                spinner.text = 'Searching registry...';
                const registryResults = await searchRegistry(query);

                for (const skill of registryResults.slice(0, limit)) {
                    results.push({
                        name: skill.name,
                        description: skill.description || 'No description',
                        source: 'registry',
                        repo: skill.repo
                    });
                }
            }

            // Search GitHub
            if (options.source === 'all' || options.source === 'github') {
                spinner.text = 'Searching GitHub...';
                const githubResults = await searchSkillsOnGitHub(query, limit);

                for (const item of githubResults as Array<{ repository?: { full_name?: string; html_url?: string; description?: string } }>) {
                    if (item.repository) {
                        // Avoid duplicates
                        const repoName = item.repository.full_name || '';
                        if (!results.some(r => r.repo === repoName)) {
                            results.push({
                                name: repoName.split('/').pop() || repoName,
                                description: item.repository.description || 'No description',
                                source: 'github',
                                repo: repoName,
                                url: item.repository.html_url
                            });
                        }
                    }
                }
            }

            spinner.stop();

            if (results.length === 0) {
                console.log(chalk.yellow(`\nNo skills found for "${query}"`));

                // Check if user has GitHub auth — guide them if not
                const { resolveGitHubToken } = await import('../utils/github-auth.js');
                const token = await resolveGitHubToken();

                console.log(chalk.dim('\n💡 Tips:'));
                console.log(chalk.dim('   • Try a broader search term'));
                if (!token) {
                    console.log(chalk.dim('   • ' + chalk.yellow('Login to GitHub for better results:')));
                    console.log(chalk.cyan('     killer login'));
                }
                console.log(chalk.dim('   • Search GitHub directly: killer search <query> -s github'));
                return;
            }

            // Display results
            console.log(chalk.bold(`\n🔍 Found ${results.length} skill(s) for "${query}"\n`));

            // Group by source
            const registryResults = results.filter(r => r.source === 'registry');
            const githubResults = results.filter(r => r.source === 'github');

            if (registryResults.length > 0) {
                console.log(chalk.blue.bold('Registry Skills'));
                console.log(chalk.dim('─'.repeat(50)));
                for (const result of registryResults) {
                    console.log(`  ${chalk.cyan('•')} ${chalk.bold(result.name)}`);
                    console.log(chalk.dim(`    ${truncate(result.description, 60)}`));
                    if (result.repo) {
                        console.log(chalk.dim(`    Install: killer install ${result.name}`));
                    }
                    console.log('');
                }
            }

            if (githubResults.length > 0) {
                console.log(chalk.dim.bold('GitHub Skills'));
                console.log(chalk.dim('─'.repeat(50)));
                for (const result of githubResults) {
                    console.log(`  ${chalk.gray('•')} ${chalk.bold(result.name)}`);
                    console.log(chalk.dim(`    ${truncate(result.description, 60)}`));
                    if (result.repo) {
                        console.log(chalk.dim(`    Install: killer install ${result.repo}`));
                    }
                    console.log('');
                }
            }

            console.log(chalk.dim('─'.repeat(50)));
            console.log(chalk.dim(`Total: ${registryResults.length} registry, ${githubResults.length} github`));

        } catch (error) {
            spinner.fail(chalk.red('Search failed'));
            console.error(chalk.red(`\nError: ${(error as Error).message}`));
            process.exit(1);
        }
    });

function truncate(str: string, length: number): string {
    if (str.length <= length) return str;
    return str.slice(0, length - 3) + '...';
}
