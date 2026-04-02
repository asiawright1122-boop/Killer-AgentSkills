import { AIService } from './scripts/lib/ai';

async function main() {
  const aiService = new AIService();
  const originalCallAISingle = (aiService as any).callAISingle.bind(aiService);
  (aiService as any).callAISingle = async function(...args: any[]) {
    try {
      return await originalCallAISingle(...args);
    } catch (e: any) {
      console.error(`[DIAGNOSTIC] ${args[1]} ${args[2].slice(0,5)}... threw:`, e.message);
      throw e;
    }
  };

  console.log('Available providers:', (aiService as any).getAvailableProviders().map((p: any) => p.label));
  try {
    const res = await aiService.callAI('Respond with {"hello": "world"}', true);
    console.log('Result:', res);
  } catch (e) {
    console.error('Final Error:', e);
  }
}

main().catch(console.error);
