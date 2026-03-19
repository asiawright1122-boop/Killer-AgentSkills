import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import zh from '../messages/zh.json';

const readPageSource = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('public links and navigation copy', () => {
  it('keeps community navigation wired to a live community page', () => {
    expect(en.Footer.community).toBe('Community');
    expect(zh.Footer.community).toBe('社区');
  });

  it('keeps evergreen blog counts aligned with current public totals', () => {
    const locales = ['ar', 'de', 'en', 'es', 'fr', 'ja', 'ko', 'pt', 'ru', 'zh'];
    const slugs = [
      'announcing-killer-skills',
      'best-ai-agent-skills-2026',
      'introducing-openclaw-autonomous-ai-agent',
      'official-ai-agent-skills-guide',
      'what-are-ai-agent-skills',
    ];
    const staleCountPatterns = [
      /15\+/,
      /over 15/i,
      /mehr als 15/i,
      /über 15/i,
      /más de 15/i,
      /plus de 15/i,
      /mais de 15/i,
      /15 多个/,
      /15以上/,
      /15개 이상의/,
      /более чем 15/i,
      /أكثر من 15/,
      /1,000/,
      /1\.000/,
      /1 000/,
      /1000/,
    ];

    for (const locale of locales) {
      for (const slug of slugs) {
        const source = readPageSource(`../content/blog/${locale}/${slug}.md`);

        for (const pattern of staleCountPatterns) {
          expect(source).not.toMatch(pattern);
        }
      }
    }
  });

  it('keeps template-generated MCP blog boilerplate out of public articles', () => {
    const slugs = [
      'claude-code-vs-cursor-mcp-comparison',
      'deploy-mcp-server-to-cloudflare-workers',
      'langchain-vs-mcp-ai-integration',
      'mcp-authentication-guide-secure-setup',
      'mcp-server-not-working-troubleshooting-guide',
      'mcp-server-security-best-practices',
      'mcp-vs-rest-api-comparison',
      'testing-mcp-servers-comprehensive-guide',
    ];
    const stalePatterns = [
      'This guide will walk you through everything you need to know.',
      'Start by exploring our collection of MCP servers and follow our installation guides.',
      'Yes, when properly configured with authentication and security best practices, MCP servers are suitable for production environments.',
      "Let's begin by understanding the fundamentals.",
      '**First Step**: Install the required dependencies',
      '**Issue 1**: Connection timeout',
      'By following this guide, you should now have a solid understanding of',
      '## Introduction',
      '## Prerequisites',
      'Before getting started, make sure you have:',
      '### What is MCP?',
      '### How do I get started with MCP?',
      '### Is MCP secure for production use?',
      '*Have questions? Join our community on Discord or check out our documentation for more resources.*',
      'MCP (Model Context Protocol) is an open protocol that enables AI applications to connect to external data sources and tools securely.',
      'Step-by-step tutorial on deploying your MCP server to Cloudflare Workers. Save costs, improve latency, and scale automatically with edge computing.',
      'A comprehensive comparison between Model Context Protocol (MCP) and traditional REST APIs. Learn when to use MCP servers vs REST endpoints for your AI agent applications.',
      'Learn how to properly configure authentication for your MCP servers. This guide covers API keys, OAuth, token-based auth, and best practices for securing your AI agent integrations.',
      'Having issues with your MCP server? This comprehensive troubleshooting guide covers common errors, connection problems, and step-by-step solutions to get your Model Context Protocol server working again.',
      'Learn various testing strategies for MCP servers including unit tests, integration tests, mocking, and CI/CD automation. Build reliable AI agent integrations.',
    ];

    for (const slug of slugs) {
      const source = readPageSource(`../content/blog/en/${slug}.md`);

      for (const pattern of stalePatterns) {
        expect(source).not.toContain(pattern);
      }
    }
  });

  it('keeps chinese MCP blog translations free of machine-generated boilerplate', () => {
    const slugs = [
      'claude-code-vs-cursor-mcp-comparison',
      'deploy-mcp-server-to-cloudflare-workers',
      'langchain-vs-mcp-ai-integration',
      'mcp-authentication-guide-secure-setup',
      'mcp-server-not-working-troubleshooting-guide',
      'mcp-server-security-best-practices',
      'mcp-vs-rest-api-comparison',
      'testing-mcp-servers-comprehensive-guide',
      'how-to-build-mcp-servers-with-agent-skills',
    ];
    const stalePatterns = [
      '本指南将指导您了解所需的所有知识。',
      '本指南将带您了解您需要知道的一切。',
      '本指南将带您了解所有需要知道的内容。',
      '本指南将指导您完成所需的所有步骤。',
      '让我们从理解基础开始。',
      '让我们从理解基础知识开始。',
      '让我们从了解基础开始。',
      '首先，探索我们的 MCP 服务器集合，并按照我们的安装指南进行操作。',
      '首先探索我们的 MCP 服务器集合并按照我们的安装指南操作。',
      '当正确配置了身份验证和安全最佳实践时，MCP 服务器适合生产环境。',
      '当根据身份验证和最佳安全实践正确配置时，MCP 服务器适用于生产环境。',
      '### 步骤指南',
      '### 分步指南',
      '### 常见问题和解决方案',
      '### 常见问题与解决方案',
      '## FAQ',
      '## 常见问题',
      '### 什么是MCP？',
      '### 什么是 MCP？',
      '### 如何开始使用MCP？',
      '### 如何开始使用 MCP？',
      '### MCP是否适合生产环境？',
      '### MCP 是否适合生产环境？',
      '* 有问题？加入我们的Discord社区或查看我们的文档以获取更多资源。',
      '* 有问题？加入我们的 Discord 社区或查看我们的文档以获取更多资源。',
      '*有疑问？请加入我们的 Discord 社区或查看我们的文档以获取更多资源。',
    ];

    for (const slug of slugs) {
      const source = readPageSource(`../content/blog/zh/${slug}.md`);

      for (const pattern of stalePatterns) {
        expect(source).not.toContain(pattern);
      }
    }
  });

  it('keeps major non-english MCP blog translations free of machine-generated boilerplate', () => {
    const localePatterns = [
      {
        locale: 'de',
        patterns: [
          'Dieser Leitfaden führt Sie durch alles, was Sie wissen müssen.',
          'Diese Anleitung führt Sie durch alles, was Sie wissen müssen.',
          'Lassen Sie uns mit dem Verständnis der Grundlagen beginnen.',
          'Beginnen Sie damit, unsere Sammlung von MCP-Servern zu erkunden und folgen Sie unseren Installationsanleitungen.',
          'Ja, wenn MCP-Server richtig konfiguriert sind',
          '## Einführung',
          '### Schritt-für-Schritt-Anleitung',
          '### Häufige Probleme und Lösungen',
          '## FAQ',
          '### Was ist MCP?',
          '### Wie komme ich mit MCP los?',
          '### Ist MCP für den Produktiveinsatz sicher?',
          '*Haben Sie Fragen? Treten Sie unserer Community auf Discord bei oder überprüfen Sie unsere Dokumentation',
        ],
      },
      {
        locale: 'es',
        patterns: [
          'Esta guía te guiará a través de todo lo que necesitas saber.',
          'Esta guía te llevará a través de todo lo que necesitas saber.',
          'Esta guía lo llevará a través de todo lo que necesita saber.',
          'En esta guía, aprenderá todo lo que necesita saber sobre la construcción de servidores MCP',
          '## Introducción: Crea tu primer servidor MCP',
          '### Paso 1: Instala la habilidad',
          '### Paso 2: Elige tu pila',
          '### Paso 3: Define tus herramientas',
          '### Paso 4: Implementa las mejores prácticas',
          'Comencemos por entender los conceptos básicos.',
          'Comience explorando nuestra colección de servidores MCP y siga nuestras guías de instalación.',
          'Sí, cuando se configura correctamente con autenticación',
          '## Introducción',
          '## Requisitos previos',
          'Antes de empezar, asegúrate de tener:',
          '- Comprensión básica de agentes de inteligencia artificial y LLMs',
          '- Conocimiento básico de agentes de inteligencia artificial y LLMs',
          '- Node.js o Python instalado en tu máquina',
          '- Acceso a tu editor de código preferido',
          '### Guía Paso a Paso',
          '### Problemas Comunes y Soluciones',
          '## Preguntas frecuentes',
          '### ¿Qué es MCP?',
          '### ¿Cómo comienzo con MCP?',
          '### ¿Cómo empezar con MCP?',
          '### ¿Es MCP seguro para uso en producción?',
          '* ¿Tiene preguntas? Únete a nuestra comunidad en Discord o consulta nuestra documentación',
          '* ¿Tienes preguntas? Únete a nuestra comunidad en Discord o consulta nuestra documentación',
        ],
      },
      {
        locale: 'ja',
        patterns: [
          'このガイドでは、必要なすべてのことを説明します。',
          'このガイドでは、MCPサーバーの構築方法について、プロトコルを理解することから最初のサーバーのデプロイまで、必要なすべてのことを学習します。',
          '## Why Use the mcp-builder Skill?',
          '## Getting Started: Build Your First MCP Server',
          '### Step 1: Install the Skill',
          '### Step 2: Choose Your Stack',
          '### Step 3: Define Your Tools',
          '### Step 4: Implement Best Practices',
          'The skill will be added to your `.claude/skills/` directory and automatically activated when Claude detects MCP server development tasks.',
          'The mcp-builder skill supports two primary stacks:',
          '基本を理解することから始めましょう。',
          'MCPサーバーのコレクションを調べ',
          'MCPサーバーは本番環境に適しています。',
          'Before getting started, make sure you have:',
          '### ステップバイステップガイド',
          '### 共通の問題と解決策',
          '## FAQ',
          '### MCPとは何か？',
          '### MCPを始めるにはどうすれば',
          '### MCPは本番環境',
          '*質問がある場合は',
          '* 質問がある場合は',
        ],
      },
      {
        locale: 'ru',
        patterns: [
          'Этот гид проведет вас через все, что вам нужно знать.',
          'Давайте начнем с понимания основ.',
          'Начните с изучения нашей коллекции серверов MCP',
          'серверы MCP подходят для производственных сред',
          '### Пошаговое Руководство',
          '### Распространенные Проблемы и Решения',
          '## FAQ',
          '### Что такое MCP?',
          '### Как начать',
          '### Подходит ли MCP для производственного использования?',
          '* У вас есть вопросы? Присоединяйтесь к нашему сообществу в Discord',
        ],
      },
      {
        locale: 'fr',
        patterns: [
          'Cette guide',
          'Ce guide vous guidera à travers tout ce que vous devez savoir.',
          '## Introduction',
          '## Prérequis',
          '### Guide étape par étape',
          '### Problèmes courants et solutions',
          '## FAQ',
          "### Qu'est-ce que MCP ?",
          '### Comment démarrer avec MCP',
          '### MCP est-il sécurisé pour une utilisation en production ?',
        ],
      },
      {
        locale: 'pt',
        patterns: [
          'Neste guia, você aprenderá tudo o que precisa saber sobre a construção de servidores MCP',
          '## Introdução: Construa Seu Primeiro Servidor MCP',
          '### Etapa 1: Instalar a Habilidade',
          '### Etapa 2: Escolha Sua Pilha',
          '### Etapa 3: Definir Ferramentas',
          '### Etapa 4: Implementar Melhores Práticas',
          '### O que é MCP?',
          '### O MCP é seguro para uso em produção?',
          '## FAQ',
        ],
      },
      {
        locale: 'ko',
        patterns: [
          '이 가이드에서는 MCP 서버 구축에 필요한 모든 것을 배울 수 있습니다.',
          '## MCP-빌더 スキルの 사용 이유',
          '## 시작하기: 첫 번째 MCP 서버 구축',
          '### 1단계: 스킬 설치',
          '### 2단계: 스택 선택',
          '### 3단계: 도구 정의',
          '### 4단계: 모범 사례 구현',
          '정적 타이핑은 런타임 전에 오류를 捕获합니다',
          '### 단계별 가이드',
          '## FAQ',
          '### MCP란 무엇인가요?',
          '### MCP를 시작하려면 어떻게 해야 하나요?',
          '### MCP는 프로덕션 사용에 안전한가요?',
          '이 가이드는 필요한 모든 것을 안내합니다',
          '기본 사항부터 이해해 봅시다',
          '시작하기 전에 다음을 준비하세요',
        ],
      },
      {
        locale: 'ar',
        patterns: [
          'في هذا الدليل، ستتعلم كل ما تحتاج إلى معرفته حول بناء خوادم MCP',
          '# Install the mcp-builder skill with one command',
          'هنا lý لماذا يهم MCP:',
          'xử lý الأخطاء',
          'ينشئ автоматически مجموعات اختبار لخادم MCP',
          '## البدء: إنشاء خادم MCP الأول',
          '### الخطوة 1: تثبيت المهارة',
          '### الخطوة 2: اختيار المكدس',
          '### الخطوة 3: تعريف أدواتك',
          '### الخطوة 4: تنفيذ أفضل الممارسات',
          'قبل البدء، تأكد من أن لديك:',
          '### دليل خطوة بخطوة',
          '## الأسئلة الشائعة',
          '### ما هو MCP?',
          '### كيف أبدأ باستخدام MCP?',
          '### هل MCP آمن للاستخدام في الإنتاج?',
          'سيرشدك هذا الدليل',
          'لنبدأ بفهم الأساسيات',
        ],
      },
    ];
    const slugs = [
      'claude-code-vs-cursor-mcp-comparison',
      'deploy-mcp-server-to-cloudflare-workers',
      'langchain-vs-mcp-ai-integration',
      'mcp-authentication-guide-secure-setup',
      'mcp-server-not-working-troubleshooting-guide',
      'mcp-server-security-best-practices',
      'mcp-vs-rest-api-comparison',
      'testing-mcp-servers-comprehensive-guide',
    ];

    for (const { locale, patterns } of localePatterns) {
      for (const slug of slugs) {
        const source = readPageSource(`../content/blog/${locale}/${slug}.md`);

        for (const pattern of patterns) {
          expect(source).not.toContain(pattern);
        }
      }
    }
  });

  it('keeps the how-to-build MCP server article free of cross-locale template scaffolding', () => {
    const localePatterns = [
      {
        locale: 'en',
        patterns: [
          "In this guide, you'll learn everything you need to know about building MCP servers",
          '## Getting Started: Build Your First MCP Server',
          '### Step 1: Install the Skill',
          '### Step 2: Choose Your Stack',
          '### Step 3: Define Your Tools',
          '### Step 4: Implement Best Practices',
        ],
      },
      {
        locale: 'zh',
        patterns: [
          '在本指南中，您将学习关于构建 MCP 服务器所需的所有知识',
          '### 步骤 1：安装技能',
          '### 步骤 2：选择技术栈',
          '### 步骤 3：定义你的工具',
          '### 步骤 4：实施最佳实践',
        ],
      },
      {
        locale: 'de',
        patterns: [
          'In diesem Leitfaden erfahren Sie alles, was Sie wissen müssen, um MCP-Server zu erstellen',
          '### Schritt 1: Installieren Sie die Fähigkeit',
          '### Schritt 2: Wählen Sie Ihren Stack',
          '### Schritt 3: Definieren Sie Ihre Tools',
          '### Schritt 4: Implementieren Sie Best Practices',
          'Browse die offiziellen Skills',
        ],
      },
      {
        locale: 'es',
        patterns: [
          'En esta guía, aprenderá todo lo que necesita saber sobre la construcción de servidores MCP',
          '### Paso 1: Instala la habilidad',
          '### Paso 2: Elige tu pila',
          '### Paso 3: Define tus herramientas',
          '### Paso 4: Implementa las mejores prácticas',
        ],
      },
      {
        locale: 'fr',
        patterns: [
          'Dans ce guide, vous apprendrez tout ce que vous devez savoir sur la construction de serveurs MCP',
          '### Étape 1 : Installer la Compétence',
          '### Étape 2 : Choisissez Votre Stack',
          '### Étape 3 : Définissez Vos Outils',
          '### Étape 4 : Implémentez les Meilleures Pratiques',
          "Une prise en charge de haute qualité de l'SDK officiel de l'équipe MCP",
          "à propos d'écrire plus de code",
          'annuaire des skills Killer-Skills',
        ],
      },
      {
        locale: 'ja',
        patterns: [
          'このガイドでは、MCPサーバーの構築方法について、プロトコルを理解することから最初のサーバーのデプロイまで、必要なすべてのことを学習します。',
          '## Why Use the mcp-builder Skill?',
          '## Getting Started: Build Your First MCP Server',
          '### Step 1: Install the Skill',
          '### Step 2: Choose Your Stack',
          '### Step 3: Define Your Tools',
          '### Step 4: Implement Best Practices',
          'The skill will be added to your `.claude/skills/` directory and automatically activated when Claude detects MCP server development tasks.',
          'The mcp-builder skill supports two primary stacks:',
          'The **mcp-builder** スキルは、',
          '## キーデザインプリンシプル for MCPサーバー',
          'ペジネーション',
        ],
      },
      {
        locale: 'ko',
        patterns: [
          '이 가이드에서는 MCP 서버 구축에 필요한 모든 것을 배울 수 있습니다.',
          '## MCP-빌더 スキルの 사용 이유',
          '## 시작하기: 첫 번째 MCP 서버 구축',
          '### 1단계: 스킬 설치',
          '### 2단계: 스택 선택',
          '### 3단계: 도구 정의',
          '### 4단계: 모범 사례 구현',
          '정적 타이핑은 런타임 전에 오류를 捕获합니다',
        ],
      },
      {
        locale: 'pt',
        patterns: [
          'Neste guia, você aprenderá tudo o que precisa saber sobre a construção de servidores MCP',
          '### Etapa 1: Instalar a Habilidade',
          '### Etapa 2: Escolha Sua Pilha',
          '### Etapa 3: Definir Ferramentas',
          '### Etapa 4: Implementar Melhores Práticas',
        ],
      },
      {
        locale: 'ru',
        patterns: [
          'В этом руководстве вы узнаете всё, что вам нужно знать о создании серверов MCP',
          '### Шаг 1: Установка навыка',
          '### Шаг 2: Выбор стека',
          '### Шаг 3: Определение инструментов',
          '### Шаг 4: Реализация лучших практик',
          'для消费а агентами ИИ',
          'шаблоны.paginaciонных шаблонов',
          'поля, которые агенты benötigt',
          'Claude xửляет сложность',
          '# Install the mcp-builder skill with one command',
        ],
      },
      {
        locale: 'ar',
        patterns: [
          'في هذا الدليل، ستتعلم كل ما تحتاج إلى معرفته حول بناء خوادم MCP',
          '# Install the mcp-builder skill with one command',
          'هنا lý لماذا يهم MCP:',
          'xử lý الأخطاء',
          'ينشئ автоматически مجموعات اختبار لخادم MCP',
          '### الخطوة 1: تثبيت المهارة',
          '### الخطوة 2: اختيار المكدس',
          '### الخطوة 3: تعريف أدواتك',
          '### الخطوة 4: تنفيذ أفضل الممارسات',
        ],
      },
    ];

    for (const { locale, patterns } of localePatterns) {
      const source = readPageSource(`../content/blog/${locale}/how-to-build-mcp-servers-with-agent-skills.md`);

      for (const pattern of patterns) {
        expect(source).not.toContain(pattern);
      }
    }
  });

  it('points public GitHub references at the Killer-Skills repository', () => {
    const communitySource = readPageSource('./[locale]/community/index.astro');
    const privacySource = readPageSource('./[locale]/privacy/index.astro');
    const termsSource = readPageSource('./[locale]/terms/index.astro');
    const cookiesSource = readPageSource('./[locale]/cookies/index.astro');
    const homeSource = readPageSource('./[locale]/index.astro');

    expect(communitySource).toContain('asiawright1122-boop/Killer-AgentSkills');
    expect(communitySource).not.toContain('github.com/anthropics/skills');
    expect(privacySource).toContain('asiawright1122-boop/Killer-AgentSkills/issues');
    expect(termsSource).toContain('asiawright1122-boop/Killer-AgentSkills/issues');
    expect(cookiesSource).toContain('asiawright1122-boop/Killer-AgentSkills/issues');
    expect(homeSource).toContain('asiawright1122-boop/Killer-AgentSkills');
  });

  it('keeps skill detail source free of hardcoded MCP server SEO copy', () => {
    const skillDetailSource = readPageSource('./[locale]/skills/[owner]/[...repo].astro');

    expect(skillDetailSource).toContain("typedLocale === 'zh' ? 'AI Agent Skills' : 'AI agent skills'");
    expect(skillDetailSource).not.toContain("'MCP server'");
    expect(skillDetailSource).not.toContain('MCP Server by');
  });

  it('keeps high-priority collections free of mcp-first canonical slugs and titles', () => {
    const mcpUtilitiesSource = readPageSource('../content/collections/top-mcp-mcp-servers.json');
    const mcpFrameworksSource = readPageSource('../content/collections/top-mcp-server-mcp-servers.json');
    const mcp2026Source = readPageSource('../content/collections/top-mcp-servers-2026.json');
    const communityToolsSource = readPageSource('../content/collections/top-community-mcp-servers.json');
    const testingSource = readPageSource('../content/collections/top-mcp-for-testing.json');

    expect(mcpUtilitiesSource).toContain('top-ai-agent-workflow-skills-integrations-utilities');
    expect(mcpUtilitiesSource).not.toContain('Top MCP Tools, Integrations, and Workflow Utilities');
    expect(mcpFrameworksSource).toContain('top-ai-agent-integration-frameworks-bridges-infra-tooling');
    expect(mcpFrameworksSource).not.toContain('Top MCP Server Frameworks, Bridges, and Infra Tooling');
    expect(mcp2026Source).toContain('top-ai-agent-workflow-skills-integrations-2026');
    expect(mcp2026Source).not.toContain('Top MCP Tools for AI Agent Workflows');
    expect(communityToolsSource).toContain('Top Community Skills & AI Utilities');
    expect(communityToolsSource).toContain('top-community-skills-ai-utilities');
    expect(communityToolsSource).not.toContain('Top Community MCP Tools and AI Utilities');
    expect(communityToolsSource).not.toContain('top-community-mcp-tools-ai-utilities');
    expect(communityToolsSource).not.toContain('community MCP tools');
    expect(mcpFrameworksSource).not.toContain('protocol bridges');
    expect(mcpFrameworksSource).not.toContain('protocol compatibility');
    expect(testingSource).not.toContain('generic protocol directory');
  });

  it('keeps public collection links wired to canonical collection slugs', () => {
    const collectionsIndexSource = readPageSource('./[locale]/collections/index.astro');
    const collectionsSitemapSource = readPageSource('./sitemap-collections.xml.ts');
    const homeSource = readPageSource('./[locale]/index.astro');
    const skillDetailSource = readPageSource('./[locale]/skills/[owner]/[...repo].astro');

    expect(collectionsIndexSource).toContain('getCollectionCanonicalSlug(col)');
    expect(collectionsIndexSource).toContain(
      'url: `https://killer-skills.com/${locale}/collections/${getCollectionCanonicalSlug(col)}`',
    );
    expect(collectionsIndexSource).toContain('const cleanSlug = getCollectionCanonicalSlug(col);');
    expect(collectionsIndexSource).not.toContain("col.id.replace(/\\.json$/, '')");

    expect(collectionsSitemapSource).toContain('const canonicalSlug = getCollectionCanonicalSlug(col);');
    expect(collectionsSitemapSource).toContain('const pagePath = `/collections/${canonicalSlug}`;');
    expect(collectionsSitemapSource).not.toContain("const cleanSlug = col.id.replace(/\\.json$/, '')");

    expect(homeSource).toContain('const cleanSlug = getCollectionCanonicalSlug(col);');
    expect(homeSource).toContain('href={`/${locale}/collections/${cleanSlug}`}');
    expect(homeSource).not.toContain("col.id.replace(/\\.json$/, '')");

    expect(skillDetailSource).toContain('const cleanSlug = getCollectionCanonicalSlug(col);');
    expect(skillDetailSource).toContain('href={`/${locale}/collections/${cleanSlug}`}');
    expect(skillDetailSource).not.toContain("col.id.replace(/\\.json$/, '')");
  });

  it('keeps the default skills landing heading tied to AI agent skills', () => {
    const skillsIndexSource = readPageSource('./[locale]/skills/index.astro');

    expect(skillsIndexSource).toContain("'AI Agent 技能目录'");
    expect(skillsIndexSource).toContain("'AI Agent Skills'");
    expect(skillsIndexSource).not.toContain(": t('Common.explore')");
  });

  it('keeps Discord and X links consistent across public entry points', () => {
    const communitySource = readPageSource('./[locale]/community/index.astro');
    const footerSource = readPageSource('../components/Footer.astro');
    const homeSource = readPageSource('./[locale]/index.astro');
    const llmsFullSource = readPageSource('./llms-full.txt.ts');

    expect(communitySource).toContain('https://discord.com/invite/killer-skills');
    expect(homeSource).toContain('https://discord.com/invite/killer-skills');
    expect(llmsFullSource).toContain('https://discord.com/invite/killer-skills');

    expect(communitySource).toContain('https://x.com/killerskills');
    expect(footerSource).toContain('https://x.com/killerskills');
    expect(homeSource).toContain('https://x.com/killerskills');
    expect(llmsFullSource).toContain('https://x.com/killerskills');
  });

  it('keeps docs default content aligned with skills-first onboarding', () => {
    const docsSource = readPageSource('./[locale]/docs/[...slug].astro');

    expect(docsSource).toContain(
      'Welcome to the Killer-Skills docs. Learn how to install AI agent skills, configure your IDE, and bring reusable workflows into daily development.',
    );
    expect(docsSource).toContain(
      '欢迎来到 Killer-Skills 文档。这里会带你安装 AI Agent 技能、配置 IDE，并把可复用工作流带进日常开发。',
    );
    expect(docsSource).toContain('Start with Your First Skill');
    expect(docsSource).toContain('从第一个技能开始');
    expect(docsSource).toContain('npx killer-skills add owner/repo');
    expect(docsSource).not.toContain('build your own AI skills in minutes');
    expect(docsSource).not.toContain('npx killer-skills init my-new-skill');
  });

  it('keeps english and chinese integration cards free of generic tool-review copy', () => {
    expect(en.Integrations.cards.cursor.desc).toBe('Use reusable AI agent skills directly inside Cursor.');
    expect(en.Integrations.cards.windsurf.desc).toBe('Use reusable AI agent skills directly inside Windsurf.');
    expect(en.Integrations.cards.claude.desc).toBe('Use reusable AI agent skills directly inside Claude Code.');
    expect(en.Integrations.cards.goose.desc).toBe('Use reusable AI agent skills directly inside Goose.');

    expect(zh.Integrations.cards.cursor.desc).toBe('在 Cursor 里直接使用可复用 AI Agent 技能。');
    expect(zh.Integrations.cards.windsurf.desc).toBe('在 Windsurf 里直接使用可复用 AI Agent 技能。');
    expect(zh.Integrations.cards.claude.desc).toBe('在 Claude Code 里直接使用可复用 AI Agent 技能。');
    expect(zh.Integrations.cards.goose.desc).toBe('在 Goose 里直接使用可复用 AI Agent 技能。');
  });
});
