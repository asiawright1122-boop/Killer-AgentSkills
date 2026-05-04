import type { KeywordClusterId } from './seo-keywords';
import { buildSolutionPath } from './solution-intents';

export type BlogIntentLink = {
  title: string;
  description: string;
  href: string;
};

export type BlogMetaOverride = {
  title: string;
  description: string;
};

const isMissingTranslation = (value: string, keyPrefix: string) => !value || value.includes(keyPrefix);

const readBlogMessage = (t: (k: string, fb?: string) => string, seoKey: string) => {
  const seoValue = t(seoKey, '');
  if (!isMissingTranslation(seoValue, 'Seo.Blog.')) return seoValue;

  const blogKey = seoKey.replace(/^Seo\.Blog\./, 'Blog.');
  const blogValue = t(blogKey, '');
  return isMissingTranslation(blogValue, 'Blog.') ? '' : blogValue;
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

export function getBlogLongTailKeywords(slug: string, t: (k: string, fb?: string) => string): string[] {
  if (/pdf/i.test(slug)) return readBlogMessage(t, 'Seo.Blog.LongTail.pdf').split(', ');
  if (/xlsx|excel/i.test(slug)) return readBlogMessage(t, 'Seo.Blog.LongTail.xlsx').split(', ');
  if (/docx|word/i.test(slug)) return readBlogMessage(t, 'Seo.Blog.LongTail.docx').split(', ');
  if (/mcp/i.test(slug)) return readBlogMessage(t, 'Seo.Blog.LongTail.mcp').split(', ');
  if (/internal-comms|communications/i.test(slug))
    return readBlogMessage(t, 'Seo.Blog.LongTail.internalComms').split(', ');
  if (/install|setup/i.test(slug)) return readBlogMessage(t, 'Seo.Blog.LongTail.installSetup').split(', ');

  return readBlogMessage(t, 'Seo.Blog.LongTail.default').split(', ');
}

const SKILL_HREFS: Record<string, string> = {
  'automate-word-documents-with-docx-skills': 'skills/anthropics/skills/docx',
  'mastering-excel-automation-with-xlsx-skills': 'skills/anthropics/skills/xlsx',
  'mastering-pdf-automation-with-ai-skills': 'skills/anthropics/skills/pdf',
  'killer-ui-design-with-frontend-design-skills': 'skills/anthropics/skills/frontend-design',
  'master-visual-identity-with-brand-guidelines-skills': 'skills/anthropics/skills/brand-guidelines',
  'mastering-generative-art-with-claudecode-skills': 'skills/anthropics/skills/algorithmic-art',
  'professional-presentations-with-pptx-ai-skills': 'skills/anthropics/skills/pptx',
  'professional-poster-design-with-canvas-skills': 'skills/anthropics/skills/canvas',
  'collaborative-writing-with-doc-coauthoring-skills': 'skills/anthropics/skills/doc-coauthoring',
  'automated-ui-testing-with-webapp-testing-skills': 'skills/anthropics/skills/webapp-testing',
  'instant-branding-with-theme-factory-skills': 'skills/anthropics/skills/theme-factory',
  'create-custom-slack-emojis-with-ai-skills': 'skills/anthropics/skills/slack-emoji',
};

export function getBlogIntentLinks(
  locale: string,
  category: string | undefined,
  slug: string,
  t: (k: string, fb?: string) => string,
): BlogIntentLink[] {
  const slugEntryHref = SKILL_HREFS[slug];
  if (slugEntryHref) {
    return [
      {
        title: readBlogMessage(t, `Seo.Blog.IntentLinks.${slug}.title`),
        description: readBlogMessage(t, `Seo.Blog.IntentLinks.${slug}.description`),
        href: `/${locale}/${slugEntryHref}`,
      },
      {
        title: readBlogMessage(t, 'Seo.Blog.Misc.browseAllSkills'),
        description: readBlogMessage(t, 'Seo.Blog.Misc.exploreMoreSkills'),
        href: `/${locale}/skills`,
      },
      {
        title: readBlogMessage(t, 'Seo.Blog.Misc.installGuide'),
        description: readBlogMessage(t, 'Seo.Blog.Misc.seeInstallSteps'),
        href: `/${locale}/docs/installation`,
      },
    ];
  }

  if (category === 'document-automation' || /pdf|docx|xlsx|document/i.test(slug)) {
    return [
      {
        title: readBlogMessage(t, 'Seo.Blog.Misc.browseDocumentAutomations'),
        description: readBlogMessage(t, 'Seo.Blog.Misc.keepExploringPdf'),
        href: buildSolutionPath(locale, 'document-automation'),
      },
      {
        title: readBlogMessage(t, 'Seo.Blog.Misc.workflowTemplateEntry'),
        description: readBlogMessage(t, 'Seo.Blog.Misc.moveIntoReusable'),
        href: `/${locale}/collections`,
      },
      {
        title: readBlogMessage(t, 'Seo.Blog.Misc.installGuide'),
        description: readBlogMessage(t, 'Seo.Blog.Misc.seeInstallSteps'),
        href: `/${locale}/docs/installation`,
      },
    ];
  }

  if (category === 'developer-experience' || /mcp|cursor|claude|windsurf|custom-ai-agent-skills/i.test(slug)) {
    return [
      {
        title: readBlogMessage(t, 'Seo.Blog.Misc.skillsForDeveloperWorkflows'),
        description: readBlogMessage(t, 'Seo.Blog.Misc.keepBrowsingSkills'),
        href: buildSolutionPath(locale, 'agent-workflows'),
      },
      {
        title: readBlogMessage(t, 'Seo.Blog.Misc.ideCompatibility'),
        description: readBlogMessage(t, 'Seo.Blog.Misc.reviewCursorClaude'),
        href: `/${locale}/integrations`,
      },
      {
        title: readBlogMessage(t, 'Seo.Blog.Misc.installSkillsCLI'),
        description: readBlogMessage(t, 'Seo.Blog.Misc.headToCLI'),
        href: `/${locale}/cli`,
      },
    ];
  }

  if (category === 'enterprise-solutions' || /internal-comms|communications|leadership|newsletter/i.test(slug)) {
    return [
      {
        title: readBlogMessage(t, 'Seo.Blog.Misc.browseProcessAutomation'),
        description: readBlogMessage(t, 'Seo.Blog.Misc.exploreTeamProcess'),
        href: buildSolutionPath(locale, 'process-automation'),
      },
      {
        title: readBlogMessage(t, 'Seo.Blog.Misc.browseWorkflowTemplates'),
        description: readBlogMessage(t, 'Seo.Blog.Misc.reviewSOPs'),
        href: buildSolutionPath(locale, 'workflow-automation'),
      },
      {
        title: readBlogMessage(t, 'Seo.Blog.Misc.docsSetupEntry'),
        description: readBlogMessage(t, 'Seo.Blog.Misc.moveIntoDocs'),
        href: `/${locale}/docs`,
      },
    ];
  }

  return [
    {
      title: readBlogMessage(t, 'Seo.Blog.Misc.browseWorkflowAutomation'),
      description: readBlogMessage(t, 'Seo.Blog.Misc.continueIntoPrecise'),
      href: buildSolutionPath(locale, 'workflow-automation'),
    },
    {
      title: readBlogMessage(t, 'Seo.Blog.Misc.installSetupDocs'),
      description: readBlogMessage(t, 'Seo.Blog.Misc.seeInstallSetup'),
      href: `/${locale}/docs`,
    },
    {
      title: readBlogMessage(t, 'Seo.Blog.Misc.browseWorkflowCollections'),
      description: readBlogMessage(t, 'Seo.Blog.Misc.exploreFullerTemplate'),
      href: `/${locale}/collections`,
    },
  ];
}

export function getBlogMetaOverride(slug: string, t: (k: string, fb?: string) => string): BlogMetaOverride | null {
  const title = readBlogMessage(t, `Seo.Blog.MetaOverride.${slug}.title`);
  const description = readBlogMessage(t, `Seo.Blog.MetaOverride.${slug}.description`);
  if (!title) return null;
  return { title, description };
}
