/**
 * GitHub Authentication Utility
 * 
 * Provides seamless GitHub token resolution with multiple strategies:
 * 1. Environment variable: GITHUB_TOKEN
 * 2. Config file: ~/.killer-skills/config.json → githubToken
 * 3. Auto-detect `gh` CLI token (zero config)
 * 
 * Login strategies (ordered by seamlessness):
 * 1. `gh auth login` — official GitHub CLI (most reliable, most seamless)
 * 2. Device Flow OAuth — for users without `gh` CLI
 * 3. Manual PAT — ultimate fallback
 */

import { execSync } from 'child_process';
import https from 'https';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.killer-skills');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * GitHub Device Flow Client ID
 * Register at: https://github.com/settings/applications/new
 * Make sure to enable "Device Flow" in the OAuth App settings
 */
const GITHUB_CLIENT_ID = 'Ov23li6qTIoqN6PqN9Xt';

/**
 * Resolve GitHub token with fallback chain:
 * 1. Environment variable: GITHUB_TOKEN
 * 2. Config file: ~/.killer-skills/config.json → githubToken
 * 3. gh CLI: `gh auth token`
 */
export async function resolveGitHubToken(): Promise<string | null> {
    // Strategy 1: Environment variable (highest priority)
    if (process.env.GITHUB_TOKEN) {
        return process.env.GITHUB_TOKEN;
    }

    // Strategy 2: Config file
    try {
        if (await fs.pathExists(CONFIG_FILE)) {
            const config = await fs.readJson(CONFIG_FILE);
            if (config.githubToken) {
                return config.githubToken;
            }
        }
    } catch {
        // Ignore config errors
    }

    // Strategy 3: gh CLI auto-detect
    try {
        const token = execSync('gh auth token 2>/dev/null', {
            encoding: 'utf-8',
            timeout: 3000,
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();

        if (token && token.length > 0) {
            return token;
        }
    } catch {
        // gh CLI not installed or not authenticated
    }

    return null;
}

/**
 * Check if `gh` CLI is installed
 */
export function isGhCliInstalled(): boolean {
    try {
        execSync('gh --version 2>/dev/null', {
            encoding: 'utf-8',
            timeout: 3000,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if `gh` CLI is authenticated
 */
export function isGhCliAuthenticated(): boolean {
    try {
        const result = execSync('gh auth status 2>&1', {
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        return result.includes('Logged in');
    } catch {
        return false;
    }
}

/**
 * Run `gh auth login` interactively
 * Returns true if login succeeded
 */
export async function runGhAuthLogin(): Promise<boolean> {
    try {
        // Use spawnSync for interactive process
        const { spawnSync } = await import('child_process');
        const result = spawnSync('gh', ['auth', 'login', '--web', '-p', 'https'], {
            stdio: 'inherit',
            timeout: 120000, // 2 minutes
        });
        return result.status === 0;
    } catch {
        return false;
    }
}

/**
 * Save GitHub token to config file
 */
export async function saveGitHubToken(token: string): Promise<void> {
    await fs.ensureDir(CONFIG_DIR);

    let config: Record<string, unknown> = {};
    try {
        if (await fs.pathExists(CONFIG_FILE)) {
            config = await fs.readJson(CONFIG_FILE);
        }
    } catch {
        // Start fresh
    }

    config.githubToken = token;
    await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
}

/**
 * GitHub Device Flow OAuth
 * 
 * Step 1: Request device code
 * Step 2: User opens browser to authorize
 * Step 3: Poll for access token
 */

interface DeviceCodeResponse {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
}

interface TokenResponse {
    access_token?: string;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
}

/**
 * Start Device Flow — request device code from GitHub
 */
export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            scope: 'public_repo'
        });

        const options: https.RequestOptions = {
            hostname: 'github.com',
            path: '/login/device/code',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) {
                        reject(new Error(`GitHub error: ${parsed.error_description || parsed.error}`));
                    } else {
                        resolve(parsed as DeviceCodeResponse);
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${(e as Error).message}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

/**
 * Poll GitHub for access token (Device Flow step 3)
 */
export async function pollForToken(deviceCode: string, interval: number): Promise<string> {
    const poll = (): Promise<TokenResponse> => {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                device_code: deviceCode,
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
            });

            const options: https.RequestOptions = {
                hostname: 'github.com',
                path: '/login/oauth/access_token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data) as TokenResponse);
                    } catch (e) {
                        reject(new Error(`Parse error: ${(e as Error).message}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    };

    // Poll loop
    const maxAttempts = 60; // ~5 minutes with 5s interval
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, interval * 1000));

        const response = await poll();

        if (response.access_token) {
            return response.access_token;
        }

        if (response.error === 'authorization_pending') {
            continue; // Keep polling
        }

        if (response.error === 'slow_down') {
            interval += 5; // Back off
            continue;
        }

        if (response.error === 'expired_token') {
            throw new Error('Authorization timed out. Please try again.');
        }

        if (response.error === 'access_denied') {
            throw new Error('Authorization denied by user.');
        }

        throw new Error(`Unexpected error: ${response.error_description || response.error}`);
    }

    throw new Error('Authorization timed out after too many attempts.');
}
