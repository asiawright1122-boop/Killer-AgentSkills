import { AIService } from './scripts/lib/ai.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const ai = new AIService();
    const prompt = "Translate this word to zh (Chinese): 'Hello World'";
    console.log("Asking AI...");
    const result = await ai.callAI(prompt, false);
    console.log("Result:", result);
}
run();
