/**
 * Do Command - Natural Language Executor
 * 
 * Execute tasks using natural language. Automatically matches
 * the task description to available skills and suggests/executes them.
 * 
 * Example:
 *   killer do "处理这个 PDF 文件"
 *   killer do "create algorithmic art"
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { findAllSkills } from '../utils/skills.js';
import { readFileSync } from 'fs';
import { select, confirm } from '@inquirer/prompts';
import { execSync } from 'child_process';

interface SkillMatch {
    name: string;
    description: string;
    path: string;
    score: number;
    matchedKeywords: string[];
}

export const doCommand = new Command('do')
    .argument('<task>', 'Task description in natural language')
    .description('Execute a task using natural language (auto-matches skills)')
    .option('-y, --yes', 'Auto-execute best matching skill without confirmation')
    .option('-l, --list', 'List matched skills without executing')
    .option('-n, --top <number>', 'Number of top matches to show', '5')
    .action(async (task: string, options: {
        yes?: boolean;
        list?: boolean;
        top?: string;
    }) => {
        const spinner = ora('Analyzing task...').start();

        try {
            // Find all installed skills
            const skills = findAllSkills();

            if (skills.length === 0) {
                spinner.fail(chalk.red('No skills installed'));
                console.log(chalk.dim('\nInstall skills first:'));
                console.log(chalk.cyan('  killer install <skill-name>'));
                process.exit(1);
            }

            // Match task to skills
            spinner.text = 'Matching skills...';
            const matches = matchTaskToSkills(task, skills);
            const topN = parseInt(options.top || '5');
            const topMatches = matches.slice(0, topN);

            spinner.stop();

            if (topMatches.length === 0 || topMatches[0].score === 0) {
                console.log(chalk.yellow('\n⚠️ No matching skills found for:'));
                console.log(chalk.dim(`   "${task}"`));
                console.log(chalk.dim('\n💡 Try installing more skills:'));
                console.log(chalk.cyan('   killer search <query>'));
                return;
            }

            // Display matches
            console.log(chalk.bold(`\n🎯 Task: "${task}"\n`));
            console.log(chalk.dim('Matching skills (by relevance):'));
            console.log(chalk.dim('─'.repeat(60)));

            topMatches.forEach((match, index) => {
                const rank = index === 0 ? chalk.green('★') : chalk.dim('○');
                const scoreBar = renderScoreBar(match.score);
                console.log(`  ${rank} ${chalk.bold(match.name)} ${scoreBar}`);
                console.log(chalk.dim(`    ${match.description.slice(0, 60)}${match.description.length > 60 ? '...' : ''}`));
                if (match.matchedKeywords.length > 0) {
                    console.log(chalk.dim(`    Keywords: ${match.matchedKeywords.join(', ')}`));
                }
                console.log('');
            });

            // List mode - don't execute
            if (options.list) {
                console.log(chalk.dim('─'.repeat(60)));
                console.log(chalk.dim(`Found ${matches.filter(m => m.score > 0).length} matching skill(s)`));
                return;
            }

            // Determine which skill to use
            let selectedSkill: SkillMatch;

            if (options.yes) {
                // Auto-select best match
                selectedSkill = topMatches[0];
                console.log(chalk.green(`\n✓ Auto-selected: ${selectedSkill.name}`));
            } else if (topMatches.length === 1) {
                // Only one match
                const proceed = await confirm({
                    message: `Use ${topMatches[0].name} for this task?`,
                    default: true
                });
                if (!proceed) {
                    console.log(chalk.yellow('Cancelled'));
                    return;
                }
                selectedSkill = topMatches[0];
            } else {
                // Let user choose
                const choices = topMatches.map(m => ({
                    name: `${m.name} - ${m.description.slice(0, 40)}...`,
                    value: m
                }));

                selectedSkill = await select({
                    message: 'Select skill to use:',
                    choices
                });
            }

            // Execute the skill
            console.log(chalk.dim('\n─'.repeat(60)));
            console.log(chalk.bold(`\n📖 Loading skill: ${selectedSkill.name}\n`));

            // Read skill content
            const content = readFileSync(selectedSkill.path, 'utf-8');

            // Output skill content (like `killer read`)
            console.log(chalk.dim('─'.repeat(60)));
            console.log(content);
            console.log(chalk.dim('─'.repeat(60)));

            // Provide context
            console.log(chalk.green(`\n✅ Skill "${selectedSkill.name}" loaded!`));
            console.log(chalk.dim('\n💡 The skill instructions above can help you complete:'));
            console.log(chalk.cyan(`   "${task}"`));
            console.log(chalk.dim('\nFollow the skill\'s instructions to complete your task.'));

        } catch (error) {
            if ((error as Error).name === 'ExitPromptError') {
                console.log(chalk.yellow('\n\nCancelled'));
                process.exit(0);
            }
            spinner.fail(chalk.red('Failed to execute task'));
            console.error(chalk.red(`\nError: ${(error as Error).message}`));
            process.exit(1);
        }
    });

/**
 * Match task description to available skills
 */
