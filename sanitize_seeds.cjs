const fs = require('fs');
const path = require('path');

const SEEDS_DIR = path.join(__dirname, 'db', 'seeds');

function processSqlFiles() {
    const files = fs.readdirSync(SEEDS_DIR).filter(file => file.endsWith('.sql'));

    for (const file of files) {
        const filePath = path.join(SEEDS_DIR, file);
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        // Regex to find INSERT INTO skills statements and extract the JSON payload
        // The data_json is the last argument. We use a more robust regex that looks for the start of the VALUES clause.
        const regex = /(INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+"?skills"?\s*\([^)]+\)\s*VALUES\s*\([^)]+,\s*)('(?:[^']|'')*')(\s*\);)/gi;

        content = content.replace(regex, (match, prefix, jsonStr, suffix) => {
            try {
                // The JSON is likely escaped. We need to un-escape single quotes if they are doubled
                // Remove the wrapping single quotes first
                const innerStr = jsonStr.slice(1, -1);
                const rawJson = innerStr.replace(/''/g, "'");
                const data = JSON.parse(rawJson);

                let changedJson = false;

                // Deep remove 'Workers AI' or 'AI' related features/text
                const processObject = (obj) => {
                    if (!obj || typeof obj !== 'object') return;

                    for (const key in obj) {
                        if (typeof obj[key] === 'string') {
                            if (obj[key].includes('Workers AI') || obj[key].includes('env.AI')) {
                                obj[key] = obj[key].replace(/Cloudflare Workers AI/g, 'Siliconflow')
                                    .replace(/Workers AI/g, 'Siliconflow')
                                    .replace(/self\.env\.AI\.run\([^)]+\)/g, 'fetch("https://api.siliconflow.cn/v1/chat/completions", {...})');
                                changedJson = true;
                            }
                        } else if (Array.isArray(obj[key])) {
                            const originalLength = obj[key].length;
                            // Remove tags specifically related to 'AI' (if it meant Workers AI) or 'Cloudflare AI'
                            obj[key] = obj[key].filter(item => {
                                if (typeof item === 'string' && (item === 'Cloudflare AI' || item === 'Workers AI')) {
                                    changedJson = true;
                                    return false; // Remove it
                                }
                                return true;
                            });

                            // Process remaining array items
                            obj[key].forEach(processObject);
                        } else if (typeof obj[key] === 'object') {
                            processObject(obj[key]);
                        }
                    }
                };

                processObject(data);

                if (changedJson) {
                    modified = true;
                    console.log(`Updated JSON payload in ${file}`);
                    // Re-escape single quotes for SQL
                    const newJsonStr = JSON.stringify(data).replace(/'/g, "''");
                    return `${prefix}'${newJsonStr}'${suffix}`;
                }
            } catch (e) {
                console.error(`Failed to parse JSON in ${file}:`, e.message);
                // Continue with original match if parsing fails
            }
            return match;
        });

        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Saved changes to ${file}`);
        }
    }
}

processSqlFiles();
