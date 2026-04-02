import { AIService } from './scripts/lib/ai';

async function main() {
  const aiService = new AIService();
  console.log('Available providers:', (aiService as any).getAvailableProviders().map(p => p.label));
  const res = await aiService.callAI('Respond with {"hello": "world"}', true);
  console.log('Result:', res);
}

main().catch(console.error);
