
import * as fs from 'fs';
import * as path from 'path';

const CACHE_PATH = path.join(process.cwd(), 'data/skills-cache.json');

interface LocalizedString {
    [key: string]: string;
}

interface AgentAnalysis {
    suitability: LocalizedString;
    recommendation: LocalizedString;
    useCases: Record<string, string[]>;
    limitations: Record<string, string[]>;
}

interface Skill {
    id: string;
    name: string;
    agentAnalysis?: AgentAnalysis;
}

interface CacheData {
    skills: Skill[];
}

function isEnglishHeavy(text: string): boolean {
    if (!text) return false;
    // Remove common technical terms that might be in English
    const cleaned = text.replace(/AI|Agent|API|JSON|HTTP|skills|p5\.js|GitHub|Cloudflare|KV/gi, '');
    const englishChars = cleaned.match(/[a-zA-Z]/g)?.length || 0;
    const totalChars = cleaned.length;
    return totalChars > 0 && (englishChars / totalChars) > 0.5;
}

function audit() {
    if (!fs.existsSync(CACHE_PATH)) {
        console.error("Cache file not found:", CACHE_PATH);
        return;
    }

    const data: CacheData = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
    let missingCount = 0;
    let mixedCount = 0;
    const affectedSkills = new Set<string>();

    console.log(`Auditing ${data.skills.length} skills...`);

    for (const skill of data.skills) {
        if (!skill.agentAnalysis) continue;

        const zhRec = skill.agentAnalysis.recommendation?.zh;

        // Check for missing (empty)
        if (!zhRec || zhRec.trim() === '') {
            console.log(`[MISSING] ${skill.id}: Recommendation is empty`);
            missingCount++;
            affectedSkills.add(skill.id);
        }
        // Check for mixed/English-heavy
        else if (isEnglishHeavy(zhRec)) {
            console.log(`[MIXED/ENGLISH] ${skill.id}: Recommendation seems English-heavy: "${zhRec.substring(0, 50)}..."`);
            mixedCount++;
            affectedSkills.add(skill.id);
        }
    }

    console.log("\nSummary:");
    console.log(`Total Skills: ${data.skills.length}`);
    console.log(`Missing Translations: ${missingCount}`);
    console.log(`Mixed/English Translations: ${mixedCount}`);
    console.log(`Total Affected: ${affectedSkills.size}`);

    if (affectedSkills.size > 0) {
        console.log("\nAffected Skill IDs (first 50):");
        console.log(Array.from(affectedSkills).slice(0, 50).join(','));
        console.log("\nTo regenerate these, run:");
        console.log(`npx tsx scripts/build-skills-cache.ts --filter=${Array.from(affectedSkills).slice(0, 10).map(id => id.split('/').pop()).join(',')} ... --force`);
    }
}

audit();
