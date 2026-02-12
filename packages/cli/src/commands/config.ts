/**
 * Config Command
 * 
 * Manage CLI configuration settings.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.killer-skills');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface Config {
    defaultIDE: string;
    defaultScope: 'project' | 'global';
    githubToken?: string;
    registryUrl: string;
    autoSync: boolean;
}

const DEFAULT_CONFIG: Config = {
    defaultIDE: 'claude',
    defaultScope: 'global',
    registryUrl: 'https://raw.githubusercontent.com/anthropics/killer-skills/main/registry/skills.json',
    autoSync: false
};

export const configCommand = new Command('config')
    .description('Manage CLI configuration')
    .argument('[key]', 'Configuration key to get/set')
    .argument('[value]', 'Value to set')
    .option('--list', 'List all configuration values')
    .option('--reset', 'Reset configuration to defaults')
    .option('--path', 'Show configuration file path')
    .action(async (key: string | undefined, value: string | undefined, options: {
        list?: boolean;
        reset?: boolean;
        path?: boolean;
    }) => {
        try {
            // Ensure config directory exists
            await fs.ensureDir(CONFIG_DIR);

            // Show path
            if (options.path) {
                console.log(CONFIG_FILE);
                return;
            }

            // Reset config
            if (options.reset) {
                await fs.writeJson(CONFIG_FILE, DEFAULT_CONFIG, { spaces: 2 });
                console.log(chalk.green('✅ Configuration reset to defaults'));
                return;
            }

            // Load current config
            let config: Config;
            if (await fs.pathExists(CONFIG_FILE)) {
                config = { ...DEFAULT_CONFIG, ...await fs.readJson(CONFIG_FILE) };
            } else {
                config = { ...DEFAULT_CONFIG };
            }

            // List all
            if (options.list || (!key && !value)) {
                console.log(chalk.bold('\n⚙️  Killer-Skills Configuration\n'));
                console.log(chalk.dim('─'.repeat(50)));

                const displayConfig: Record<string, string> = {
                    'defaultIDE': config.defaultIDE,
                    'defaultScope': config.defaultScope,
                    'registryUrl': config.registryUrl,
                    'autoSync': String(config.autoSync),
                    'githubToken': config.githubToken ? '***' + config.githubToken.slice(-4) : '(not set)'
                };

                for (const [k, v] of Object.entries(displayConfig)) {
                    console.log(`  ${chalk.cyan(k.padEnd(15))} ${v}`);
                }

                console.log(chalk.dim('─'.repeat(50)));
                console.log(chalk.dim(`\nConfig file: ${CONFIG_FILE}`));
                console.log(chalk.dim('\nUsage:'));
                console.log(chalk.dim('  killer config <key> <value>  Set a value'));
                console.log(chalk.dim('  killer config <key>          Get a value'));
                console.log(chalk.dim('  killer config --reset        Reset to defaults'));
                return;
            }

            // Get value
            if (key && !value) {
                const configValue = (config as unknown as Record<string, unknown>)[key];
                if (configValue === undefined) {
                    console.log(chalk.yellow(`Unknown config key: ${key}`));
                    console.log(chalk.dim(`Available keys: ${Object.keys(DEFAULT_CONFIG).join(', ')}`));
                } else {
                    if (key === 'githubToken' && configValue) {
                        console.log('***' + String(configValue).slice(-4));
                    } else {
                        console.log(String(configValue));
                    }
                }
                return;
            }

            // Set value
            if (key && value) {
                if (!(key in DEFAULT_CONFIG)) {
                    console.log(chalk.yellow(`Unknown config key: ${key}`));
                    console.log(chalk.dim(`Available keys: ${Object.keys(DEFAULT_CONFIG).join(', ')}`));
                    return;
                }

                // Type conversion
                let typedValue: unknown = value;
                if (value === 'true') typedValue = true;
                else if (value === 'false') typedValue = false;

                (config as unknown as Record<string, unknown>)[key] = typedValue;
                await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });

                console.log(chalk.green(`✅ Set ${key} = ${value}`));
            }

        } catch (error) {
            console.error(chalk.red(`Error: ${(error as Error).message}`));
            process.exit(1);
        }
    });

/**
 * Load configuration
 */
export async function loadConfig(): Promise<Config> {
    try {
        if (await fs.pathExists(CONFIG_FILE)) {
            return { ...DEFAULT_CONFIG, ...await fs.readJson(CONFIG_FILE) };
        }
    } catch {
        // Ignore errors
    }
    return { ...DEFAULT_CONFIG };
}

/**
 * Get a specific config value
 */
export async function getConfigValue<K extends keyof Config>(key: K): Promise<Config[K]> {
    const config = await loadConfig();
    return config[key];
}
