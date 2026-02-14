
import { describe, it, expect } from 'vitest';
import {
    generateCursorPrompt,
    generateWindsurfPrompt,
    generateKiroPrompt,
    generateCopilotPrompt
} from '../../src/utils/prompt-templates.js';

const mockSkills = [
    { name: 'test-skill', description: 'A test skill', location: 'project', path: '/path/to/skill/SKILL.md' },
    { name: 'another-skill', description: 'Another skill', location: 'global', path: '/path/to/another/SKILL.md' }
] as any[];

describe('Prompt Generation Logic', () => {

    it('Cursor prompt should include universal instructions', () => {
        const output = generateCursorPrompt(mockSkills);
        expect(output).toContain('killer list');
        expect(output).toContain('killer search');
        expect(output).toContain('killer read <tool-name>');
    });

    it('Windsurf prompt should include universal instructions', () => {
        const output = generateWindsurfPrompt(mockSkills);
        expect(output).toContain('killer list');
        expect(output).toContain('killer search');
    });

    it('Copilot prompt should include universal instructions', () => {
        const output = generateCopilotPrompt(mockSkills);
        expect(output).toContain('killer list');
        expect(output).toContain('killer search');
    });

    it('Kiro prompt should be valid JSON and include instructions', () => {
        const output = generateKiroPrompt(mockSkills);

        // Extract JSON block
        const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/);
        expect(jsonMatch).not.toBeNull();

        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[1]);
            expect(data.instructions).toBeDefined();
            expect(data.instructions).toContain('killer list');
            expect(data.instructions).toContain('killer search');
            expect(data.skills).toHaveLength(2);
            expect(data.skills[0].invoke).toBe('killer read test-skill');
        }
    });

});
