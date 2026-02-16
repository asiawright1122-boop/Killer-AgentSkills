
// Use native fetch (Node 18+)
async function fetchRealContent() {
    const url = 'https://raw.githubusercontent.com/anthropics/skills/main/skills/algorithmic-art/SKILL.md';
    console.log(`Fetching ${url}...`);
    const res = await fetch(url);
    if (!res.ok) {
        console.error(`Failed to fetch: ${res.status} ${res.statusText}`);
        return null;
    }
    const text = await res.text();
    console.log(`Fetched ${text.length} bytes.`);
    console.log("First 50 chars:", JSON.stringify(text.slice(0, 50)));
    return text;
}

function parseSkillMd(content: string) {
    // Robust Regex: Handle \r\n, loose whitespace
    // 1. Trim start to remove potential BOM or whitespace
    content = content.trimStart();

    // 2. Regex that allows for optional whitespace around separators
    const frontmatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
        console.log("❌ Regex match failed!");
        console.log("Content start:", JSON.stringify(content.slice(0, 100)));
        return undefined;
    }

    const [, frontmatter, body] = match;
    console.log("✅ Regex match success!");
    console.log("Body length:", body.length);
    console.log("Body snippet:", JSON.stringify(body.slice(0, 100)));

    const meta: Record<string, any> = {};

    frontmatter.split('\n').forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim();
            let value = line.slice(colonIdx + 1).trim().replace(/['"]/g, '');

            if (value.startsWith('[') && value.endsWith(']')) {
                value = value.slice(1, -1);
                meta[key] = value.split(',').map((s: string) => s.trim().replace(/['"]/g, ''));
            } else {
                meta[key] = value;
            }
        }
    });

    return {
        name: meta.name || '',
        description: meta.description || '',
        version: meta.version,
        tags: meta.tags,
        bodyPreview: body.slice(0, 500).trim(),
        body: body // Return full body
    };
}

(async () => {
    const content = await fetchRealContent();
    if (content) {
        const result = parseSkillMd(content);
        if (result) {
            console.log("Pars success!");
            console.log("Parsed Name:", result.name);
            console.log("Parsed Body Length:", result.body?.length);
        } else {
            console.log("Parse failed.");
        }
    }
})();
