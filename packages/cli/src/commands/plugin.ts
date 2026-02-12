/**
 * Plugin Command
 * 
 * Manage CLI plugins - install, list, remove.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadPlugins, installPlugin, uninstallPlugin } from '../utils/plugins.js';

export const pluginCommand = new Command('plugin')
    .description('Manage CLI plugins')
    .argument('[action]', 'Action: list, add, remove')
    .argument('[source]', 'Plugin source or name')
    .action(async (action: string | undefined, source: string | undefined) => {
        const spinner = ora();

        try {
            // Default to list
            if (!action || action === 'list') {
                spinner.start('Loading plugins...');
                const plugins = await loadPlugins();
                spinner.stop();

                console.log(chalk.bold('\n🔌 Installed Plugins\n'));
                console.log(chalk.dim('─'.repeat(50)));

                if (plugins.length === 0) {
                    console.log(chalk.dim('  No plugins installed'));
                    console.log(chalk.dim('\n  Install a plugin:'));
                    console.log(chalk.cyan('    killer plugin add ./my-plugin'));
                } else {
                    for (const plugin of plugins) {
                        const typeIcon = getTypeIcon(plugin.type);
                        console.log(`  ${typeIcon} ${chalk.bold(plugin.name)} v${plugin.version}`);
                        console.log(chalk.dim(`    ${plugin.description}`));
                        console.log(chalk.dim(`    Type: ${plugin.type}`));
                        console.log('');
                    }
                }

                console.log(chalk.dim('─'.repeat(50)));
                return;
            }

            // Install plugin
            if (action === 'add' || action === 'install') {
                if (!source) {
                    console.log(chalk.red('Please specify a plugin source'));
                    console.log(chalk.dim('Example: killer plugin add ./my-plugin'));
                    process.exit(1);
                }

                spinner.start(`Installing plugin from ${source}...`);
                const result = await installPlugin(source);

                if (result.success) {
                    spinner.succeed(chalk.green(result.message));
                } else {
                    spinner.fail(chalk.red(result.message));
                    process.exit(1);
                }
                return;
            }

            // Remove plugin
            if (action === 'remove' || action === 'uninstall') {
                if (!source) {
                    console.log(chalk.red('Please specify a plugin name'));
                    console.log(chalk.dim('Example: killer plugin remove my-plugin'));
                    process.exit(1);
                }

                spinner.start(`Removing plugin ${source}...`);
                const result = await uninstallPlugin(source);

                if (result.success) {
                    spinner.succeed(chalk.green(result.message));
                } else {
                    spinner.fail(chalk.red(result.message));
                    process.exit(1);
                }
                return;
            }

            // Unknown action
            console.log(chalk.yellow(`Unknown action: ${action}`));
            console.log(chalk.dim('Available actions: list, add, remove'));

        } catch (error) {
            spinner.fail(chalk.red('Plugin operation failed'));
            console.error(chalk.red(`\nError: ${(error as Error).message}`));
            process.exit(1);
        }
    });

/**
 * Get icon for plugin type
 */
function getTypeIcon(type: string): string {
    switch (type) {
        case 'command': return '⚡';
        case 'ide-adapter': return '🖥️';
        case 'hook': return '🪝';
        default: return '📦';
    }
}