function matchTaskToSkills(task: string, skills: Array<{ name: string; description: string; path: string }>): SkillMatch[] {
    const taskLower = task.toLowerCase();
    const taskWords = extractKeywords(taskLower);

    const matches: SkillMatch[] = skills.map(skill => {
        const nameLower = skill.name.toLowerCase();
        const descLower = (skill.description || '').toLowerCase();
        const skillWords = extractKeywords(`${nameLower} ${descLower}`);

        let score = 0;
        const matchedKeywords: string[] = [];

        // Exact name match (highest priority)
        if (taskLower.includes(nameLower)) {
            score += 50;
            matchedKeywords.push(skill.name);
        }

        // Word matching
        for (const taskWord of taskWords) {
            if (nameLower.includes(taskWord)) {
                score += 20;
                matchedKeywords.push(taskWord);
            }
            if (descLower.includes(taskWord)) {
                score += 10;
                if (!matchedKeywords.includes(taskWord)) {
                    matchedKeywords.push(taskWord);
                }
            }
            // Partial word match
            for (const skillWord of skillWords) {
                if (skillWord.includes(taskWord) || taskWord.includes(skillWord)) {
                    if (skillWord !== taskWord) {
                        score += 5;
                    }
                }
            }
        }

        // Semantic matching for common terms
        const semanticMatches: Record<string, string[]> = {
            'pdf': ['document', 'file', 'convert', 'extract', '文档', '文件', 'pdf'],
            'excel': ['spreadsheet', 'xlsx', 'csv', 'data', '表格', '电子表格'],
            'word': ['document', 'docx', '.doc', '文档', '文字'],
            'ppt': ['presentation', 'slide', 'pptx', '演示', '幻灯片'],
            'art': ['creative', 'design', 'generate', 'draw', '艺术', '创作', '设计'],
            'code': ['programming', 'developer', 'software', '代码', '编程'],
            'test': ['testing', 'test', 'qa', 'quality', '测试'],
            'ui': ['interface', 'ux', 'design', 'frontend', '界面', '设计'],
            'api': ['backend', 'server', 'rest', 'graphql', '接口'],
        };

        for (const [key, synonyms] of Object.entries(semanticMatches)) {
            const keyInName = nameLower.includes(key);
            const keyInDesc = descLower.includes(key);
            const taskHasSynonym = synonyms.some(s => taskLower.includes(s));

            if ((keyInName || keyInDesc) && taskHasSynonym) {
                score += 15;
                matchedKeywords.push(key);
            }
        }

        return {
            name: skill.name,
            description: skill.description || 'No description',
            path: skill.path,
            score,
            matchedKeywords: [...new Set(matchedKeywords)]
        };
    });

    // Sort by score (descending)
    return matches.sort((a, b) => b.score - a.score);
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
    // Remove common stop words
    const stopWords = new Set([
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
        'this', 'that', 'these', 'those', 'it', 'its',
        'for', 'with', 'from', 'to', 'of', 'in', 'on', 'at', 'by',
        'and', 'or', 'but', 'if', 'then', 'else',
        'can', 'could', 'would', 'should', 'will',
        'me', 'my', 'i', 'you', 'your', 'we', 'our', 'they', 'their',
        '的', '是', '在', '和', '与', '或', '这', '那', '一个', '我', '你', '他', '她',
        'help', 'please', 'want', 'need', '帮', '请', '要', '需要'
    ]);

    return text
        .split(/[\s,.\-_:;!?'"()[\]{}]+/)
        .filter(word => word.length >= 2 && !stopWords.has(word));
}

/**
 * Render a score bar
 */
function renderScoreBar(score: number): string {
    const maxBars = 5;
    const normalized = Math.min(score / 50, 1); // Normalize to 0-1
    const bars = Math.round(normalized * maxBars);
    const filled = '█'.repeat(bars);
    const empty = '░'.repeat(maxBars - bars);
    const color = bars >= 4 ? chalk.green : bars >= 2 ? chalk.yellow : chalk.red;
    return color(`[${filled}${empty}]`);
}
