import type { Locale } from '../i18n';
import type { KeywordClusterId } from './seo-keywords';

export type BlogIntentLink = {
  title: string;
  description: string;
  href: string;
};

export type BlogMetaOverride = {
  title: string;
  description: string;
};

const CATEGORY_CLUSTERS: Record<string, KeywordClusterId[]> = {
  'document-automation': ['documentAutomation', 'workflowAutomation', 'templates'],
  'developer-experience': ['developerExperience', 'workflowAutomation'],
  'enterprise-solutions': ['enterpriseWorkflows', 'processAutomation', 'templates'],
  'creative-tools': ['creativeWorkflows', 'workflowAutomation'],
};

export function getBlogKeywordClusters(category: string | undefined, slug: string): KeywordClusterId[] {
  const clusters = [...(CATEGORY_CLUSTERS[category || ''] || ['workflowAutomation'])];

  if (/\bmcp\b/i.test(slug)) {
    clusters.push('mcp', 'developerExperience');
  }

  if (/cursor|claude|windsurf|custom-ai-agent-skills|webapp-testing/i.test(slug)) {
    clusters.push('ideCompat', 'developerExperience');
  }

  if (/pdf|docx|xlsx|document|presentation|coauthoring/i.test(slug)) {
    clusters.push('documentAutomation', 'templates');
  }

  if (/install|setup|official-ai-agent-skills-guide|what-are-ai-agent-skills/i.test(slug)) {
    clusters.push('installSetup', 'docs', 'compatibility');
  }

  if (/internal-comms|communications|leadership|newsletter|incident/i.test(slug)) {
    clusters.push('enterpriseWorkflows', 'processAutomation', 'templates');
  }

  return Array.from(new Set(clusters));
}

export function getBlogLongTailKeywords(slug: string, locale: Locale): string[] {
  const isZh = locale === 'zh';

  if (/pdf/i.test(slug)) {
    return isZh
      ? ['PDF 自动化', 'OCR 自动化', '文档提取流程']
      : ['pdf automation', 'ocr automation', 'document extraction workflow'];
  }

  if (/xlsx|excel/i.test(slug)) {
    return isZh
      ? ['Excel 自动化', '报表自动化', '表格工作流']
      : ['excel automation', 'report automation', 'spreadsheet workflow'];
  }

  if (/docx|word/i.test(slug)) {
    return isZh
      ? ['Word 自动化', '文档模板', '报告模板']
      : ['word automation', 'document templates', 'report templates'];
  }

  if (/mcp/i.test(slug)) {
    return isZh
      ? ['面向开发工作流的 AI Agent Skills', '开发工作流技能', 'Claude Code 与 MCP 集成']
      : ['ai agent skills for developer workflows', 'developer workflow skills', 'claude code integrations with mcp'];
  }

  if (/internal-comms|communications/i.test(slug)) {
    return isZh
      ? ['流程自动化', '内部沟通模板', '团队更新流程']
      : ['process automation', 'internal communication templates', 'team update workflows'];
  }

  if (/install|setup/i.test(slug)) {
    return isZh
      ? ['安装 AI Agent Skills', '技能配置', 'IDE 兼容']
      : ['install ai agent skills', 'skill setup', 'ide compatibility'];
  }

  return isZh
    ? ['开发者工作流技能', 'AI Agent Skills', '技能模板']
    : ['developer workflow skills', 'ai agent skills', 'skill templates'];
}

