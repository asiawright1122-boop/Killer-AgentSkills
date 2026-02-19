
const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'data/skills-cache.json');
console.log('Reading file:', FILE);

try {
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  console.log('Skills loaded:', data.skills.length);

  let empty = 0;
  let mixed = 0;
  const missingIds = [];
  const mixedIds = [];

  for (const s of data.skills) {
    if (!s.agentAnalysis) continue;

    // Check recommendation.zh
    const zh = s.agentAnalysis.recommendation?.zh;

    if (!zh || zh.trim() === '') {
      empty++;
      missingIds.push(s.name);
    } else {
      // Heuristic: Check if Chinese translation contains NO Chinese characters
      // This is a strong signal of completely missing translation (fallback to English)
      const hasChinese = /[\u4e00-\u9fa5]/.test(zh);
      if (!hasChinese && zh.length > 20) {
        mixed++;
        mixedIds.push(s.name);
      }
    }
  }

  console.log('---------------------------------------------------');
  console.log('Total Skills with Agent Analysis:', data.skills.filter(s => s.agentAnalysis).length);
  console.log('Empty ZH Translations:', empty);
  console.log('English-only ZH Translations (Fallback):', mixed);
  console.log('---------------------------------------------------');

  if (missingIds.length > 0) {
    console.log('Missing IDs (First 10):', missingIds.slice(0, 10).join(', '));
  }

  if (mixedIds.length > 0) {
    console.log('Mixed/Fallback IDs (First 50):', mixedIds.slice(0, 50).join(', '));
    // Output a filter string for the first batch
    const filterArgs = mixedIds.slice(0, 10).join(',');
    console.log('\nSuggested filter string for batch 1:', filterArgs);
  }

} catch (e) {
  console.error('Error:', e.message);
}
