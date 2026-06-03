export type GscReportType = 'query' | 'page';

export type GscRow = {
  entity: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscOpportunity = {
  entity: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  expectedCtr: number;
  gap: number;
  bucket: 'ctr' | 'ranking' | 'monitor';
  score: number;
  actions: string[];
};

export type GscComparison = {
  entity: string;
  current: GscRow;
  previous: GscRow | null;
  deltaClicks: number;
  deltaImpressions: number;
  deltaCtr: number;
  deltaPosition: number;
  status: 'improved' | 'declined' | 'mixed' | 'new';
  score: number;
};

export type QueryPrecisionRiskType = 'off-topic' | 'weak-intent' | 'ambiguous-intent';

export type QueryPrecisionRisk = {
  entity: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  issue: QueryPrecisionRiskType;
  reason: string;
  actions: string[];
  score: number;
};

const HEADER_ALIASES = {
  entity: ['query', 'queries', 'top queries', 'page', 'pages', 'top pages', '查询', '热门查询', '网页', '热门网页'],
  clicks: ['clicks', 'click', '点击次数', '点击'],
  impressions: ['impressions', 'impression', '展示次数', '展示'],
  ctr: ['ctr', 'average ctr', '平均点击率', '点击率'],
  position: ['position', 'average position', '平均排名', '排名'],
};

const CORE_QUERY_PATTERNS = [
  /\b(mcp|model context protocol)\b/i,
  /\b(ai\s*agent|agent\s*skills?|ai\s*skills?)\b/i,
  /\b(claude|cursor|windsurf|opencode)\b/i,
  /\b(workflow\s*automation|browser\s*automation|automation\s*skills?)\b/i,
  /\b(cli\s*tool|agent\s*cli|mcp\s*server)\b/i,
  /(智能体|代理|技能|工作流|自动化|命令行|工具)/i,
  /(エージェント|スキル|ワークフロー|自動化|ツール|サーバー)/i,
];

const PRODUCT_INTENT_PATTERNS = [
  /\b(skill|skills|tool|tools|agent|agents|automation|workflow|cli|server|servers|mcp|sdk|api)\b/i,
  /(技能|工具|智能体|代理|自动化|工作流|命令行|服务器)/i,
  /(スキル|ツール|エージェント|自動化|ワークフロー|サーバー|コマンドライン)/i,
];

const OFF_TOPIC_PATTERNS = [
  /\b(framer|animation|after effects|motion design)\b/i,
  /\b(core web vitals|lcp|cls|fid|ttfb)\b/i,
  /\b(static asset|asset optimization|performance optimization|rendering optimization)\b/i,
  /(静的アセット|パフォーマンス改善|性能优化|静态资源优化)/i,
];

const CATEGORY_HINTS: Array<{ pattern: RegExp; action: string }> = [
  {
    pattern: /\b(mcp|model context protocol)\b/i,
    action: 'Keep "MCP Server" explicit in the title and first paragraph.',
  },
  {
    pattern: /\b(claude|cursor|windsurf)\b/i,
    action: 'Keep editor compatibility visible in the title and meta description.',
  },
  {
    pattern: /\b(api|sdk|developer|code|debug)\b/i,
    action: 'Match the snippet to developer intent rather than a generic AI tools angle.',
  },
  {
    pattern: /\b(data|sql|database|analytics|etl)\b/i,
    action: 'Surface data workflow intent in the title and on-page intro.',
  },
  {
    pattern: /\b(design|ui|ux|figma|image)\b/i,
    action: 'Use a design-specific value proposition instead of a generic automation title.',
  },
  {
    pattern: /\b(browser|scraping|crawl|crawler|playwright)\b/i,
    action: 'Highlight browser automation or scraping capabilities in the snippet.',
  },
  {
    pattern: /\b(finance|payment|billing|stripe)\b/i,
    action: 'Use finance/payment wording in the title and description.',
  },
  {
    pattern: /\b(security|auth|oauth|jwt|compliance)\b/i,
    action: 'Lead with security review or auth intent in the SERP snippet.',
  },
];

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\ufeff/, '');
}

function findHeaderIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]).map(normalizeHeader);
    const hasClicks = cells.some((cell) => HEADER_ALIASES.clicks.includes(cell));
    const hasImpressions = cells.some((cell) => HEADER_ALIASES.impressions.includes(cell));
    if (hasClicks && hasImpressions) return i;
  }
  return -1;
}

