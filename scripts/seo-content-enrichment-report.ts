import * as fs from 'fs';
import * as path from 'path';

interface LocalizedText {
  en: string;
  zh: string;
  [key: string]: string;
}

interface AuthoritySurface {
  id: string;
  role: string;
  tier: 'P0' | 'P1' | 'P2' | 'P3';
  surfaceClass: 'hub' | 'collection' | 'solution' | 'guide' | 'comparison' | 'directory';
  href: string;
  title: LocalizedText;
  description: LocalizedText;
  rationale: LocalizedText;
  placements: string[];
}

interface EditorialQueueItem {
  id: string;
  surfaceId: string;
  priority: 'now' | 'next' | 'none';
  action: LocalizedText;
  why: LocalizedText;
}

interface AuthoritySurfacesData {
  surfaces: AuthoritySurface[];
  editorialQueue: EditorialQueueItem[];
}

interface CollectionData {
  title?: LocalizedText;
  description?: LocalizedText;
  longDescription?: LocalizedText;
  editorial?: {
    selectionReason?: LocalizedText;
    reviewSummary?: LocalizedText;
  };
}

function getCollectionFileName(slug: string): string {
  // Map canonical slug to actual JSON filename if they differ
  const map: Record<string, string> = {
    'top-official-ai-skills-trusted-tools': 'top-official-mcp-servers.json',
    'top-agent-workflow-building-tools': 'top-workflow-mcp-servers.json',
    'top-cli-terminal-ai-agent-tools': 'top-cli-mcp-servers.json',
    'top-codex-workflow-skills-developer-integrations': 'top-codex-mcp-servers.json',
    'top-community-skills-ai-utilities': 'top-community-mcp-servers.json',
    'top-community-contributed-ai-agent-skills': 'top-community-skills.json',
    'top-github-copilot-companion-skills-dev-tools': 'top-copilot-mcp-servers.json',
    'top-cursor-compatible-skills-workflow-integrations': 'top-cursor-mcp-servers.json',
    'top-developer-tooling-ai-agent-work': 'top-developer-tools-mcp-servers.json',
    'top-devops-operations-automation-tools': 'top-devops-mcp-servers.json',
    'top-frameworks-sdk-foundations-agents': 'top-framework-mcp-servers.json',
    'top-gemini-cli-workflow-tools-terminal-automation-skills': 'top-gemini-cli-mcp-servers.json',
    'top-gemini-compatible-dev-tools-agent-workflow-skills': 'top-gemini-mcp-servers.json',
    'top-hacktoberfest-ai-skills-open-source-contributors': 'top-hacktoberfest-mcp-servers.json',
    'top-ai-agent-workflow-skills-integrations-utilities': 'top-mcp-mcp-servers.json',
    'top-ai-agent-integration-frameworks-bridges-infra-tooling': 'top-mcp-server-mcp-servers.json',
    'top-ai-agent-workflow-skills-integrations-2026': 'top-mcp-servers-2026.json',
    'top-nextjs-ai-tools-full-stack-developer-workflows': 'top-nextjs-mcp-servers.json',
    'top-openai-powered-ai-agent-tools': 'top-openai-mcp-servers.json',
    'top-opencode-workflow-tools-companion-integrations': 'top-opencode-mcp-servers.json',
    'top-orchestration-platforms-agent-execution': 'top-orchestration-mcp-servers.json',
    'top-productivity-tools-ai-enabled-developers': 'top-productivity-mcp-servers.json',
    'top-prompt-engineering-tools-agent-workflows': 'top-prompt-engineering-mcp-servers.json',
    'top-python-ai-agent-tools-developer-workflows': 'top-python-mcp-servers.json',
    'top-react-ai-tools-ui-workflows-component-development': 'top-react-mcp-servers.json',
    'top-rust-ai-tools-systems-workflows-reliability': 'top-rust-mcp-servers.json',
    'top-typescript-ai-tools-developer-workflows': 'top-typescript-mcp-servers.json',
  };
  return map[slug] || `${slug}.json`;
}

