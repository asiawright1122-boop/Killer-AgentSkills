// src/config/ides.ts
// Complete configuration for all 17+ supported AI coding tools

import path from 'path';
import os from 'os';

const homedir = os.homedir();

export interface IDEConfig {
    name: string;
    format: 'SKILL.md' | 'instructions.md' | 'rules.md' | 'agent.json' | 'mcp.json';
    paths: {
        global: string | null;
        project: string;
    };
    mcpConfigPath?: string;
    detectFiles: string[];
    priority: number;
    requiresConversion?: boolean;
    category: 'editor' | 'cli' | 'agent' | 'extension';
}

export const IDE_CONFIG: Record<string, IDEConfig> = {
    // === EDITORS ===
    cursor: {
        name: 'Cursor',
        format: 'SKILL.md',
        paths: {
            global: path.join(homedir, '.cursor', 'skills'),
            project: '.cursor/skills'
        },
        mcpConfigPath: path.join(homedir, '.cursor', 'mcp.json'),
        detectFiles: ['.cursor', '.cursorrules'],
        priority: 1,
        category: 'editor'
    },
    windsurf: {
        name: 'Windsurf',
        format: 'rules.md',
        paths: {
            global: null,
            project: '.windsurf/rules'
        },
        detectFiles: ['.windsurf', '.windsurfrules'],
        priority: 2,
        requiresConversion: true,
        category: 'editor'
    },
    vscode: {
        name: 'VS Code + Copilot',
        format: 'instructions.md',
        paths: {
            global: null,
            project: '.github/instructions'
        },
        detectFiles: ['.vscode', '.github'],
        priority: 3,
        requiresConversion: true,
        category: 'editor'
    },
    trae: {
        name: 'Trae',
        format: 'SKILL.md',
        paths: {
            global: path.join(homedir, '.trae', 'skills'),
            project: '.trae/skills'
        },
        detectFiles: ['.trae'],
        priority: 4,
        category: 'editor'
    },

    // === CLI AGENTS ===
    claude: {
        name: 'Claude Code',
        format: 'SKILL.md',
        paths: {
            global: path.join(homedir, '.claude', 'skills'),
            project: '.claude/skills'
        },
        mcpConfigPath: path.join(homedir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
        detectFiles: ['.claude'],
        priority: 5,
        category: 'cli'
    },
    antigravity: {
        name: 'Antigravity (Gemini)',
        format: 'SKILL.md',
        paths: {
            global: path.join(homedir, '.gemini', 'antigravity', 'skills'),
            project: '.agent/skills'
        },
        detectFiles: ['.agent', '.gemini'],
        priority: 6,
        category: 'cli'
    },
    aider: {
        name: 'Aider',
        format: 'SKILL.md',
        paths: {
            global: path.join(homedir, '.aider', 'skills'),
            project: '.aider/skills'
        },
        detectFiles: ['.aider'],
        priority: 7,
        category: 'cli'
    },
    codex: {
        name: 'OpenAI Codex CLI',
        format: 'SKILL.md',
        paths: {
            global: path.join(homedir, '.codex', 'skills'),
            project: '.codex/skills'
        },
        detectFiles: ['.codex'],
        priority: 8,
        category: 'cli'
    },

    // === AGENTS ===
    goose: {
        name: 'Goose (Block)',
        format: 'SKILL.md',
        paths: {
            global: path.join(homedir, '.goose', 'skills'),
            project: '.goose/skills'
        },
        detectFiles: ['.goose'],
        priority: 9,
        category: 'agent'
    },
    cline: {
        name: 'Cline',
        format: 'SKILL.md',
        paths: {
            global: path.join(homedir, '.cline', 'skills'),
            project: '.cline/skills'
        },
        detectFiles: ['.cline'],
        priority: 10,
        category: 'agent'
    },
    roo: {
        name: 'Roo Cline',
        format: 'SKILL.md',
        paths: {
            global: path.join(homedir, '.roo', 'skills'),
            project: '.roo/skills'
        },
        detectFiles: ['.roo'],
        priority: 11,
        category: 'agent'
    },
    kiro: {
        name: 'Kiro (AWS)',
        format: 'agent.json',
        paths: {
            global: path.join(homedir, '.kiro', 'agents'),
            project: '.kiro/agents'
        },
        detectFiles: ['.kiro'],
        priority: 12,
        requiresConversion: true,
        category: 'agent'
    },
    augment: {
        name: 'Augment Code',
        format: 'SKILL.md',
        paths: {
            global: path.join(homedir, '.augment', 'skills'),
            project: '.augment/skills'
        },
        detectFiles: ['.augment'],
        priority: 13,
        category: 'agent'
    },

    // === VS CODE EXTENSIONS ===
    continue: {
        name: 'Continue',
        format: 'SKILL.md',
        paths: {
            global: path.join(homedir, '.continue', 'skills'),
            project: '.continue/skills'
        },
        detectFiles: ['.continue'],
        priority: 14,
        category: 'extension'
    },
    copilot: {
        name: 'GitHub Copilot',
        format: 'instructions.md',
        paths: {
            global: null,
            project: '.github/copilot-instructions.md'
        },
        detectFiles: ['.github'],
        priority: 15,
        requiresConversion: true,
        category: 'extension'
    },
    cody: {
        name: 'Sourcegraph Cody',
        format: 'SKILL.md',
        paths: {
            global: path.join(homedir, '.cody', 'skills'),
            project: '.cody/skills'
        },
        detectFiles: ['.cody'],
        priority: 16,
        category: 'extension'
    },
    amazonq: {
        name: 'Amazon Q Developer',
        format: 'SKILL.md',
        paths: {
            global: path.join(homedir, '.amazonq', 'skills'),
            project: '.amazonq/skills'
        },
        detectFiles: ['.amazonq'],
        priority: 17,
        category: 'extension'
    }
};

export const SUPPORTED_IDES = Object.keys(IDE_CONFIG);
export const SUPPORTED_IDE_COUNT = SUPPORTED_IDES.length;

// Get IDEs by category
export function getIDEsByCategory(category: IDEConfig['category']): string[] {
    return SUPPORTED_IDES.filter(key => IDE_CONFIG[key].category === category);
}

// Get IDE install path
export function getInstallPath(ide: string, scope: 'project' | 'global', skillName: string, cwd?: string): string {
    const config = IDE_CONFIG[ide];
    if (!config) throw new Error(`Unknown IDE: ${ide}`);

    if (scope === 'global' && config.paths.global) {
        return path.join(config.paths.global, skillName);
    }
    return path.join(cwd || process.cwd(), config.paths.project, skillName);
}
