import { AIService } from './scripts/lib/ai.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const ai = new AIService();
    const chunk = `# What are AI agent skills?

You open your IDE, ask the agent to "write tests for this module," and it writes something generic that misses how your project actually works. Sound familiar?

## What is an AI Agent Skill?

An **AI agent skill** is a specialized markdown file (typically named \`SKILL.md\`) that provides domain-specific instructions to coding assistants like Claude, Cursor, and Windsurf. By placing these files in your project directory, agents automatically learn your specific conventions, workflows, and rules without requiring repetitive prompting.

<Info title="What you'll learn in this guide">
* How AI agent skills actually function under the hood
* Where to place skill files for different IDEs (Claude, Cursor, Windsurf)
* The sweet spot for when skills are most effective
* How to install community skills via the CLI
* Best practices for writing your own custom skills
</Info>`;

    const targetLang = "zh";
    const prompt = `You are a professional technical translator and SEO expert. 
Translate the following Markdown content from English to ${targetLang}.

## Rules:
1. **Preserve Markdown**: Keep all headers, bullets, code blocks, links, and formatting exactly as is.
2. **Translate Text**: Only translate the human-readable text. Do NOT translate code blocks, file paths, or technical terms that should remain in English (e.g., "React", "API", "JSON").
3. **SEO Optimization**: Use natural, search-friendly phrasing in ${targetLang}.
4. **Internal Links**: Keep link paths identical for now (we will fix them programmatically).
5. **Images**: Keep image syntax \`![alt](url)\` but translate the alt text.
6. **No Fluff**: Do not add introductory text. Return ONLY the translated Markdown.

## Content to Translate:
${chunk}`;

    console.log("Asking AI...");
    const result = await ai.callAI(prompt, false);
    console.log("Result:", result);
}
run();