function parseNumber(value: string): number {
  const normalized = value.replace(/,/g, '').trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCtr(value: string): number {
  const normalized = value.trim().replace('%', '');
  const parsed = parseNumber(normalized);
  if (value.includes('%')) return parsed / 100;
  return parsed > 1 ? parsed / 100 : parsed;
}

function expectedCtrByPosition(position: number): number {
  if (position <= 3) return 0.08;
  if (position <= 5) return 0.045;
  if (position <= 10) return 0.025;
  if (position <= 20) return 0.012;
  return 0.005;
}

function uniqueActions(actions: string[]): string[] {
  return Array.from(new Set(actions.filter(Boolean)));
}

function hasPattern(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function classifyQueryPrecisionRisk(
  entity: string,
): { issue: QueryPrecisionRiskType; reason: string; actions: string[] } | null {
  const query = entity.trim();
  if (!query) return null;

  const isCoreIntent = hasPattern(query, CORE_QUERY_PATTERNS);
  if (isCoreIntent) return null;

  const hasProductIntent = hasPattern(query, PRODUCT_INTENT_PATTERNS);
  const isLikelyOffTopic = hasPattern(query, OFF_TOPIC_PATTERNS);

  if (isLikelyOffTopic && !hasProductIntent) {
    return {
      issue: 'off-topic',
      reason: 'Query looks unrelated to AI agent skills or MCP server intent.',
      actions: [
        'Avoid broad performance/animation phrasing in title and H1 if this page is not meant for that intent.',
        'Route internal links toward pages that match your core skill-install and automation intent clusters.',
      ],
    };
  }

  if (!hasProductIntent) {
    return {
      issue: 'weak-intent',
      reason: 'Query lacks clear product-intent terms such as skills, tools, agents, or automation.',
      actions: [
        'Add explicit product-intent wording in title/meta (for example: AI agent skills, MCP server, workflow automation).',
        'If this topic is not strategic, narrow snippet copy to reduce accidental broad matching.',
      ],
    };
  }

  return {
    issue: 'ambiguous-intent',
    reason: 'Query has partial tool intent but does not strongly match core site positioning.',
    actions: [
      'Map this query to the closest solution cluster and align title/H1/meta with one clear intent.',
      'Add stronger internal links from /skills or /solutions pages to clarify relevance for crawlers.',
    ],
  };
}

function precisionRiskWeight(issue: QueryPrecisionRiskType): number {
  if (issue === 'off-topic') return 1.35;
  if (issue === 'weak-intent') return 1.15;
  return 1;
}

function suggestActions(entity: string, type: GscReportType, bucket: GscOpportunity['bucket']): string[] {
  const actions: string[] = [];

  if (type === 'query') {
    actions.push('Mirror the exact query intent more directly in the title and meta description.');
    actions.push(
      bucket === 'ranking'
        ? 'Improve internal linking to move this query into the top 10.'
        : 'Test a sharper SERP hook before changing page scope.',
    );
    for (const hint of CATEGORY_HINTS) {
      if (hint.pattern.test(entity)) actions.push(hint.action);
    }
  } else {
    if (entity.includes('/skills/')) {
      actions.push('Test a tighter skill detail title template and keep category intent in the snippet.');
    } else if (entity.includes('/categories')) {
      actions.push('Strengthen the category hub title, intro copy, and internal links from the skills directory.');
    } else if (entity.includes('/collections')) {
      actions.push('Refresh the collection value proposition and keep the year/list angle in the title.');
    } else {
      actions.push('Rewrite the page title and meta description to better reflect the top query cluster.');
    }
    if (bucket === 'ranking') actions.push('Support the page with stronger internal links and clearer H1 alignment.');
  }

  return uniqueActions(actions);
}

export function parseGscCsv(csv: string): GscRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const headerIndex = findHeaderIndex(lines);
  if (headerIndex === -1) {
    throw new Error('Could not find a valid GSC CSV header row.');
  }

  const headerCells = parseCsvLine(lines[headerIndex]).map(normalizeHeader);
  const indexOf = (aliases: string[]) => headerCells.findIndex((cell) => aliases.includes(cell));

  const entityIndex = indexOf(HEADER_ALIASES.entity);
  const clicksIndex = indexOf(HEADER_ALIASES.clicks);
  const impressionsIndex = indexOf(HEADER_ALIASES.impressions);
  const ctrIndex = indexOf(HEADER_ALIASES.ctr);
  const positionIndex = indexOf(HEADER_ALIASES.position);

  if ([entityIndex, clicksIndex, impressionsIndex, ctrIndex, positionIndex].some((index) => index === -1)) {
    throw new Error('Missing one or more required GSC columns: entity, clicks, impressions, ctr, position.');
  }

  const rows: GscRow[] = [];

  for (const line of lines.slice(headerIndex + 1)) {
    const cells = parseCsvLine(line);
    const entity = (cells[entityIndex] || '').trim();
    if (!entity || /^total/i.test(entity) || entity === '总计') continue;

    rows.push({
      entity,
      clicks: parseNumber(cells[clicksIndex] || ''),
      impressions: parseNumber(cells[impressionsIndex] || ''),
      ctr: parseCtr(cells[ctrIndex] || ''),
      position: parseNumber(cells[positionIndex] || ''),
    });
  }

  return rows;
}

export function findCtrOpportunities(rows: GscRow[], type: GscReportType, limit = 20): GscOpportunity[] {
  const opportunities = rows
    .filter((row) => row.impressions >= 20)
    .map((row) => {
      const expectedCtr = expectedCtrByPosition(row.position);
      const gap = expectedCtr - row.ctr;
      const bucket: GscOpportunity['bucket'] = row.position <= 10 ? 'ctr' : row.position <= 20 ? 'ranking' : 'monitor';
      const scoreBase = Math.max(gap, 0) * row.impressions;
      const score =
        scoreBase * (bucket === 'ctr' ? 1.4 : bucket === 'ranking' ? 1.1 : 0.6) * (row.clicks === 0 ? 1.1 : 1);

      return {
        ...row,
        expectedCtr,
        gap,
        bucket,
        score,
        actions: suggestActions(row.entity, type, bucket),
      };
    })
    .filter((row) => {
      if (row.bucket === 'monitor') return row.impressions >= 50 && row.gap > 0.003;
      if (row.bucket === 'ranking') return row.gap > 0 && row.position <= 20;
      return row.gap > 0;
    })
    .sort((a, b) => b.score - a.score);

  return opportunities.slice(0, limit);
}

export function findQueryPrecisionRisks(rows: GscRow[], limit = 20): QueryPrecisionRisk[] {
  const risks = rows
    .filter((row) => row.impressions >= 5)
    .map((row) => {
      const classification = classifyQueryPrecisionRisk(row.entity);
      if (!classification) return null;

      const scoreBase = row.impressions * (row.clicks === 0 ? 1.2 : 1) * (row.position <= 20 ? 1.1 : 0.95);
      const score = scoreBase * precisionRiskWeight(classification.issue);

      return {
        ...row,
        issue: classification.issue,
        reason: classification.reason,
        actions: classification.actions,
        score,
      };
    })
    .filter((row): row is QueryPrecisionRisk => row !== null)
    .sort((a, b) => b.score - a.score);

  return risks.slice(0, limit);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function compareGscSnapshots(currentRows: GscRow[], previousRows: GscRow[], limit = 20): GscComparison[] {
  const previousMap = new Map(previousRows.map((row) => [row.entity, row]));

  const comparisons = currentRows
    .filter((row) => row.impressions >= 20 || row.clicks > 0)
    .map((current) => {
      const previous = previousMap.get(current.entity) || null;
      const previousClicks = previous?.clicks || 0;
      const previousImpressions = previous?.impressions || 0;
      const previousCtr = previous?.ctr || 0;
      const previousPosition = previous?.position || 0;
      const deltaClicks = current.clicks - previousClicks;
      const deltaImpressions = current.impressions - previousImpressions;
      const deltaCtr = current.ctr - previousCtr;
      const deltaPosition = previous ? current.position - previousPosition : 0;

      let status: GscComparison['status'] = 'mixed';
      if (!previous) {
        status = 'new';
      } else if (deltaCtr >= 0.003 && deltaClicks >= 0 && deltaPosition <= 0.5) {
        status = 'improved';
      } else if (deltaCtr <= -0.003 && deltaClicks <= 0 && deltaPosition >= -0.5) {
        status = 'declined';
      }

      const score =
        Math.abs(deltaCtr) * Math.max(current.impressions, previousImpressions, 1) +
        Math.abs(deltaClicks) * 3 +
        Math.abs(deltaImpressions) * 0.02;

      return {
        entity: current.entity,
        current,
        previous,
        deltaClicks,
        deltaImpressions,
        deltaCtr,
        deltaPosition,
        status,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  return comparisons.slice(0, limit);
}

export type DirectoryAggregatedMetrics = {
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
  count: number;
  rows: GscRow[];
};

export function isRepositoryDirectoryPath(url: string): boolean {
  const path = url.replace(/^https?:\/\/[^/]+/, '');
  // 匹配如 /skills/owner/repo 或 /zh-cn/skills/owner/repo，但不包含更深路径（例如 /skills/owner/repo/skill）
  return /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?skills\/([^/]+)\/([^/]+)\/?$/i.test(path);
}

export function aggregateRepositoryDirectoryMetrics(rows: GscRow[]): DirectoryAggregatedMetrics {
  const directoryRows = rows.filter((row) => isRepositoryDirectoryPath(row.entity));

  let totalClicks = 0;
  let totalImpressions = 0;
  let weightedPositionSum = 0;

  for (const row of directoryRows) {
    totalClicks += row.clicks;
    totalImpressions += row.impressions;
    weightedPositionSum += row.position * row.impressions;
  }

  const averageCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const averagePosition = totalImpressions > 0 ? weightedPositionSum / totalImpressions : 0;

  return {
    totalClicks,
    totalImpressions,
    averageCtr,
    averagePosition,
    count: directoryRows.length,
    rows: directoryRows,
  };
}
