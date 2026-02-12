
import * as fs from 'fs';

// --- Improved Repair Logic Start ---

function sanitizeJsonString(str: string): string {
    // 1. Remove markdown code blocks
    str = str.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();

    // 2. Remove JS comments (// and /* */)
    str = str.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');

    // 3. Fix trailing commas (common AI error) in objects and arrays
    str = str.replace(/,(\s*[}\]])/g, '$1');

    return str.trim();
}

function repairTruncatedJSON(jsonString: string): string {
    let repaired = jsonString.trim();

    // Auto-close open braces/brackets based on stack
    const stack: string[] = [];
    let inString = false;
    let escaped = false;

    for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (!inString) {
            if (char === '{') stack.push('}');
            else if (char === '[') stack.push(']');
            else if (char === '}' || char === ']') {
                if (stack.length > 0 && stack[stack.length - 1] === char) {
                    stack.pop();
                }
            }
        }
    }

    // Close any open strings first
    if (inString) repaired += '"';

    // Close remaining structures
    while (stack.length > 0) {
        repaired += stack.pop();
    }

    return repaired;
}

function aggressiveJSONRepair(jsonString: string): string {
    let repaired = jsonString;

    // Fix: Mixed Object/Array structure (e.g. "key": "val", "val2"])
    // This happens when AI thinks it's writing a list but acts like an object key
    // Regex: look for "key": "val", "val2"] -> "key": "val" (drop the extra item)
    // We use a non-greedy match for the value string to not overreach.
    // The value string is assumed to be quoted.
    repaired = repaired.replace(/:\s*("[^"]*")\s*,\s*"[^"]*"\s*\]/g, ': $1');

    return repaired;
}

function parseJSON(jsonString: string): any {
    let parsed: any;
    let err1_msg = '';
    let err2_msg = '';

    // 1. Sanitize
    let cleanString = sanitizeJsonString(jsonString);

    // 2. Strict Parse
    try {
        // Try strict parse first
        return JSON.parse(cleanString);
    } catch (e1) {
        err1_msg = (e1 as Error).message;

        // 3. Loose Parse (eval)
        try {
            // eslint-disable-next-line no-new-func
            return (new Function(`return ${cleanString}`))();
        } catch (e2) {
            err2_msg = (e2 as Error).message;

            // 4. Try Repair Truncated
            try {
                const repaired = repairTruncatedJSON(cleanString);
                // eslint-disable-next-line no-new-func
                return (new Function(`return ${repaired}`))();
            } catch (e3) {
                // 5. Try Aggressive Fixes + Loose Parse as last resort for specific known issues
                try {
                    const aggressive = aggressiveJSONRepair(cleanString);
                    // eslint-disable-next-line no-new-func
                    return (new Function(`return ${aggressive}`))();
                } catch (e4) {
                    throw new Error(`All methods failed.\nStrict: ${err1_msg}\nLoose: ${err2_msg}\nRepair: ${(e3 as Error).message}\nAggressive: ${(e4 as Error).message}`);
                }
            }
        }
    }
}

// --- Test Cases ---

const testCases = [
    {
        name: "Trailing comma",
        input: `{
            "description": { "en": "test" },
            "features": { "en": ["a", "b"], },
        }`,
        shouldPass: true
    },
    {
        name: "Markdown block",
        input: "```json\n" + `{ "key": "value" }` + "\n```",
        shouldPass: true
    },
    {
        name: "Truncated",
        input: `{ "description": { "en": "trunc...`,
        shouldPass: true
    },
    {
        name: "Case 1: User reported 'create-skill-file' issue",
        input: `{
          "description": {
            "en": "desc",
            "zh": "desc_zh"
          },
          "definition": {
            "en": "def", 
            h: ["val1", "val2"],
            "zh": "def_zh"
          }
        }`,
        shouldPass: true
    },
    {
        name: "Case 2: User reported 'finishing-a-development-branch' issue",
        // Expect mixed object/array repair to work
        input: `{
            "description": {
                "en": "Streamline your development workflow with Finishing a Development Branch", "streamlined development workflow"],
                "zh": ["测试"]
            }
        }`,
        shouldPass: true // Now SHOULD pass with aggressive repair
    }
];

async function runTests() {
    console.log("Running JSON Repair Tests...\n");

    for (const test of testCases) {
        console.log(`Test: ${test.name}`);
        try {
            const result = parseJSON(test.input);
            console.log("✅ Passed");
            // console.log("Result:", JSON.stringify(result, null, 2));
        } catch (e) {
            if (test.shouldPass) {
                console.error("❌ Failed (Should have passed)");
                console.error((e as Error).message);
            } else {
                console.log("✅ Failed (Expected)");
                console.log("   Error:", (e as Error).message.split('\n')[0]);
            }
        }
        console.log("-".repeat(20));
    }
}

runTests();