export function getBlogIntentLinks(locale: string, category: string | undefined, slug: string): BlogIntentLink[] {
  const isZh = locale === 'zh';

  if (category === 'document-automation' || /pdf|docx|xlsx|document/i.test(slug)) {
    return [
      {
        title: isZh ? '查看文档自动化技能' : 'Browse Document Automation Skills',
        description: isZh
          ? '继续找 PDF、DOCX、Excel 与报告自动化技能。'
          : 'Keep exploring PDF, DOCX, Excel, and report automation skills.',
        href: `/${locale}/skills?q=document automation`,
      },
      {
        title: isZh ? '工作流模板入口' : 'Workflow Template Entry',
        description: isZh
          ? '进入可复用的模板与文档流程合集。'
          : 'Move into reusable templates and document workflow collections.',
        href: `/${locale}/collections`,
      },
      {
        title: isZh ? '安装与 CLI 指南' : 'Install & CLI Guide',
        description: isZh
          ? '继续查看安装、CLI 命令与配置步骤。'
          : 'Continue with installation, CLI commands, and setup steps.',
        href: `/${locale}/docs/installation`,
      },
    ];
  }

  if (category === 'developer-experience' || /mcp|cursor|claude|windsurf|custom-ai-agent-skills/i.test(slug)) {
    return [
      {
        title: isZh ? '开发工作流所需技能' : 'Skills for Developer Workflows',
        description: isZh
          ? '继续浏览开发工作流优先的 AI Agent Skills 与可集成能力。'
          : 'Keep browsing skills-first developer workflow setups and integration-ready capabilities.',
        href: `/${locale}/skills?q=skills for developer workflows`,
      },
      {
        title: isZh ? 'IDE 兼容与配置' : 'IDE Compatibility & Setup',
        description: isZh
          ? '查看 Cursor、Claude Code、VS Code 的兼容入口。'
          : 'Review Cursor, Claude Code, and VS Code compatibility entry points.',
        href: `/${locale}/integrations`,
      },
      {
        title: isZh ? 'CLI 安装技能' : 'Install Skills with the CLI',
        description: isZh
          ? '继续到 CLI 页面查看安装与同步命令。'
          : 'Head to the CLI page for installation and sync commands.',
        href: `/${locale}/cli`,
      },
    ];
  }

  if (category === 'enterprise-solutions' || /internal-comms|communications|leadership|newsletter/i.test(slug)) {
    return [
      {
        title: isZh ? '查看流程自动化技能' : 'Browse Process Automation Skills',
        description: isZh
          ? '继续看团队协作、流程化、业务自动化技能。'
          : 'Explore team, process, and business automation skills next.',
        href: `/${locale}/skills?q=process automation`,
      },
      {
        title: isZh ? '浏览工作流模板' : 'Browse Workflow Templates',
        description: isZh
          ? '查看 SOP、模板和可复用自动化场景。'
          : 'Review SOPs, templates, and reusable automation scenarios.',
        href: `/${locale}/skills?q=workflow templates`,
      },
      {
        title: isZh ? '文档与配置入口' : 'Docs & Setup Entry',
        description: isZh ? '进入文档、安装与配置说明页。' : 'Move into documentation, installation, and setup pages.',
        href: `/${locale}/docs`,
      },
    ];
  }

  return [
    {
      title: isZh ? '查找工作流自动化技能' : 'Browse Workflow Automation Skills',
      description: isZh
        ? '继续浏览更精准的工作流自动化长尾结果。'
        : 'Continue into more precise workflow automation search results.',
      href: `/${locale}/skills?q=workflow automation`,
    },
    {
      title: isZh ? '安装与配置文档' : 'Install & Setup Docs',
      description: isZh ? '查看安装、配置和兼容性入口。' : 'See install, setup, and compatibility entry points.',
      href: `/${locale}/docs`,
    },
    {
      title: isZh ? '浏览工作流合集' : 'Browse Workflow Collections',
      description: isZh ? '查看更完整的模板和流程合集。' : 'Explore fuller template and workflow collections.',
      href: `/${locale}/collections`,
    },
  ];
}

export function getBlogMetaOverride(locale: Locale, slug: string): BlogMetaOverride | null {
  if (locale !== 'en') return null;

  switch (slug) {
    case 'mastering-pdf-automation-with-ai-skills':
      return {
        title: 'PDF Automation with AI: OCR, Extraction & Report Workflows',
        description:
          'Automate PDFs with AI for OCR, table extraction, and report generation. See install steps, real workflows, and the best skill for document automation.',
      };
    case 'how-to-build-mcp-servers-with-agent-skills':
      return {
        title: 'Skills for Developer Workflows: Build MCP Integrations in Claude Code or Cursor',
        description:
          'Build MCP integrations for Claude Code or Cursor with reusable AI agent skill workflows, step-by-step setup, tool design, testing, and deployment patterns.',
      };
    case 'how-to-install-ai-agent-skills':
      return {
        title: 'How to Install AI Agent Skills in Cursor, Claude Code, or Windsurf',
        description:
          'Install AI agent skills in Cursor, Claude Code, or Windsurf with npx killer-skills add. Follow the fastest setup for one IDE or all of them.',
      };
    case 'top-10-mcp-servers-2026':
      return {
        title: '10 MCP Tools & Integrations for Claude Code, Cursor, and Windsurf',
        description:
          'Explore practical MCP tools, integrations, and workflow patterns for Claude Code, Cursor, and Windsurf across GitHub, SQLite, browser automation, and docs.',
      };
    case 'official-ai-agent-skills-guide':
      return {
        title: 'Official AI Agent Skills to Install Right Now',
        description:
          'Find official AI agent skills for PDFs, frontend UI, SEO, MCP, and automation, plus which ones to install first for real work.',
      };
    case 'what-are-ai-agent-skills':
      return {
        title: 'What Are AI Agent Skills? How They Work in Claude Code, Cursor & Windsurf',
        description:
          'Understand what AI agent skills are, how SKILL.md files work, where to place them, and why they help Claude Code, Cursor, and Windsurf.',
      };
    case 'best-ai-agent-skills-2026':
      return {
        title: 'AI Agent Skills for Claude Code, Cursor & Windsurf (2026)',
        description:
          'Compare AI agent skills for Claude Code, Cursor, and Windsurf in 2026, from document automation and UI to MCP and workflows.',
      };
    case 'claude-code-vs-cursor-vs-windsurf':
      return {
        title: 'Claude Code vs Cursor vs Windsurf for AI Agent Skills',
        description:
          'Compare Claude Code, Cursor, and Windsurf for AI agent skills, including file formats, loading behavior, context limits, and setup tradeoffs.',
      };
    default:
      return null;
  }
}
