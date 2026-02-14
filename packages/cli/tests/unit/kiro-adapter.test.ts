
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { injectSkill } from '../../src/utils/adapters.js';

const TEST_DIR = path.join(os.tmpdir(), `kiro-test-${Date.now()}`);

describe('Kiro Adapter Logic', () => {

    beforeAll(async () => {
        await fs.ensureDir(TEST_DIR);
    });

    afterAll(async () => {
        await fs.remove(TEST_DIR);
    });

    it('should create agent.json instead of [skill].json', async () => {
        const skillName = 'test-skill';
        const skillDir = path.join(TEST_DIR, 'source', skillName);
        const targetDir = path.join(TEST_DIR, '.kiro/agents', skillName);

        // Create mock skill
        await fs.ensureDir(skillDir);
        await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Test Skill');

        // Run injection
        await injectSkill('kiro', skillName, skillDir, targetDir);

        // Verify file existence
        const agentFile = path.join(targetDir, 'agent.json');
        const oldFile = path.join(targetDir, `${skillName}.json`);

        expect(fs.existsSync(agentFile)).toBe(true);
        expect(fs.existsSync(oldFile)).toBe(false);

        // Verify content
        const content = await fs.readJson(agentFile);
        expect(content.name).toBe(skillName);
        expect(content.instructions).toContain('killer list');
        expect(content.instructions).toContain('killer search');
    });
});
