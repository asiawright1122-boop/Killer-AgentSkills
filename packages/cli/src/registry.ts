// src/registry.ts
const REGISTRY_URL = 'https://raw.githubusercontent.com/killer-skills/registry/main/skills.json';

export interface SkillMeta {
    name: string;
    repo: string;
    description: string;
}

export async function fetchSkillMeta(skillName: string): Promise<SkillMeta | null> {
    try {
        const res = await fetch(REGISTRY_URL);
        if (!res.ok) {
            console.warn(`Registry not available: ${res.status}`);
            return null;
        }
        const registry = await res.json() as SkillMeta[];
        return registry.find((s) => s.name === skillName) || null;
    } catch (error) {
        // Registry might not exist or network issue
        return null;
    }
}

export async function searchSkills(query: string): Promise<SkillMeta[]> {
    try {
        const res = await fetch(REGISTRY_URL);
        if (!res.ok) {
            return [];
        }
        const registry = await res.json() as SkillMeta[];
        const lowerQuery = query.toLowerCase();
        return registry.filter((s) =>
            s.name.toLowerCase().includes(lowerQuery) ||
            s.description.toLowerCase().includes(lowerQuery)
        );
    } catch {
        return [];
    }
}
