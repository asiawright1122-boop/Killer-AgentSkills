
import 'dotenv/config';
import { AIService } from './scripts/lib/ai';

async function debug() {
    console.log('--- AI Service Debug ---');
    const ai = new AIService();

    // @ts-ignore
    console.log('Config loaded:', {
        nvidia: !!ai.config.nvidiaKeys.length,
        silicon: !!ai.config.siliconFlowKey,
        openrouter: !!ai.config.openRouterKeys.length,
        cloudflare: !!ai.config.cfAccountId
    });

    const prompt = "Hello, respond with 'PROVIDER_TEST_OK' and your name.";
    console.log('\nTesting RACE mode...');
    try {
        const result = await ai.callAI(prompt);
        console.log('Result:', result);
        console.log('Stats:', ai.stats);
    } catch (e) {
        console.error('Error in callAI:', e);
    }
}

debug().catch(console.error);
