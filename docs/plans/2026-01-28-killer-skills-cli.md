# Killer-Skills CLI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI tool that installs Agent Skills to the correct location and auto-configures IDE integration (Cursor, Claude Desktop) for zero-friction usage.

**Architecture:**
- **CLI Framework**: Node.js + Commander.js for cross-platform compatibility.
- **Skill Registry**: JSON file hosted on GitHub (or local cache) containing skill metadata.
- **Output Locations**:
  - Skills Mode: `~/.agent/skills/<skill-name>/SKILL.md` (Anthropic Skills auto-discovery format).
  - MCP Mode: Modify `~/.cursor/mcp.json` or Claude Desktop config.

**Tech Stack:** Node.js, TypeScript, Commander.js, fs-extra, chalk (styling), ora (spinners).

---

## Task 1: Project Setup

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/index.ts`

**Step 1: Initialize Package**
```bash
mkdir -p packages/cli
cd packages/cli
npm init -y
```

**Step 2: Install Dependencies**
```bash
npm install commander chalk ora fs-extra
npm install -D typescript @types/node @types/fs-extra tsx
```

**Step 3: Create tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

**Step 4: Create Entry Point (src/index.ts)**
```typescript
#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('killer')
  .description('Killer-Skills CLI - Install and manage Agent Skills')
  .version('0.1.0');

program.parse();
```

**Step 5: Add bin to package.json**
```json
{
  "bin": {
    "killer": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts"
  }
}
```

**Step 6: Verify Setup**
```bash
npm run build
node dist/index.js --help
# Expected: Shows "Killer-Skills CLI - Install and manage Agent Skills"
```

**Step 7: Commit**
```bash
git add packages/cli
git commit -m "feat(cli): initialize CLI project with Commander.js"
```

---

## Task 2: Implement `killer install <skill>` Command

**Files:**
- Create: `packages/cli/src/commands/install.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Create Install Command**
```typescript
// src/commands/install.ts
import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';

const SKILLS_DIR = path.join(process.env.HOME || '~', '.agent', 'skills');

export const installCommand = new Command('install')
  .argument('<skill>', 'Name of the skill to install')
  .description('Install a skill to ~/.agent/skills/')
  .action(async (skillName: string) => {
    const spinner = ora(`Installing ${skillName}...`).start();

    try {
      const skillPath = path.join(SKILLS_DIR, skillName);
      await fs.ensureDir(skillPath);

      // Placeholder: Download skill from registry
      const skillContent = `---
name: ${skillName}
description: Installed via Killer-Skills CLI
---

# ${skillName}

This skill was installed by Killer-Skills.
`;
      await fs.writeFile(path.join(skillPath, 'SKILL.md'), skillContent);

      spinner.succeed(chalk.green(`Installed ${skillName} to ${skillPath}`));
    } catch (error) {
      spinner.fail(chalk.red(`Failed to install ${skillName}`));
      console.error(error);
    }
  });
```

**Step 2: Register Command in index.ts**
```typescript
import { installCommand } from './commands/install.js';
program.addCommand(installCommand);
```

**Step 3: Test Install**
```bash
npm run build
node dist/index.js install test-skill
# Expected: "Installed test-skill to ~/.agent/skills/test-skill"
ls ~/.agent/skills/test-skill/SKILL.md
# Expected: File exists
```

**Step 4: Commit**
```bash
git add packages/cli
git commit -m "feat(cli): add install command"
```

---

## Task 3: Implement `killer list` Command

**Files:**
- Create: `packages/cli/src/commands/list.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Create List Command**
```typescript
// src/commands/list.ts
import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

const SKILLS_DIR = path.join(process.env.HOME || '~', '.agent', 'skills');

export const listCommand = new Command('list')
  .description('List installed skills')
  .action(async () => {
    try {
      const exists = await fs.pathExists(SKILLS_DIR);
      if (!exists) {
        console.log(chalk.yellow('No skills installed yet.'));
        return;
      }

      const skills = await fs.readdir(SKILLS_DIR);
      if (skills.length === 0) {
        console.log(chalk.yellow('No skills installed yet.'));
        return;
      }

      console.log(chalk.bold('Installed Skills:'));
      skills.forEach((skill) => {
        console.log(`  - ${skill}`);
      });
    } catch (error) {
      console.error(chalk.red('Failed to list skills'), error);
    }
  });
