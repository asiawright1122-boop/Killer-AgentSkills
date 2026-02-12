/**
 * Login Command
 * 
 * Authenticate with GitHub using Device Flow OAuth.
 * This enables `killer search` and other GitHub-dependent features.
 * 
 * Usage:
 *   killer login           - Start GitHub Device Flow login
 *   killer login --status  - Check current auth status
 *   killer login --logout  - Remove saved token
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { resolveGitHubToken, requestDeviceCode, pollForToken, saveGitHubToken } from '../utils/github-auth.js';

export const loginCommand = new Command('login')
    .description('Authenticate with GitHub for enhanced features (search, etc.)')
    .option('--status', 'Check current authentication status')
    .option('--logout', 'Remove saved GitHub token')
    .action(async (options: { status?: boolean; logout?: boolean }) => {
        try {
            // Check status
            if (options.status) {
                const token = await resolveGitHubToken();
                if (token) {
                    console.log(chalk.green('✅ Authenticated with GitHub'));
                    console.log(chalk.dim(`   Token: ***${token.slice(-4)}`));

                    // Validate token
                    const spinner = ora('Verifying token...').start();
                    try {
                        const response = await fetch('https://api.github.com/user', {
                            headers: { 'Authorization': `token ${token}`, 'User-Agent': 'killer-skills-cli' }
                        });
                        if (response.ok) {
                            const user = await response.json() as { login: string };
                            spinner.succeed(chalk.green(`Logged in as ${chalk.bold(user.login)}`));
                        } else {
                            spinner.warn(chalk.yellow('Token exists but may be expired'));
                        }
                    } catch {
                        spinner.warn(chalk.yellow('Could not verify token'));
                    }
                } else {
                    console.log(chalk.yellow('❌ Not authenticated with GitHub'));
                    console.log(chalk.dim('   Run: killer login'));
                }
                return;
            }

            // Logout
            if (options.logout) {
                await saveGitHubToken('');
                console.log(chalk.green('✅ GitHub token removed'));
                return;
            }

            // Check if already authenticated
            const existingToken = await resolveGitHubToken();
            if (existingToken) {
                console.log(chalk.green('✅ Already authenticated with GitHub'));
                console.log(chalk.dim('   Use --logout to sign out first'));
                return;
            }

            // Start Device Flow
            console.log(chalk.bold('\n🔐 GitHub Authentication\n'));
            console.log(chalk.dim('This enables skill search and other GitHub features.\n'));

            const spinner = ora('Requesting authorization...').start();

            let deviceData;
            try {
                deviceData = await requestDeviceCode();
            } catch (error) {
                spinner.fail(chalk.red('Failed to start Device Flow'));
                console.error(chalk.red(`Error: ${(error as Error).message}`));
                console.log(chalk.dim('\nAlternative: Set token manually:'));
                console.log(chalk.cyan('  killer config githubToken <your-github-pat>'));
                return;
            }
            spinner.stop();

            // Display instructions
            console.log(chalk.bold('Step 1:') + ` Open this URL in your browser:\n`);
            console.log(chalk.cyan.bold(`  ${deviceData.verification_uri}\n`));
            console.log(chalk.bold('Step 2:') + ` Enter this code:\n`);
            console.log(chalk.bgWhite.black.bold(`  ${deviceData.user_code}  \n`));

            // Try to open browser automatically
            try {
                const { execSync } = await import('child_process');
                const platform = process.platform;
                if (platform === 'darwin') {
                    execSync(`open "${deviceData.verification_uri}"`, { stdio: 'pipe' });
                } else if (platform === 'linux') {
                    execSync(`xdg-open "${deviceData.verification_uri}"`, { stdio: 'pipe' });
                } else if (platform === 'win32') {
                    execSync(`start "${deviceData.verification_uri}"`, { stdio: 'pipe' });
                }
                console.log(chalk.dim('  (Browser opened automatically)\n'));
            } catch {
                // Browser didn't open, user will need to open manually
            }

            // Poll for token
            const pollSpinner = ora('Waiting for authorization...').start();
            try {
                const token = await pollForToken(deviceData.device_code, deviceData.interval);

                // Save token
                await saveGitHubToken(token);
                pollSpinner.succeed(chalk.green('✅ Successfully authenticated with GitHub!'));

                console.log(chalk.dim('\n💡 You can now use:'));
                console.log(chalk.dim('   killer search <query>  - Search for skills'));
                console.log(chalk.dim('   killer login --status  - Check auth status'));
                console.log(chalk.dim('   killer login --logout  - Sign out'));
            } catch (error) {
                pollSpinner.fail(chalk.red(`Authentication failed: ${(error as Error).message}`));
                console.log(chalk.dim('\nAlternative: Set token manually:'));
                console.log(chalk.cyan('  killer config githubToken <your-github-pat>'));
            }

        } catch (error) {
            console.error(chalk.red(`Error: ${(error as Error).message}`));
            process.exit(1);
        }
    });
