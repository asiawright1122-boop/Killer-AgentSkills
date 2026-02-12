/**
 * GitHub Authentication Utility
 * 
 * Provides seamless GitHub token resolution with 3 strategies:
 * 1. Auto-detect `gh` CLI token (zero config)
 * 2. Device Flow OAuth (`killer login`)
 * 3. Config/env variable fallback
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
 * For now, use a public OAuth App client ID
 */
const GITHUB_CLIENT_ID = 'Ov23liY8xWLJwKpGJmQk';

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

        if (token && token.startsWith('gh')) {
            return token;
        }
    } catch {
        // gh CLI not installed or not authenticated
    }

    return null;
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
