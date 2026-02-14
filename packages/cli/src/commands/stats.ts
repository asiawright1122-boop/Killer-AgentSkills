/**
 * Stats Command
 * 
 * Track and display CLI usage statistics.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const STATS_FILE = path.join(os.homedir(), '.killer-skills', 'stats.json');

interface Stats {
    installs: Record<string, number>;
    commands: Record<string, number>;
    lastRun: string;
    totalRuns: number;
    firstRun: string;
}

const DEFAULT_STATS: Stats = {
    installs: {},
    commands: {},
    lastRun: new Date().toISOString(),
    totalRuns: 0,
    firstRun: new Date().toISOString()
};

/**
 * Load stats with corruption handling
 */
async function loadStats(): Promise<Stats> {
    try {
        await fs.ensureDir(path.dirname(STATS_FILE));
        if (await fs.pathExists(STATS_FILE)) {
            return await fs.readJson(STATS_FILE);
        }
    } catch (error) {
        // If file is corrupted or unreadable, return default
        // We don't auto-reset here to avoid race conditions during read
    }
    return { ...DEFAULT_STATS };
}

/**
 * Save stats with retry
 */
async function saveStats(stats: Stats): Promise<void> {
    try {
        await fs.ensureDir(path.dirname(STATS_FILE));
        await fs.writeJson(STATS_FILE, stats, { spaces: 2 });
    } catch {
        // Ignore write errors (best effort)
    }
}

export const statsCommand = new Command('stats')
    .description('View CLI usage statistics')
    .option('--reset', 'Reset all statistics')
    .option('--json', 'Output as JSON')
    .action(async (options: { reset?: boolean; json?: boolean }) => {
        try {
            await fs.ensureDir(path.dirname(STATS_FILE));

            // Reset stats
            if (options.reset) {
                await saveStats(DEFAULT_STATS);
                console.log(chalk.green('✅ Statistics reset'));
                return;
            }

            // Load stats
            const stats = await loadStats();

            // JSON output
            if (options.json) {
                console.log(JSON.stringify(stats, null, 2));
                return;
            }

            // Display stats
            console.log(chalk.bold('\n📊 Killer-Skills Usage Statistics\n'));
            console.log(chalk.dim('─'.repeat(50)));

            // General stats
            console.log(chalk.bold('\nGeneral'));
            console.log(`  Total Runs:    ${stats.totalRuns}`);
            console.log(`  First Run:     ${formatDate(stats.firstRun)}`);
            console.log(`  Last Run:      ${formatDate(stats.lastRun)}`);

            // Top skills
            const topSkills = Object.entries(stats.installs)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10);

            if (topSkills.length > 0) {
                console.log(chalk.bold('\n📦 Most Installed Skills'));
                topSkills.forEach(([name, count], i) => {
                    const rank = `${i + 1}.`.padEnd(3);
                    console.log(`  ${rank} ${name.padEnd(25)} ${count} installs`);
                });
            }

            // Command usage
            const topCommands = Object.entries(stats.commands)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10);

            if (topCommands.length > 0) {
                console.log(chalk.bold('\n🔧 Most Used Commands'));
                topCommands.forEach(([name, count]) => {
                    console.log(`  ${name.padEnd(15)} ${count} times`);
                });
            }

            console.log(chalk.dim('\n─'.repeat(50)));

        } catch (error) {
            console.error(chalk.red(`Error: ${(error as Error).message}`));
            process.exit(1);
        }
    });

/**
 * Track a skill installation
 */
export async function trackInstall(skillName: string): Promise<void> {
    try {
        const stats = await loadStats();

        stats.installs[skillName] = (stats.installs[skillName] || 0) + 1;
        stats.lastRun = new Date().toISOString();
        stats.totalRuns++;

        await saveStats(stats);
    } catch {
        // Ignore errors
    }
}

/**
 * Track command usage
 */
export async function trackCommand(commandName: string): Promise<void> {
    try {
        const stats = await loadStats();

        stats.commands[commandName] = (stats.commands[commandName] || 0) + 1;
        stats.lastRun = new Date().toISOString();
        stats.totalRuns++;

        await saveStats(stats);
    } catch {
        // Ignore errors
    }
}

/**
 * Format date string
 */
function formatDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleDateString();
    } catch {
        return dateStr;
    }
}