```

**Step 2: Register Command**
```typescript
import { listCommand } from './commands/list.js';
program.addCommand(listCommand);
```

**Step 3: Test List**
```bash
npm run build
node dist/index.js list
# Expected: Shows "test-skill" if installed
```

**Step 4: Commit**
```bash
git add packages/cli
git commit -m "feat(cli): add list command"
```

---

## Task 4: Implement IDE Auto-Configuration (Cursor)

**Files:**
- Create: `packages/cli/src/config/cursor.ts`
- Modify: `packages/cli/src/commands/install.ts`

**Step 1: Create Cursor Config Helper**
```typescript
// src/config/cursor.ts
import fs from 'fs-extra';
import path from 'path';

const CURSOR_CONFIG_PATH = path.join(process.env.HOME || '~', '.cursor', 'mcp.json');

export async function addToCursorConfig(skillName: string, command: string) {
  let config: Record<string, unknown> = { mcpServers: {} };

  if (await fs.pathExists(CURSOR_CONFIG_PATH)) {
    const content = await fs.readFile(CURSOR_CONFIG_PATH, 'utf-8');
    config = JSON.parse(content);
  }

  const servers = (config.mcpServers as Record<string, unknown>) || {};
  servers[skillName] = { command, args: [] };
  config.mcpServers = servers;

  await fs.ensureDir(path.dirname(CURSOR_CONFIG_PATH));
  await fs.writeFile(CURSOR_CONFIG_PATH, JSON.stringify(config, null, 2));
}
```

**Step 2: Integrate into Install Command**
After successful skill installation, call:
```typescript
import { addToCursorConfig } from '../config/cursor.js';

// Inside action, after writing SKILL.md:
await addToCursorConfig(skillName, `npx killer-skills run ${skillName}`);
spinner.succeed(chalk.green(`Installed ${skillName} and configured Cursor.`));
```

**Step 3: Test Configuration**
```bash
npm run build
node dist/index.js install pdf-reader
cat ~/.cursor/mcp.json
# Expected: {"mcpServers":{"pdf-reader":{"command":"npx killer-skills run pdf-reader","args":[]}}}
```

**Step 4: Commit**
```bash
git add packages/cli
git commit -m "feat(cli): auto-configure Cursor MCP on install"
```

---

## Task 5: Implement IDE Auto-Configuration (Claude Desktop)

**Files:**
- Create: `packages/cli/src/config/claude.ts`

**Step 1: Create Claude Config Helper**
```typescript
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

export async function addToClaudeConfig(skillName: string, command: string) {
  let config: Record<string, unknown> = { mcpServers: {} };

  if (await fs.pathExists(CLAUDE_CONFIG_PATH)) {
    const content = await fs.readFile(CLAUDE_CONFIG_PATH, 'utf-8');
    config = JSON.parse(content);
  }

  const servers = (config.mcpServers as Record<string, unknown>) || {};
  servers[skillName] = { command, args: [] };
  config.mcpServers = servers;

  await fs.ensureDir(path.dirname(CLAUDE_CONFIG_PATH));
  await fs.writeFile(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2));
}
```

**Step 2: Add to Install Command**
```typescript
import { addToClaudeConfig } from '../config/claude.js';

// After Cursor config:
await addToClaudeConfig(skillName, `npx killer-skills run ${skillName}`);
```

**Step 3: Commit**
```bash
git add packages/cli
git commit -m "feat(cli): auto-configure Claude Desktop on install"
```

---

## Task 6: Connect to Skill Registry (API)

**Files:**
- Create: `packages/cli/src/registry.ts`
- Modify: `packages/cli/src/commands/install.ts`

**Step 1: Create Registry Fetcher**
```typescript
// src/registry.ts
const REGISTRY_URL = 'https://raw.githubusercontent.com/killer-skills/registry/main/skills.json';

export interface SkillMeta {
  name: string;
  repo: string;
  description: string;
}

export async function fetchSkillMeta(skillName: string): Promise<SkillMeta | null> {
  const res = await fetch(REGISTRY_URL);
  const registry = await res.json() as SkillMeta[];
  return registry.find((s) => s.name === skillName) || null;
}
```

**Step 2: Update Install to Use Registry**
```typescript
import { fetchSkillMeta } from '../registry.js';

// In action:
const meta = await fetchSkillMeta(skillName);
if (!meta) {
  spinner.fail(chalk.red(`Skill "${skillName}" not found in registry.`));
  return;
}
// Clone repo or download files...
```

**Step 3: Commit**
```bash
git add packages/cli
git commit -m "feat(cli): connect to skill registry API"
```

---

## Verification Plan

### Automated Tests
```bash
npm run build
node dist/index.js install planning-workflow
node dist/index.js list
cat ~/.cursor/mcp.json
```

### Manual Verification
1. Open Cursor, check MCP settings, verify skill appears.
2. Ask Cursor "帮我规划..." and observe if it invokes the skill.
