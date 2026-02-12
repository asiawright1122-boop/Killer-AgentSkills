#!/usr/bin/env node
/**
 * Killer-Skills MCP Server
 * 
 * Exposes CLI functionality as an MCP server, allowing AI agents
 * to directly call skill management functions via MCP protocol.
 * 
 * Usage: npx killer-skills-mcp
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { findAllSkills, findSkill } from './utils/skills.js';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

// Create server
const server = new Server(
    { name: 'killer-skills', version: '1.6.0' },
    { capabilities: { tools: {}, resources: {} } }
);

// ============================================
// TOOLS
// ============================================

const TOOLS = [
    {
        name: 'list_skills',
        description: 'List all installed skills with descriptions and locations',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'read_skill',
        description: 'Read the content of a skill by name',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Name of the skill to read' }
            },
            required: ['name']
        }
    },
    {
        name: 'search_skills',
        description: 'Search for skills by keyword',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query' }
            },
            required: ['query']
        }
    },
    {
        name: 'match_task',
        description: 'Match a natural language task to the best available skill',
        inputSchema: {
            type: 'object',
            properties: {
                task: { type: 'string', description: 'Task description in natural language' }
            },
            required: ['task']
        }
    },
    {
        name: 'get_skill_info',
        description: 'Get detailed information about a skill including metadata',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Name of the skill' }
            },
            required: ['name']
        }
    },
    {
        name: 'install_skill',
        description: 'Install a new skill by name (registry) or owner/repo (GitHub)',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Skill name or GitHub repo (owner/repo)' },
                ide: { type: 'string', description: 'Target IDE (optional)' }
            },
            required: ['name']
        }
    }
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS
}));

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
        case 'list_skills': {
            const skills = findAllSkills();
            const skillList = skills.map(s => ({
                name: s.name,
                description: s.description || 'No description',
                path: s.path,
                location: s.location
            }));
            return {
                content: [{ type: 'text', text: JSON.stringify(skillList, null, 2) }]
            };
        }

        case 'read_skill': {
            const skillName = args?.name as string;
            const skill = findSkill(skillName);

            if (!skill) {
                return {
                    content: [{ type: 'text', text: `Error: Skill "${skillName}" not found.` }],
                    isError: true
                };
            }

            const content = readFileSync(skill.path, 'utf-8');
            const skillDir = path.dirname(skill.path);
            return {
                content: [{
                    type: 'text',
                    text: `# Skill: ${skillName}\n# Base Directory: ${skillDir}\n\n${content}`
                }]
            };
        }

        case 'search_skills': {
            const query = (args?.query as string || '').toLowerCase();
            const skills = findAllSkills();
            const matches = skills.filter(s =>
                s.name.toLowerCase().includes(query) ||
                (s.description || '').toLowerCase().includes(query)
            );
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        query,
                        matches: matches.map(s => ({
                            name: s.name,
                            description: s.description || 'No description'
                        }))
                    }, null, 2)
                }]
            };
        }

        case 'match_task': {
            const task = (args?.task as string || '').toLowerCase();
            const taskWords = task.split(/\s+/);
            const skills = findAllSkills();

            const matches = skills.map(skill => {
                const nameLower = skill.name.toLowerCase();
                const descLower = (skill.description || '').toLowerCase();
                let score = 0;

                if (task.includes(nameLower)) score += 50;
                for (const word of taskWords) {
                    if (word.length < 3) continue;
                    if (nameLower.includes(word)) score += 20;
                    if (descLower.includes(word)) score += 10;
                }

                return { name: skill.name, description: skill.description, score };
            })
                .filter(m => m.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        task: args?.task,
                        best_match: matches[0] || null,
                        other_matches: matches.slice(1),
                        usage: matches[0] ? `Call read_skill with name="${matches[0].name}"` : null
                    }, null, 2)
                }]
            };
        }

        case 'get_skill_info': {
            const skillName = args?.name as string;
            const skill = findSkill(skillName);

            if (!skill) {
                return {
                    content: [{ type: 'text', text: `Error: Skill "${skillName}" not found.` }],
                    isError: true
                };
            }

            const skillDir = path.dirname(skill.path);
            const structure = {
                'SKILL.md': existsSync(skill.path),
                'scripts/': existsSync(path.join(skillDir, 'scripts')),
                'references/': existsSync(path.join(skillDir, 'references')),
                'examples/': existsSync(path.join(skillDir, 'examples')),
                'assets/': existsSync(path.join(skillDir, 'assets'))
            };

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        name: skill.name,
                        description: skill.description,
                        path: skill.path,
                        directory: skillDir,
                        location: skill.location,
                        structure
                    }, null, 2)
                }]
            };
        }

        case 'install_skill': {
            const skillName = args?.name as string;
            const ide = args?.ide as string | undefined;

            // Dynamic import to avoid circular dependency issues if any
            const { installSkill } = await import('./utils/installer.js');

            const result = await installSkill(skillName, { ide });

            if (!result.success) {
                return {
                    content: [{ type: 'text', text: `Error installing skill "${skillName}": ${result.error}` }],
                    isError: true
                };
            }

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        status: 'success',
                        skill: result.skillName,
                        source: result.sourceType,
                        installed_to: result.installed,
                        message: `Skill "${result.skillName}" installed successfully to ${result.installed.join(', ')}.`
                    }, null, 2)
                }]
            };
        }

        default:
            return {
                content: [{ type: 'text', text: `Unknown tool: ${name}` }],
                isError: true
            };
    }
});

// ============================================
// RESOURCES
// ============================================

// List resources handler
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
        {
            uri: 'skills://list',
            name: 'Installed Skills',
            description: 'List of all installed skills',
            mimeType: 'application/json'
        }
    ]
}));

// Read resource handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    if (uri === 'skills://list') {
        const skills = findAllSkills();
        return {
            contents: [{
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(skills.map(s => ({
                    name: s.name,
                    description: s.description,
                    path: s.path
                })), null, 2)
            }]
        };
    }

    // Handle skills://{name} pattern
    if (uri.startsWith('skills://')) {
        const skillName = uri.replace('skills://', '');
        const skill = findSkill(skillName);

        if (skill) {
            const content = readFileSync(skill.path, 'utf-8');
            return {
                contents: [{
                    uri,
                    mimeType: 'text/markdown',
                    text: content
                }]
            };
        }
    }

    return {
        contents: [{
            uri,
            mimeType: 'text/plain',
            text: `Resource not found: ${uri}`
        }]
    };
});

// ============================================
// SERVER STARTUP
// ============================================

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Killer-Skills MCP Server running on stdio');
}

main().catch(console.error);
