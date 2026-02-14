/**
 * Login Command
 * 
 * Authenticate with GitHub using the most seamless method available.
 * Prioritizes `gh` CLI for zero-friction login, with Device Flow and
 * manual PAT as fallbacks.
 * 
 * Usage:
 *   killer login           - Start GitHub login (auto-selects best method)
 *   killer login --status  - Check current auth status
 *   killer login --logout  - Remove saved token
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import {
    resolveGitHubToken,
    requestDeviceCode,
    pollForToken,
    saveGitHubToken,
    isGhCliInstalled,
    isGhCliAuthenticated,
    runGhAuthLogin
} from '../utils/github-auth.js';

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

            // ====== Multi-Strategy Login ======
            console.log(chalk.bold('\n🔐 GitHub Authentication\n'));

            // === Strategy 1: gh CLI (most seamless) ===
            const ghInstalled = isGhCliInstalled();

            if (ghInstalled) {
                // gh is installed, check if already authenticated
                if (isGhCliAuthenticated()) {
                    // gh is authenticated, token will be auto-detected on next resolveGitHubToken call
                    console.log(chalk.green('✅ Detected existing GitHub CLI authentication!'));
                    console.log(chalk.dim('   Your gh CLI token will be used automatically.'));
                    console.log(chalk.dim('   No additional setup needed.\n'));
                    return;
                }

                // gh is installed but not authenticated — guide user through gh auth login
                console.log(chalk.cyan('📦 GitHub CLI detected! Using it for seamless authentication.\n'));
                console.log(chalk.dim('Launching GitHub CLI login...\n'));

                const success = await runGhAuthLogin();
                if (success) {
                    console.log(chalk.green('\n✅ Successfully authenticated via GitHub CLI!'));
                    console.log(chalk.dim('   Token is managed by gh CLI — no manual steps needed.\n'));
                    console.log(chalk.dim('💡 You can now use:'));
                    console.log(chalk.dim('   killer search <query>  - Search for skills'));
                    console.log(chalk.dim('   killer login --status  - Check auth status'));
                    return;
                }

                // gh auth login failed, fall through to other methods
                console.log(chalk.yellow('\n⚠ GitHub CLI login was cancelled or failed.'));
                console.log(chalk.dim('   Trying alternative methods...\n'));
            }

            // === Strategy 2: Device Flow OAuth ===
            console.log(chalk.dim('Using Device Flow authentication...\n'));

            const spinner = ora('Requesting authorization...').start();

            let deviceData;
            try {
                deviceData = await requestDeviceCode();
            } catch (error) {
                spinner.fail(chalk.yellow('Device Flow not available'));

                // === Strategy 3: Manual PAT (ultimate fallback) ===
                printManualTokenGuide(ghInstalled);
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

                // Fall through to manual token guide
                printManualTokenGuide(ghInstalled);
            }

        } catch (error) {
            console.error(chalk.red(`Error: ${(error as Error).message}`));
            process.exit(1);
        }
    });


/**
 * Print a friendly guide for manual token setup
 */
function printManualTokenGuide(ghInstalled: boolean) {
    console.log(chalk.bold('\n📋 Alternative: Set up GitHub token manually\n'));

    if (!ghInstalled) {
        console.log(chalk.cyan.bold('  Option A: Install GitHub CLI (Recommended)\n'));
        const platform = process.platform;
        if (platform === 'darwin') {
            console.log(chalk.dim('    brew install gh'));
        } else if (platform === 'linux') {
            console.log(chalk.dim('    sudo apt install gh   # Debian/Ubuntu'));
            console.log(chalk.dim('    sudo dnf install gh   # Fedora'));
        } else {
            console.log(chalk.dim('    winget install GitHub.cli'));
        }
        console.log(chalk.dim('    gh auth login'));
        console.log(chalk.dim('    killer login            # Token auto-detected!\n'));
    }

    console.log(chalk.cyan.bold(`  ${ghInstalled ? 'Option A' : 'Option B'}: Personal Access Token\n`));
    console.log(chalk.dim('    1. Visit: https://github.com/settings/tokens'));
    console.log(chalk.dim('    2. Generate a token (classic) with "public_repo" scope'));
    console.log(chalk.dim('    3. Run:'));
    console.log(chalk.white('       killer config githubToken <your-token>\n'));
}
