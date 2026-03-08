import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
interface UnifiedSkill {
    id: string;
    name?: string;
    skillName?: string;
    owner: string;
    repo: string;
    description?: string | Record<string, string>;
    category?: string;
    topics?: string[];
    stars?: number;
    source?: string;
}

// Load default .env first
dotenv.config();

// Then explicitly override with .env.local if present
const localEnv = path.join(process.cwd(), '.env.local');
if (fs.existsSync(localEnv)) {
    dotenv.config({ path: localEnv, override: true });
}

// ⚠️ IMPORTANT: We use the REST API here because this is a local Node.js script.
// In the Cloudflare Worker (src/pages/api/search.ts), we'll use env.AI bindings natively.
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    console.error('Error: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set in .env or .env.local');
    process.exit(1);
}

const CACHE_FILE = path.join(process.cwd(), 'data', 'skills-cache.json');
const EMBEDDINGS_OUTPUT_FILE = path.join(process.cwd(), 'data', 'embeddings-cache.json');
const MODEL = '@cf/baai/bge-large-en-v1.5';
const BATCH_SIZE = 50; // Cloudflare Workers AI batch limit for embeddings

// Simple UUID generator for Vector IDs
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function getEmbeddings(texts: string[]): Promise<number[][]> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${MODEL}`;

    // Retry logic is crucial for free tier rate limits
    let retries = 3;
    while (retries > 0) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CF_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: texts }),
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Cloudflare API error (${response.status}): ${errText}`);
            }

            const data = (await response.json()) as { success: boolean; errors?: unknown; result: { data?: number[][] } & Record<string, unknown> };

            if (!data.success) {
                throw new Error(`Cloudflare API error: ${JSON.stringify(data.errors)}`);
            }

            // The API returns the shape [batchSize, 1024]
            return (data.result.data || data.result) as number[][];
        } catch (error) {
            console.warn(`[getEmbeddings] Error: ${(error as Error).message}. Retries left: ${retries - 1}`);
            retries--;
            if (retries === 0) throw error;
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, (4 - retries) * 2000));
        }
    }
    throw new Error("Unreachable");
}

async function main() {
    if (!fs.existsSync(CACHE_FILE)) {
        console.error(`Cache file not found at ${CACHE_FILE}. Please run build-skills-cache first.`);
        process.exit(1);
    }

    console.log(`Loading skills from ${CACHE_FILE}...`);
    const skillsRaw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    // skills-cache.json uses: { version, lastUpdated, totalCount, skills: [...] }
    const skills: UnifiedSkill[] = Array.isArray(skillsRaw)
        ? skillsRaw
        : Array.isArray(skillsRaw.skills)
            ? skillsRaw.skills
            : Object.values(skillsRaw);

    console.log(`Loaded ${skills.length} skills. Preparing NDJSON payload for Vectorize...`);

    const vectorizeData: any[] = [];

    // We process in batches to respect the 50 texts/request limit
    for (let i = 0; i < skills.length; i += BATCH_SIZE) {
        const batch = skills.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(skills.length / BATCH_SIZE)} (Skills ${i} to ${i + batch.length - 1})...`);

        // 1. Prepare semantic payload for embedding
        const textsToEmbed = batch.map(skill => {
            // Priority components for semantic matching
            const name = skill.name || skill.skillName || skill.repo || '';
            const descEn = skill.description && typeof skill.description === 'object' ? (skill.description.en || '') : (skill.description || '');
            const category = skill.category || '';
            const topics = (skill.topics || []).join(' ');

            // We prepend the name and explicitly state features for highest accuracy
            return `Skill: ${name}. Category: ${category}. Topics: ${topics}. Description: ${descEn}`.substring(0, 1000); // Truncate cleanly
        });

        // 2. Fetch Vectors
        try {
            const vectors = await getEmbeddings(textsToEmbed);

            // 3. Assemble Vectorize Insert Payload
            for (let j = 0; j < batch.length; j++) {
                const skill = batch[j];
                // Vectorize max ID = 64 bytes. Use owner__repo slug, truncated.
                const safeId = `${skill.owner}__${skill.repo}`.replace(/[^a-zA-Z0-9_\-\.]/g, '_').slice(0, 64);

                vectorizeData.push({
                    id: safeId,
                    values: vectors[j],
                    metadata: {
                        owner: skill.owner,
                        repo: skill.repo,
                        name: skill.name || skill.skillName || skill.repo,
                        stars: skill.stars || 0,
                        category: skill.category || '',
                        source: skill.source || ''
                    }
                });
            }
        } catch (e) {
            console.error(`[FATAL] Failed to process batch ${i / BATCH_SIZE + 1}. Aborting to save state.`, e);
            break;
        }

        // Sleep to respect global rate limits (~3000 rpm, we are very safe here)
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Write out the NDJSON format required by `wrangler vectorize insert`
    console.log(`Writing embeddings to ${EMBEDDINGS_OUTPUT_FILE}...`);

    // Vectorize CLI requires NDJSON (Newline Delimited JSON) for inserts
    const ndjsonOutput = vectorizeData.map(v => JSON.stringify(v)).join('\n');
    fs.writeFileSync(EMBEDDINGS_OUTPUT_FILE, ndjsonOutput, 'utf8');

    console.log(`✅ Ready! Generated ${vectorizeData.length} vectors.`);
    console.log(`\nTo upload these to Cloudflare, run:\nnpx wrangler vectorize insert killer-skills-search --file=data/embeddings-cache.json`);
}

main().catch(console.error);
