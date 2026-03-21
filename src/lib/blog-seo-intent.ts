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

const LOCALIZED_BLOG_OVERRIDES: Record<string, Record<Locale, BlogMetaOverride | null>> = {
  'mastering-pdf-automation-with-ai-skills': {
    en: {
      title: 'PDF Automation with AI: OCR, Extraction & Report Workflows',
      description:
        'Automate PDFs with AI for OCR, table extraction, and report generation. See install steps, real workflows, and the best skill for document automation.',
    },
    zh: {
      title: 'AI PDF 自动化：OCR、提取与报告工作流',
      description:
        '使用 AI 自动化 PDF 处理，实现 OCR、表格提取和报告生成。查看安装步骤、真实工作流以及最佳文档自动化技能。',
    },
    ja: {
      title: 'AI PDF 自動化：OCR、抽出、レポートワークフロー',
      description:
        'AI で PDF を自動化して OCR、テーブル抽出、レポート生成を実現。インストール手順、実際のワークフロー、ドキュメント自動化に最適なスキルをチェック。',
    },
    ko: {
      title: 'AI PDF 자동화: OCR, 추출 및 보고서 워크플로우',
      description:
        'AI로 PDF를 자동화하여 OCR, 테이블 추출, 보고서 생성을 수행합니다. 설치 단계, 실제 워크플로우, 문서 자동화를 위한 최고의 스킬을 확인하세요.',
    },
    es: {
      title: 'Automatización PDF con IA: OCR, Extracción y Flujos de Trabajo de Informes',
      description:
        'Automatiza PDFs con IA para OCR, extracción de tablas y generación de informes. Consulta los pasos de instalación, flujos de trabajo reales y las mejores skills para automatización documental.',
    },
    fr: {
      title: 'Automatisation PDF par IA: OCR, Extraction et Flux de Travail de Rapports',
      description:
        "Automatisez les PDFs avec l'IA pour l'OCR, l'extraction de tables et la génération de rapports. Consultez les étapes d'installation, les flux de travail réels et la meilleure skill pour l'automatisation documentaire.",
    },
    de: {
      title: 'KI PDF-Automatisierung: OCR, Extraktion und Berichts-Workflows',
      description:
        'Automatisieren Sie PDFs mit KI für OCR, Tabellenextrahierung und Berichtsgenerierung. Sehen Sie Installationsschritte, echte Workflows und die beste Skill für Dokumentenautomatisierung.',
    },
    pt: {
      title: 'Automação de PDF com IA: OCR, Extração e Fluxos de Trabalho de Relatórios',
      description:
        'Automatize PDFs com IA para OCR, extração de tabelas e geração de relatórios. Veja etapas de instalação, fluxos de trabalho reais e a melhor skill para automação de documentos.',
    },
    ru: {
      title: 'Автоматизация PDF с ИИ: OCR, Извлечение и Рабочие Процессы Отчетов',
      description:
        'Автоматизируйте PDF с помощью ИИ для OCR, извлечения таблиц и генерации отчетов. Смотрите шаги установки, реальные рабочие процессы и лучшие навыки для автоматизации документов.',
    },
    ar: {
      title: 'أتمتة PDF بالذكاء الاصطناعي: OCR واستخراج وتقارير سير العمل',
      description:
        'أتمتة PDF بالذكاء الاصطناعي لـ OCR واستخراج الجداول وتوليد التقارير. راجع خطوات التثبيت وسير العمل الفعلي وأفضل مهارة لأتمتة المستندات.',
    },
  },
  'how-to-build-mcp-servers-with-agent-skills': {
    en: {
      title: 'Skills for Developer Workflows: Build MCP Integrations in Claude Code or Cursor',
      description:
        'Build MCP integrations for Claude Code or Cursor with reusable AI agent skill workflows, step-by-step setup, tool design, testing, and deployment patterns.',
    },
    zh: {
      title: '开发工作流技能：在 Claude Code 或 Cursor 中构建 MCP 集成',
      description:
        '使用可复用的 AI Agent Skill 工作流，在 Claude Code 或 Cursor 中构建 MCP 集成，包含逐步设置、工具设计、测试和部署模式。',
    },
    ja: {
      title: '開発者向けワークフロースキル: Claude CodeまたはCursorでMCP統合を構築',
      description:
        '再利用可能なAIエージェントスキルワークフローでClaude CodeまたはCursorにMCP統合を構築。ステップバイステップのセットアップ、ツール設計、テスト、デプロイパターンを紹介。',
    },
    ko: {
      title: '개발자 워크플로우 스킬: Claude Code 또는 Cursor에서 MCP 통합 구축',
      description:
        '재사용 가능한 AI 에이전트 스킬 워크플로우로 Claude Code 또는 Cursor에서 MCP 통합을 구축합니다. 단계별 설정, 도구 설계, 테스트 및 배포 패턴을 확인하세요.',
    },
    es: {
      title: 'Skills para Flujos de Trabajo de Desarrolladores: Construye Integraciones MCP en Claude Code o Cursor',
      description:
        'Construye integraciones MCP en Claude Code o Cursor con flujos de trabajo de skills de agentes de IA reutilizables, configuración paso a paso, diseño de herramientas, pruebas y patrones de despliegue.',
    },
    fr: {
      title: 'Skills pour Flux de Travail Développeurs: Construire des Intégrations MCP dans Claude Code ou Cursor',
      description:
        "Construisez des intégrations MCP dans Claude Code ou Cursor avec des flux de travail de skills d'agents IA réutilisables, configuration paso a paso, conception d'outils, tests et modèles de déploiement.",
    },
    de: {
      title: 'Skills für Entwickler-Workflows: MCP-Integrationen in Claude Code oder Cursor erstellen',
      description:
        'Erstellen Sie MCP-Integrationen in Claude Code oder Cursor mit wiederverwendbaren KI-Agenten-Skill-Workflows, Schritt-für-Schritt-Setup, Tool-Design, Tests und Bereitstellungsmustern.',
    },
    pt: {
      title: 'Skills para Fluxos de Trabalho de Desenvolvedores: Construa Integrações MCP no Claude Code ou Cursor',
      description:
        'Construa integrações MCP no Claude Code ou Cursor com fluxos de trabalho de skills de agentes de IA reutilizáveis, configuração passo a passo, design de ferramentas, testes e padrões de implantação.',
    },
    ru: {
      title: 'Навыки для Рабочих Процессов Разработчиков: Создание MCP-интеграций в Claude Code или Cursor',
      description:
        'Создавайте MCP-интеграции в Claude Code или Cursor с помощью многократно используемых рабочих процессов навыков ИИ-агентов, пошаговой настройки, проектирования инструментов, тестирования и шаблонов развертывания.',
    },
    ar: {
      title: 'مهارات سير عمل المطورين: بناء تكاملات MCP في Claude Code أو Cursor',
      description:
        'بناء تكاملات MCP في Claude Code أو Cursor مع سير عمل مهارات وكيل الذكاء الاصطناعي القابلة لإعادة الاستخدام وإعداد خطوة بخطوة وتصميم الأدوات والاختبار وأنماط النشر.',
    },
  },
  'how-to-install-ai-agent-skills': {
    en: {
      title: 'How to Install AI Agent Skills in Cursor, Claude Code, or Windsurf',
      description:
        'Install AI agent skills in Cursor, Claude Code, or Windsurf with npx killer-skills add. Follow the fastest setup for one IDE or all of them.',
    },
    zh: {
      title: '如何在 Cursor、Claude Code 或 Windsurf 中安装 AI Agent Skills',
      description:
        '使用 npx killer-skills add 在 Cursor、Claude Code 或 Windsurf 中安装 AI Agent Skills。遵循最快设置，快速配置一个或所有 IDE。',
    },
    ja: {
      title: 'Cursor、Claude Code、Windsurf に AI Agent Skills をインストールする方法',
      description:
        'npx killer-skills add で Cursor、Claude Code、Windsurf に AI Agent Skills をインストール。1つのIDEまたはすべてのIDEへの最速セットアップを解説します。',
    },
    ko: {
      title: 'Cursor, Claude Code 또는 Windsurf에 AI Agent Skills를 설치하는 방법',
      description:
        'npx killer-skills add를 사용하여 Cursor, Claude Code 또는 Windsurf에 AI Agent Skills를 설치합니다. 하나의 IDE 또는 모든 IDE에 대한 가장 빠른 설정을 따르세요.',
    },
    es: {
      title: 'Cómo Instalar AI Agent Skills en Cursor, Claude Code o Windsurf',
      description:
        'Instala AI agent skills en Cursor, Claude Code o Windsurf con npx killer-skills add. Sigue la configuración más rápida para un IDE o para todos.',
    },
    fr: {
      title: 'Comment Installer les AI Agent Skills dans Cursor, Claude Code ou Windsurf',
      description:
        'Installez les AI agent skills dans Cursor, Claude Code ou Windsurf avec npx killer-skills add. Suivez la configuration la plus rapide pour un IDE ou pour tous.',
    },
    de: {
      title: 'So Installieren Sie AI Agent Skills in Cursor, Claude Code oder Windsurf',
      description:
        'Installieren Sie AI Agent Skills in Cursor, Claude Code oder Windsurf mit npx killer-skills add. Folgen Sie dem schnellsten Setup für eine oder alle IDEs.',
    },
    pt: {
      title: 'Como Instalar AI Agent Skills no Cursor, Claude Code ou Windsurf',
      description:
        'Instale AI agent skills no Cursor, Claude Code ou Windsurf com npx killer-skills add. Siga a configuração mais rápida para um IDE ou para todos.',
    },
    ru: {
      title: 'Как Установить AI Agent Skills в Cursor, Claude Code или Windsurf',
      description:
        'Установите AI Agent Skills в Cursor, Claude Code или Windsurf с помощью npx killer-skills add. Следуйте самой быстрой настройке для одной или всех IDE.',
    },
    ar: {
      title: 'كيفية تثبيت مهارات وكيل الذكاء الاصطناعي في Cursor أو Claude Code أو Windsurf',
      description:
        'تثبيت مهارات وكيل الذكاء الاصطناعي في Cursor أو Claude Code أو Windsurf باستخدام npx killer-skills add. اتبع الإعداد الأسرع لبيئة تطوير واحدة أو جميعها.',
    },
  },
  'top-10-mcp-servers-2026': {
    en: {
      title: '10 MCP Tools & Integrations for Claude Code, Cursor, and Windsurf',
      description:
        'Explore practical MCP tools, integrations, and workflow patterns for Claude Code, Cursor, and Windsurf across GitHub, SQLite, browser automation, and docs.',
    },
    zh: {
      title: '2026 年 Claude Code、Cursor 和 Windsurf 的 10 大 MCP 工具与集成',
      description:
        '探索 Claude Code、Cursor 和 Windsurf 的实用 MCP 工具、集成与工作流模式，覆盖 GitHub、SQLite、浏览器自动化和文档处理。',
    },
    ja: {
      title: '2026年のClaude Code、Cursor、Windsurf向けMCPツール＆統合トップ10',
      description:
        'GitHub、SQLite、ブラウザ自動化、ドキュメントにわたるClaude Code、Cursor、Windsurf向けの実用的なMCPツール、統合、ワークフローパターンを探ります。',
    },
    ko: {
      title: 'Claude Code, Cursor 및 Windsurf용 상위 10 MCP 도구 및 통합',
      description:
        'GitHub, SQLite, 브라우저 자동화, 문서를 넘어 Claude Code, Cursor 및 Windsurf를 위한 실용적인 MCP 도구, 통합, 워크플로우 패턴을 탐색합니다.',
    },
    es: {
      title: '10 Mejores Herramientas e Integraciones MCP para Claude Code, Cursor y Windsurf',
      description:
        'Explora herramientas MCP prácticas, integraciones y patrones de flujo de trabajo para Claude Code, Cursor y Windsurf en GitHub, SQLite, automatización de navegador y documentación.',
    },
    fr: {
      title: 'Top 10 des Outils et Intégrations MCP pour Claude Code, Cursor et Windsurf',
      description:
        'Explorez des outils MCP pratiques, des intégrations et des modèles de flux de travail pour Claude Code, Cursor et Windsurf sur GitHub, SQLite, automatisation du navigateur et documentation.',
    },
    de: {
      title: 'Top 10 MCP-Tools und -Integrationen für Claude Code, Cursor und Windsurf',
      description:
        'Entdecken Sie praktische MCP-Tools, Integrationen und Workflow-Muster für Claude Code, Cursor und Windsurf über GitHub, SQLite, Browser-Automatisierung und Dokumentation.',
    },
    pt: {
      title: 'Top 10 Ferramentas e Integrações MCP para Claude Code, Cursor e Windsurf',
      description:
        'Explore ferramentas MCP práticas, integrações e padrões de fluxo de trabalho para Claude Code, Cursor e Windsurf em GitHub, SQLite, automação de navegador e documentação.',
    },
    ru: {
      title: 'Топ-10 Инструментов и Интеграций MCP для Claude Code, Cursor и Windsurf',
      description:
        'Исследуйте практичные инструменты MCP, интеграции и шаблоны рабочих процессов для Claude Code, Cursor и Windsurf: GitHub, SQLite, автоматизация браузера и документация.',
    },
    ar: {
      title: 'أفضل 10 أدوات وتكاملات MCP لـ Claude Code و Cursor و Windsurf',
      description:
        'استكشف أدوات وتكاملات وأنماط سير عمل MCP العملية لـ Claude Code و Cursor و Windsurf عبر GitHub و SQLite وأتمتة المستعرض والتوثيق.',
    },
  },
  'official-ai-agent-skills-guide': {
    en: {
      title: 'Official AI Agent Skills to Install Right Now',
      description:
        'Find official AI agent skills for PDFs, frontend UI, SEO, MCP, and automation, plus which ones to install first for real work.',
    },
    zh: {
      title: '立即安装的官方 AI Agent Skills 指南',
      description: '查找 PDF、前端 UI、SEO、MCP 和自动化的官方 AI Agent Skills，以及哪些技能应该优先安装用于实际工作。',
    },
    ja: {
      title: '今すぐインストールすべき公式AI Agent Skills',
      description:
        'PDF、フロントエンドUI、SEO、MCP、自動化向けの公式AI Agent Skillsを見つけ、実際の作業に最初にインストールすべきスキルを確認。',
    },
    ko: {
      title: '지금 바로 설치해야 할 공식 AI Agent Skills',
      description:
        'PDF, 프론트엔드 UI, SEO, MCP 및 자동화를 위한 공식 AI Agent Skills를 찾고 실제 작업에 먼저 설치할 스킬을 확인하세요.',
    },
    es: {
      title: 'Guía de AI Agent Skills Oficiales para Instalar Ahora Mismo',
      description:
        'Encuentra skills oficiales de IA para PDFs, UI frontend, SEO, MCP y automatización, además de cuáles instalar primero para trabajo real.',
    },
    fr: {
      title: 'Guide des AI Agent Skills Officiels à Installer Maintenant',
      description:
        "Trouvez les skills officiels d'IA pour les PDFs, l'UI frontend, le SEO, le MCP et l'automatisation, plus lesquels installer en premier pour un vrai travail.",
    },
    de: {
      title: 'Offizielle AI Agent Skills zum Jetzt-Installieren',
      description:
        'Finden Sie offizielle AI Agent Skills für PDFs, Frontend-UI, SEO, MCP und Automatisierung, plus welche zuerst für echte Arbeit installiert werden sollten.',
    },
    pt: {
      title: 'Guia de AI Agent Skills Oficiais para Instalar Agora',
      description:
        'Encontre skills oficiais de IA para PDFs, UI frontend, SEO, MCP e automação, além de quais instalar primeiro para trabalho real.',
    },
    ru: {
      title: 'Официальные AI Agent Skills для Установки Прямо Сейчас',
      description:
        'Найдите официальные AI Agent Skills для PDF, фронтенд-интерфейса, SEO, MCP и автоматизации, а также какие из них установить в первую очередь для реальной работы.',
    },
    ar: {
      title: 'دليل مهارات وكيل الذكاء الاصطناعي الرسمية للتثبيت الآن',
      description:
        'ابحث عن مهارات الذكاء الاصطناعي الرسمية لـ PDF وواجهة المستخدم الأمامية وSEO وMCP والأتمتة، بالإضافة إلى المهارات التي يجب تثبيتها أولاً للعمل الفعلي.',
    },
  },
  'what-are-ai-agent-skills': {
    en: {
      title: 'What Are AI Agent Skills? How They Work in Claude Code, Cursor & Windsurf',
      description:
        'Understand what AI agent skills are, how SKILL.md files work, where to place them, and why they help Claude Code, Cursor, and Windsurf.',
    },
    zh: {
      title: '什么是 AI Agent Skills？它们如何在 Claude Code、Cursor 和 Windsurf 中工作',
      description:
        '了解什么是 AI agent skills、SKILL.md 文件如何工作、放在哪里，以及为什么它们能帮助 Claude Code、Cursor 和 Windsurf。',
    },
    ja: {
      title: 'AI Agent Skillsとは？Claude Code、Cursor、Windsurfでの動作仕組み',
      description:
        'AI Agent Skills の概要、SKILL.md ファイルの動作、配置場所、Claude Code、Cursor、Windsurf への効果について説明します。',
    },
    ko: {
      title: 'AI Agent Skills란? Claude Code, Cursor 및 Windsurf에서의 작동 방식',
      description:
        'AI Agent Skills가 무엇인지, SKILL.md 파일이 어떻게 작동하는지, 어디에 배치해야 하는지, 그리고 Claude Code, Cursor 및 Windsurf에 어떻게 도움이 되는지 이해하세요.',
    },
    es: {
      title: '¿Qué son las AI Agent Skills? Cómo Funcionan en Claude Code, Cursor y Windsurf',
      description:
        'Comprende qué son las AI agent skills, cómo funcionan los archivos SKILL.md, dónde colocarlos y por qué ayudan a Claude Code, Cursor y Windsurf.',
    },
    fr: {
      title: 'Que Sont les AI Agent Skills? Comment Elles Fonctionnent dans Claude Code, Cursor et Windsurf',
      description:
        'Comprenez ce que sont les AI agent skills, comment fonctionnent les fichiers SKILL.md, où les placer et pourquoi elles aident Claude Code, Cursor et Windsurf.',
    },
    de: {
      title: 'Was Sind AI Agent Skills? Wie Sie in Claude Code, Cursor und Windsurf Funktionieren',
      description:
        'Verstehen Sie, was AI Agent Skills sind, wie SKILL.md-Dateien funktionieren, wo Sie sie platzieren und warum sie Claude Code, Cursor und Windsurf helfen.',
    },
    pt: {
      title: 'O Que São AI Agent Skills? Como Funcionam em Claude Code, Cursor e Windsurf',
      description:
        'Entenda o que são AI agent skills, como funcionam os arquivos SKILL.md, onde colocá-los e por que eles ajudam Claude Code, Cursor e Windsurf.',
    },
    ru: {
      title: 'Что Такое AI Agent Skills? Как Они Работают в Claude Code, Cursor и Windsurf',
      description:
        'Поймите, что такое AI Agent Skills, как работают файлы SKILL.md, куда их поместить и почему они помогают Claude Code, Cursor и Windsurf.',
    },
    ar: {
      title: 'ما هي مهارات وكيل الذكاء الاصطناعي؟ كيف تعمل في Claude Code و Cursor و Windsurf',
      description:
        'فهم ماهية مهارات وكيل الذكاء الاصطناعي وكيف تعمل ملفات SKILL.md وأين يجب وضعها ولماذا تساعد Claude Code و Cursor و Windsurf.',
    },
  },
  'best-ai-agent-skills-2026': {
    en: {
      title: 'AI Agent Skills for Claude Code, Cursor & Windsurf (2026)',
      description:
        'Compare AI agent skills for Claude Code, Cursor, and Windsurf in 2026, from document automation and UI to MCP and workflows.',
    },
    zh: {
      title: '2026 年 Claude Code、Cursor 和 Windsurf 的 AI Agent Skills 精选',
      description:
        '比较 2026 年 Claude Code、Cursor 和 Windsurf 的 AI Agent Skills，从文档自动化和 UI 到 MCP 与工作流。',
    },
    ja: {
      title: '2026年のClaude Code、Cursor、Windsurf向AI Agent Skills',
      description:
        '2026年のClaude Code、Cursor、Windsurf向AI Agent Skillsを比較。ドキュメント自動化やUIからMCP、ワークフローまで。',
    },
    ko: {
      title: 'Claude Code, Cursor 및 Windsurf용 AI Agent Skills 2026',
      description:
        '2026년 Claude Code, Cursor 및 Windsurf용 AI Agent Skills를 비교합니다. 문서 자동화 및 UI부터 MCP 및 워크플로우까지.',
    },
    es: {
      title: 'AI Agent Skills para Claude Code, Cursor y Windsurf (2026)',
      description:
        'Compara AI agent skills para Claude Code, Cursor y Windsurf en 2026, desde automatización de documentos y UI hasta MCP y flujos de trabajo.',
    },
    fr: {
      title: 'AI Agent Skills pour Claude Code, Cursor et Windsurf (2026)',
      description:
        "Comparez les AI agent skills pour Claude Code, Cursor et Windsurf en 2026, de l'automatisation documentaire et l'UI aux MCP et workflows.",
    },
    de: {
      title: 'AI Agent Skills für Claude Code, Cursor und Windsurf (2026)',
      description:
        'Vergleichen Sie AI Agent Skills für Claude Code, Cursor und Windsurf im Jahr 2026, von Dokumentenautomatisierung und UI bis hin zu MCP und Workflows.',
    },
    pt: {
      title: 'AI Agent Skills para Claude Code, Cursor e Windsurf (2026)',
      description:
        'Compare AI agent skills para Claude Code, Cursor e Windsurf em 2026, de automação de documentos e UI até MCP e fluxos de trabalho.',
    },
    ru: {
      title: 'AI Agent Skills для Claude Code, Cursor и Windsurf (2026)',
      description:
        'Сравните AI Agent Skills для Claude Code, Cursor и Windsurf в 2026 году: от автоматизации документов и пользовательского интерфейса до MCP и рабочих процессов.',
    },
    ar: {
      title: 'مهارات وكيل الذكاء الاصطناعي لـ Claude Code و Cursor و Windsurf (2026)',
      description:
        'قارن مهارات وكيل الذكاء الاصطناعي لـ Claude Code و Cursor و Windsurf في عام 2026، من أتمتة المستندات وواجهة المستخدم إلى MCP وسير العمل.',
    },
  },
  'claude-code-vs-cursor-vs-windsurf': {
    en: {
      title: 'Claude Code vs Cursor vs Windsurf for AI Agent Skills',
      description:
        'Compare Claude Code, Cursor, and Windsurf for AI agent skills, including file formats, loading behavior, context limits, and setup tradeoffs.',
    },
    zh: {
      title: 'Claude Code vs Cursor vs Windsurf：AI Agent Skills 对比',
      description:
        '对比 Claude Code、Cursor 和 Windsurf 的 AI Agent Skills 支持度，包括文件格式、加载行为、上下文限制和设置权衡。',
    },
    ja: {
      title: 'Claude Code vs Cursor vs Windsurf：AI Agent Skills 徹底比較',
      description:
        'Claude Code、Cursor、WindsurfのAI Agent Skills対応を比較。ファイル形式、読み込み動作コンテキスト制限、セットアップのトレードオフを含む。',
    },
    ko: {
      title: 'Claude Code vs Cursor vs Windsurf: AI Agent Skills 비교',
      description:
        '파일 형식, 로딩 동작, 컨텍스트 제한, 설정 트레이드오프를 포함하여 Claude Code, Cursor, Windsurf용 AI Agent Skills를 비교합니다.',
    },
    es: {
      title: 'Claude Code vs Cursor vs Windsurf para AI Agent Skills',
      description:
        'Compara Claude Code, Cursor y Windsurf para AI agent skills, incluyendo formatos de archivo, comportamiento de carga, límites de contexto y desventajas de configuración.',
    },
    fr: {
      title: 'Claude Code vs Cursor vs Windsurf pour les AI Agent Skills',
      description:
        'Comparez Claude Code, Cursor et Windsurf pour les AI agent skills, incluant les formats de fichiers, le comportement de chargement, les limites de contexte et les compromis de configuration.',
    },
    de: {
      title: 'Claude Code vs Cursor vs Windsurf für AI Agent Skills',
      description:
        'Vergleichen Sie Claude Code, Cursor und Windsurf für AI Agent Skills, einschließlich Dateiformate, Ladeverhalten, Kontextlimits und Setup-Kompromisse.',
    },
    pt: {
      title: 'Claude Code vs Cursor vs Windsurf para AI Agent Skills',
      description:
        'Compare Claude Code, Cursor e Windsurf para AI agent skills, incluindo formatos de arquivo, comportamento de carregamento, limites de contexto e tradeoffs de configuração.',
    },
    ru: {
      title: 'Claude Code vs Cursor vs Windsurf для AI Agent Skills',
      description:
        'Сравните Claude Code, Cursor и Windsurf для AI Agent Skills, включая форматы файлов, поведение при загрузке, ограничения контекста и компромиссы в настройке.',
    },
    ar: {
      title: 'Claude Code مقابل Cursor مقابل Windsurf لمهارات وكيل الذكاء الاصطناعي',
      description:
        'قارن Claude Code و Cursor و Windsurf لمهارات وكيل الذكاء الاصطناعي، بما في ذلك تنسيقات الملفات وسلوك التحميل وقيود السياق وتنازلات الإعداد.',
    },
  },
};

export function getBlogMetaOverride(locale: Locale, slug: string): BlogMetaOverride | null {
  const slugOverrides = LOCALIZED_BLOG_OVERRIDES[slug];
  if (!slugOverrides) return null;

  return slugOverrides[locale] ?? slugOverrides['en'] ?? null;
}

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
      ? ['安装 AI Agent Skills', '技能配置指南', 'IDE 兼容']
      : ['install ai agent skills', 'skill setup guide', 'ide compatibility'];
  }

  return isZh
    ? ['工作流自动化', 'AI Agent Skills 教程', '技能模板']
    : ['workflow automation', 'ai agent skills guide', 'skill templates'];
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
