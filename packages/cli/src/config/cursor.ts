// src/config/cursor.ts
import fs from 'fs-extra';
import path from 'path';

const CURSOR_CONFIG_PATH = path.join(process.env.HOME || '~', '.cursor', 'mcp.json');

interface MCPConfig {
    mcpServers: Record<string, { command: string; args: string[] }>;
}

export async function addToCursorConfig(skillName: string, command: string): Promise<void> {
    let config: MCPConfig = { mcpServers: {} };

    if (await fs.pathExists(CURSOR_CONFIG_PATH)) {
        const content = await fs.readFile(CURSOR_CONFIG_PATH, 'utf-8');
        config = JSON.parse(content) as MCPConfig;
    }

    if (!config.mcpServers) {
        config.mcpServers = {};
    }

    config.mcpServers[skillName] = { command, args: [] };

    await fs.ensureDir(path.dirname(CURSOR_CONFIG_PATH));
    await fs.writeFile(CURSOR_CONFIG_PATH, JSON.stringify(config, null, 2));
}
