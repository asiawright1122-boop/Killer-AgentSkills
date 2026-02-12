// src/config/claude.ts
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const CLAUDE_CONFIG_PATH = path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'Claude',
    'claude_desktop_config.json'
);

interface MCPConfig {
    mcpServers: Record<string, { command: string; args: string[] }>;
}

export async function addToClaudeConfig(skillName: string, command: string): Promise<void> {
    let config: MCPConfig = { mcpServers: {} };

    if (await fs.pathExists(CLAUDE_CONFIG_PATH)) {
        const content = await fs.readFile(CLAUDE_CONFIG_PATH, 'utf-8');
        config = JSON.parse(content) as MCPConfig;
    }

    if (!config.mcpServers) {
        config.mcpServers = {};
    }

    config.mcpServers[skillName] = { command, args: [] };

    await fs.ensureDir(path.dirname(CLAUDE_CONFIG_PATH));
    await fs.writeFile(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2));
}