function main() {
  const workspaceRoot = process.cwd();
  const surfacesPath = path.resolve(workspaceRoot, 'data/authority-surfaces.json');
  const collectionsDir = path.resolve(workspaceRoot, 'src/content/collections');

  if (!fs.existsSync(surfacesPath)) {
    console.error(`Error: authority-surfaces.json not found at ${surfacesPath}`);
    process.exit(1);
  }

  const surfacesData = JSON.parse(fs.readFileSync(surfacesPath, 'utf8')) as AuthoritySurfacesData;
  const { surfaces, editorialQueue } = surfacesData;

  console.log('====================================================');
  console.log('   Killer-Skills SEO Content Enrichment Diagnostic   ');
  console.log('====================================================\n');

  let thinCount = 0;
  const analysisResults: {
    id: string;
    tier: string;
    surfaceClass: string;
    descEnLen: number;
    descZhLen: number;
    longDescEnLen: number;
    longDescZhLen: number;
    hasSelectionReason: boolean;
    hasReviewSummary: boolean;
    isThin: boolean;
    reasons: string[];
    priorityScore: number;
  }[] = [];

  for (const s of surfaces) {
    const reasons: string[] = [];
    let isThin = false;

    // Check description
    const descEn = s.description?.en || '';
    const descZh = s.description?.zh || '';
    if (descEn.length < 60) {
      isThin = true;
      reasons.push(`Short EN Description (${descEn.length} chars)`);
    }
    if (descZh.length < 25) {
      isThin = true;
      reasons.push(`Short ZH Description (${descZh.length} chars)`);
    }

    let longDescEnLen = 0;
    let longDescZhLen = 0;
    let hasSelectionReason = false;
    let hasReviewSummary = false;

    if (s.surfaceClass === 'collection') {
      const slug = s.href.split('/').pop() || '';
      const filename = getCollectionFileName(slug);
      const filePath = path.join(collectionsDir, filename);

      if (fs.existsSync(filePath)) {
        try {
          const colData = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CollectionData;
          longDescEnLen = colData.longDescription?.en?.length || 0;
          longDescZhLen = colData.longDescription?.zh?.length || 0;

          if (longDescEnLen < 150) {
            isThin = true;
            reasons.push(`Thin EN longDescription (${longDescEnLen} chars)`);
          }
          if (longDescZhLen < 80) {
            isThin = true;
            reasons.push(`Thin ZH longDescription (${longDescZhLen} chars)`);
          }

          hasSelectionReason = !!(colData.editorial?.selectionReason?.en && colData.editorial?.selectionReason?.zh);
          hasReviewSummary = !!(colData.editorial?.reviewSummary?.en && colData.editorial?.reviewSummary?.zh);

          if (!hasSelectionReason) {
            isThin = true;
            reasons.push('Missing/Empty editorial selectionReason');
          }
          if (!hasReviewSummary) {
            isThin = true;
            reasons.push('Missing/Empty editorial reviewSummary');
          }
        } catch (e) {
          reasons.push(`Error parsing collection JSON file ${filename}`);
        }
      } else {
        isThin = true;
        reasons.push(`Collection file ${filename} not found in content directory`);
      }
    } else {
      // For non-collections (hubs, solutions, guides), longDescription checking is skipped or mapped differently.
      // But we can check description and rationale length.
      const rationaleEn = s.rationale?.en || '';
      if (rationaleEn.length < 60) {
        isThin = true;
        reasons.push(`Short EN Rationale (${rationaleEn.length} chars)`);
      }
    }

    if (isThin) {
      thinCount++;
    }

    // Priority score calculation: P0=1000, P1=500, P2=200, P3=100 + thin penalty (number of reasons * 100)
    const tierScore = { P0: 1000, P1: 500, P2: 200, P3: 100 }[s.tier] || 0;
    const priorityScore = tierScore + (isThin ? reasons.length * 100 : 0);

    analysisResults.push({
      id: s.id,
      tier: s.tier,
      surfaceClass: s.surfaceClass,
      descEnLen: descEn.length,
      descZhLen: descZh.length,
      longDescEnLen,
      longDescZhLen,
      hasSelectionReason,
      hasReviewSummary,
      isThin,
      reasons,
      priorityScore,
    });
  }

  // General statistics
  console.log('📊 --- SUMMARY STATISTICS ---');
  console.log(`Total Vetted Surfaces:  ${surfaces.length}`);
  console.log(`Thin Content Surfaces:  ${thinCount} (${((thinCount / surfaces.length) * 100).toFixed(1)}%)`);
  console.log(`Editorial Queue Items:  ${editorialQueue.length} pending`);
  console.log('----------------------------------------------------\n');

  // Print Editorial Queue Items
  console.log('📌 --- EDITORIAL QUEUE STATUS ---');
  if (editorialQueue.length === 0) {
    console.log('✅ Editorial queue is empty! No pending actions.');
  } else {
    for (const item of editorialQueue) {
      console.log(`  - [${item.priority.toUpperCase()}] Surface: ${item.surfaceId}`);
      console.log(`    Action: ${item.action.en}`);
    }
  }
  console.log('');

  // Priority Action Queue (Top 5 thinnest high-tier pages)
  console.log('🔥 --- TOP 5 PRIORITIZED ACTIONS ---');
  const thinPriorityQueue = analysisResults
    .filter(r => r.isThin)
    .sort((a, b) => b.priorityScore - a.priorityScore);

  if (thinPriorityQueue.length === 0) {
    console.log('✅ All surfaces are rich and meet the content guidelines!');
  } else {
    thinPriorityQueue.slice(0, 5).forEach((item, index) => {
      console.log(`${index + 1}. [${item.tier}] Surface ID: ${item.id} (${item.surfaceClass.toUpperCase()})`);
      console.log(`   Priority Score: ${item.priorityScore}`);
      console.log(`   Deficiencies:`);
      item.reasons.forEach(r => console.log(`     * ${r}`));
      console.log('');
    });
  }

  console.log('====================================================');
}

main();
