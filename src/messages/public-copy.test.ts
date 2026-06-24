import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import ar from './ar.json';
import de from './de.json';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import ja from './ja.json';
import ko from './ko.json';
import pt from './pt.json';
import ru from './ru.json';
import zh from './zh.json';

const readPageSource = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const blockedPhrase = (...parts: string[]) => parts.join('');
const localizedMessages = [en, zh, ar, de, es, fr, ja, ko, pt, ru];
const cliMessages = [en, zh, ar, de, es, fr, ja, ko, pt, ru];
const shippedNonEnglishMessages = [ar, de, es, fr, ja, ko, pt, ru];

describe('public messages copy', () => {
  it('keeps public skill counts aligned on localized home, marketplace, and CLI pages', () => {
    for (const messages of localizedMessages) {
      expect(messages.Home.heroDesc1).toContain('3,400');
      expect(messages.Home.heroDesc1).not.toContain('1000');
      expect(messages.Marketplace.allPurposeDesc).toContain('3,400');
      expect(messages.Marketplace.allPurposeDesc).not.toContain('1000');
      expect(messages.CLI.heroDesc).toContain('3,400');
      expect(messages.CLI.heroDesc).not.toContain('1000');
    }
  });

  it('keeps translated CLI counts aligned with current public totals', () => {
    for (const messages of cliMessages) {
      expect(messages.CLI.heroDesc).toContain('3,400');
      expect(messages.CLI.heroDesc).not.toContain('1000');
      expect(messages.CLI.terminal.syncDesc).toContain('19');
      expect(messages.CLI.terminal.syncDesc).not.toContain('17');
      expect(messages.CLI.comparison.row1).toContain('19');
      expect(messages.CLI.comparison.row1).not.toContain('17');
    }
  });

  it('avoids overstating isolated execution in translated CLI security copy', () => {
    expect(en.CLI.features.secure.desc.toLowerCase()).not.toContain('isolated environments');
    expect(zh.CLI.features.secure.desc).not.toContain('隔离环境');
    expect(ar.CLI.features.secure.desc).not.toContain('بيئات معزولة');
    expect(de.CLI.features.secure.desc).not.toContain('isolierten Umgebungen');
    expect(es.CLI.features.secure.desc).not.toContain('entornos aislados');
    expect(fr.CLI.features.secure.desc).not.toContain('environnements isolés');
    expect(pt.CLI.features.secure.desc).not.toContain('ambientes isolados');
    expect(ru.CLI.features.secure.desc).not.toContain('изолированных средах');
  });

  it('keeps English and Chinese entry copy focused on skills instead of platform-first language', () => {
    expect(en.Home.featuresSubtitle).toBe(
      'Browse reusable AI agent skills and install them in the right native format for your IDE.',
    );
    expect(en.Home.footerDesc).toBe(
      'Open-source directory and installation entry point for AI agent skills. Built for real developer work.',
    );
    expect(en.Footer.desc).toBe(
      'Open-source directory for AI agent skills and IDE workflows. Built for real developer work.',
    );
    expect(en.CLI.heroTitle).toBe('Killer-Skills CLI');
    expect(en.CLI.heroSubtitle).toBe('Install and manage AI agent skills');

    expect(zh.Home.featuresSubtitle).toBe('浏览可复用的 AI 智能体技能，并以 IDE 原生格式完成安装。');
    expect(zh.Home.footerDesc).toBe('面向 AI 智能体技能的开源目录与安装入口。为真实开发工作而生。');
    expect(zh.Footer.desc).toBe('面向 AI 智能体技能与 IDE 工作流的开源目录。为真实开发工作而生。');
    expect(zh.CLI.heroTitle).toBe('Killer-Skills CLI');
    expect(zh.CLI.heroSubtitle).toBe('安装和管理 AI 智能体技能');
  });

  it('keeps home and CLI marketing copy tied to skills instead of generic capabilities', () => {
    expect(en.Home.heroDesc2).toBe(
      'Safely extend Claude Code, Cursor, and Windsurf without configuration overhead or local runtime risk.',
    );
    expect(en.Home.seoIntro).toContain('open-source directory');
    expect(en.Home.searchPlaceholder).toBe("Search for skills (e.g., 'Web Scraping', 'Data Viz')...");
    expect(en.Home.features['1'].title).toBe('IDE-Native Formats');
    expect(en.Home.features['1'].desc).toBe(
      'Install one skill across major IDEs and agent environments with the right native format.',
    );
    expect(en.Common.searchPlaceholder).toBe("Search for skills (e.g., 'Web Scraping')");
    expect(en.CLI.features.autoInvoke.title).toBe('Open Skills Registry');
    expect(en.CLI.features.autoInvoke.desc).toBe(
      'Browse community and official AI agent skills for PDF processing, browser automation, documentation, and more.',
    );
    expect(en.CLI.features.syncAll.title).toBe('Multi-IDE Sync');
    expect(en.SkillsManagerWidget.description).toBe(
      'Unlock more workflows instantly. Discover and install 3,400+ AI agent skills.',
    );

    expect(zh.Home.heroDesc2).toBe('安全扩展 Claude Code、Cursor 和 Windsurf，免去环境配置困扰与本地运行风险。');
    expect(zh.Home.seoIntro).toContain('开源目录');
    expect(zh.Home.searchPlaceholder).toBe('搜索技能，例如：网页爬取、数据可视化');
    expect(zh.Home.features['1'].title).toBe('IDE 原生格式');
    expect(zh.Home.features['1'].desc).toBe('同一个技能可安装到主流 IDE 与 Agent 环境，并自动写入正确的原生格式。');
    expect(zh.Common.searchPlaceholder).toBe("搜索技能 (例如 '网页抓取')");
    expect(zh.CLI.features.autoInvoke.title).toBe('开放技能目录');
    expect(zh.CLI.features.autoInvoke.desc).toBe(
      '浏览社区与官方 AI 智能体技能，覆盖 PDF 处理、浏览器自动化、文档工作流等场景。',
    );
    expect(zh.CLI.features.syncAll.title).toBe('多 IDE 同步');
    expect(zh.SkillsManagerWidget.description).toBe('一键解锁更多工作流。发现并安装 3,400+ AI 智能体技能。');
  });

  it('keeps homepage seo intro and submit action localized across shipped locales', () => {
    for (const messages of localizedMessages) {
      expect(typeof messages.Home.seoIntro).toBe('string');
      expect(messages.Home.seoIntro.length).toBeGreaterThan(40);
      expect(typeof messages.Navigation.submitSkill).toBe('string');
      expect(messages.Navigation.submitSkill.length).toBeGreaterThan(1);
    }
  });

  it('keeps shipped locale messages free of install-flow boilerplate and english fallback prompts', () => {
    const blockedEnglishPhrases = [
      'Start with the installation docs and run npx killer-skills add owner/repo to add a skill.',
      'Find installation guides, setup docs, and CLI steps',
      'You can continue into skills search results',
      'Start with the workflows concept docs',
      'Which IDEs does Killer-Skills support?',
      'What does the {categoryName} category cover?',
      'Solution pages bundle related problems',
      'Start from zero with install, initialization, and first-run steps.',
      'What is {{name}}?',
      'How do I install {{name}}?',
      'Open your terminal',
      'Run Online Preview',
      'Browse AI agent skills by category to find the right tool for your workflow.',
      'AI agent skills blog',
    ];

    for (const messages of shippedNonEnglishMessages) {
      const serialized = JSON.stringify(messages);
      for (const phrase of blockedEnglishPhrases) {
        expect(serialized).not.toContain(phrase);
      }
    }
  });

  it('keeps remaining localized home copy aligned with skills-first messaging', () => {
    const expectations = [
      {
        messages: ar,
        featuresSubtitle:
          'ثبّت مهارات وكلاء الذكاء الاصطناعي القابلة لإعادة الاستخدام وأدخل سير العمل القابل للتكرار إلى بيئة IDE الخاصة بك.',
        trendingSubtitle: 'أفضل المهارات تقييماً وأكثرها شعبية من المجتمع.',
        footerDesc:
          'دليل مفتوح المصدر لمهارات وكلاء الذكاء الاصطناعي وسير العمل داخل IDE. صُمم لأعمال التطوير الحقيقية.',
        formatTitle: 'تنسيقات IDE الأصلية',
        formatDesc: 'ثبّت مهارة واحدة عبر بيئات IDE ووكلاء الذكاء الاصطناعي الرئيسية مع التنسيق الأصلي المناسب.',
        announcementsDesc: 'آخر الأخبار وتحديثات المهارات.',
      },
      {
        messages: de,
        featuresSubtitle:
          'Installieren Sie wiederverwendbare KI-Agenten-Skills und bringen Sie wiederholbare Workflows in Ihre IDE.',
        trendingSubtitle: 'Top-bewertete und beliebte Skills aus der Community.',
        footerDesc:
          'Open-Source-Verzeichnis für KI-Agenten-Skills und IDE-Workflows. Entwickelt für echte Entwicklungsarbeit.',
        formatTitle: 'IDE-native Formate',
        formatDesc:
          'Installieren Sie einen Skill mit dem passenden nativen Format in wichtige IDEs und Agent-Umgebungen.',
        announcementsDesc: 'Neueste Neuigkeiten und Skill-Updates.',
      },
      {
        messages: es,
        featuresSubtitle:
          'Instala skills reutilizables de agentes de IA y lleva flujos de trabajo repetibles a tu IDE.',
        trendingSubtitle: 'Skills mejor valoradas y más populares de la comunidad.',
        footerDesc:
          'Directorio de código abierto de skills de agentes de IA y flujos de trabajo para IDE. Creado para el trabajo real de desarrollo.',
        formatTitle: 'Formatos nativos del IDE',
        formatDesc: 'Instala una skill en los principales IDE y entornos de agentes con el formato nativo adecuado.',
        announcementsDesc: 'Últimas noticias y actualizaciones de skills.',
      },
      {
        messages: fr,
        featuresSubtitle:
          'Installez des skills d’agents IA réutilisables et apportez des workflows répétables dans votre IDE.',
        trendingSubtitle: 'Les skills les mieux notés et les plus populaires de la communauté.',
        footerDesc:
          'Répertoire open source de skills d’agents IA et de workflows IDE. Conçu pour le vrai travail de développement.',
        formatTitle: 'Formats natifs des IDE',
        formatDesc: 'Installez un skill dans les principaux IDE et environnements d’agents avec le bon format natif.',
        announcementsDesc: 'Dernières nouvelles et mises à jour des skills.',
      },
      {
        messages: ja,
        featuresSubtitle:
          '再利用可能な AI エージェントスキルをインストールし、繰り返し使えるワークフローを IDE に持ち込みましょう。',
        trendingSubtitle: 'コミュニティで評価が高く人気のスキル。',
        footerDesc:
          'AI エージェントスキルと IDE ワークフローのためのオープンソースディレクトリ。実際の開発作業のために構築。',
        formatTitle: 'IDE ネイティブ形式',
        formatDesc: '1 つのスキルを主要 IDE とエージェント環境に適切なネイティブ形式でインストールできます。',
        announcementsDesc: '最新ニュースとスキル更新。',
      },
      {
        messages: ko,
        featuresSubtitle: '재사용 가능한 AI 에이전트 스킬을 설치하고 반복 가능한 워크플로를 IDE로 가져오세요.',
        trendingSubtitle: '커뮤니티에서 높은 평가를 받고 가장 인기 있는 스킬.',
        footerDesc: 'AI 에이전트 스킬과 IDE 워크플로를 위한 오픈 소스 디렉터리. 실제 개발 작업을 위해 만들어졌습니다.',
        formatTitle: 'IDE 네이티브 형식',
        formatDesc: '하나의 스킬을 올바른 네이티브 형식으로 주요 IDE와 에이전트 환경에 설치하세요.',
        announcementsDesc: '최신 뉴스 및 스킬 업데이트.',
      },
      {
        messages: pt,
        featuresSubtitle:
          'Instale skills reutilizáveis de agentes de IA e leve fluxos de trabalho repetíveis para sua IDE.',
        trendingSubtitle: 'Skills mais bem avaliadas e mais populares da comunidade.',
        footerDesc:
          'Diretório open source de skills de agentes de IA e fluxos de trabalho para IDE. Feito para trabalho real de desenvolvimento.',
        formatTitle: 'Formatos nativos de IDE',
        formatDesc: 'Instale uma skill nos principais IDEs e ambientes de agentes com o formato nativo correto.',
        announcementsDesc: 'Últimas notícias e atualizações de skills.',
      },
      {
        messages: ru,
        featuresSubtitle:
          'Устанавливайте переиспользуемые навыки AI-агентов и приносите повторяемые рабочие процессы в вашу IDE.',
        trendingSubtitle: 'Самые популярные и высоко оценённые навыки от сообщества.',
        footerDesc: 'Open-source каталог навыков AI-агентов и IDE-воркфлоу. Создан для реальной разработки.',
        formatTitle: 'Нативные форматы IDE',
        formatDesc: 'Устанавливайте один навык в основные IDE и среды агентов в подходящем нативном формате.',
        announcementsDesc: 'Последние новости и обновления навыков.',
      },
    ];

    for (const expectation of expectations) {
      expect(expectation.messages.Home.featuresSubtitle).toBe(expectation.featuresSubtitle);
      expect(expectation.messages.Home.trendingSubtitle).toBe(expectation.trendingSubtitle);
      expect(expectation.messages.Home.footerDesc).toBe(expectation.footerDesc);
      expect(expectation.messages.Footer.desc).toBe(expectation.footerDesc);
      expect(expectation.messages.Home.features['1'].title).toBe(expectation.formatTitle);
      expect(expectation.messages.Home.features['1'].desc).toBe(expectation.formatDesc);
      expect(expectation.messages.Blog.categories['announcements-desc']).toBe(expectation.announcementsDesc);
    }

    expect(en.Blog.categories['announcements-desc']).toBe('Latest news and skills updates.');
    expect(zh.Blog.categories['announcements-desc']).toBe('最新新闻与技能更新。');
  });

  it('keeps translated CLI hero and feature titles out of platform-first wording', () => {
    expect(ar.CLI.heroTitle).not.toBe('منصة Killer-Skills');
    expect(ar.CLI.heroSubtitle).not.toBe('المعيار المفتوح لمهارات وكلاء الذكاء الاصطناعي');
    expect(ar.CLI.features.autoInvoke.title).not.toBe('سجل عالمي');
    expect(ar.CLI.features.syncAll.title).not.toBe('مزامنة عالمية');

    expect(de.CLI.heroTitle).not.toBe('Killer-Skills Plattform');
    expect(de.CLI.heroSubtitle).not.toBe('Der offene Standard für AI-Agenten-Skills');
    expect(de.CLI.features.autoInvoke.title).not.toBe('Universelles Register');
    expect(de.CLI.features.syncAll.title).not.toBe('Universelle Synchronisierung');

    expect(es.CLI.heroTitle).not.toBe('Plataforma Killer-Skills');
    expect(es.CLI.heroSubtitle).not.toBe('El estándar abierto para habilidades de agentes de IA');
    expect(es.CLI.features.autoInvoke.title).not.toBe('Registro Universal');
    expect(es.CLI.features.syncAll.title).not.toBe('Sincronización Universal');

    expect(fr.CLI.heroTitle).not.toBe('Plateforme Killer-Skills');
    expect(fr.CLI.heroSubtitle).not.toBe('Le standard ouvert pour les compétences des agents IA');
    expect(fr.CLI.features.autoInvoke.title).not.toBe('Registre Universel');
    expect(fr.CLI.features.syncAll.title).not.toBe('Synchronisation Universelle');

    expect(ja.CLI.heroTitle).not.toBe('Killer-Skills プラットフォーム');
    expect(ja.CLI.heroSubtitle).not.toBe('AI エージェントスキルのためのオープンスタンダード');
    expect(ja.CLI.features.autoInvoke.title).not.toBe('ユニバーサルレジストリ');
    expect(ja.CLI.features.syncAll.title).not.toBe('ユニバーサル同期');

    expect(ko.CLI.heroTitle).not.toBe('Killer-Skills 플랫폼');
    expect(ko.CLI.heroSubtitle).not.toBe('AI 에이전트 스킬을 위한 개방형 표준');
    expect(ko.CLI.features.autoInvoke.title).not.toBe('유니버설 레지스트리');
    expect(ko.CLI.features.syncAll.title).not.toBe('유니버설 동기화');

    expect(pt.CLI.heroTitle).not.toBe('Plataforma Killer-Skills');
    expect(pt.CLI.heroSubtitle).not.toBe('O padrão aberto para habilidades de agentes de IA');
    expect(pt.CLI.features.autoInvoke.title).not.toBe('Registro Universal');
    expect(pt.CLI.features.syncAll.title).not.toBe('Sincronização Universal');

    expect(ru.CLI.heroTitle).not.toBe('Платформа Killer-Skills');
    expect(ru.CLI.heroSubtitle).not.toBe('Открытый стандарт для навыков ИИ-агентов');
    expect(ru.CLI.features.autoInvoke.title).not.toBe('Универсальный реестр');
    expect(ru.CLI.features.syncAll.title).not.toBe('Универсальная синхронизация');
  });

  it('keeps translated integrations copy focused on skills instead of protocol-first wording', () => {
    expect(ar.Integrations.learnProtocol).not.toBe('تعرف على البروتوكول');
    expect(ar.Integrations.heroDesc).not.toContain('صيغ المهارات الأصلية');
    expect(ar.Integrations.missingToolDesc).not.toContain('ملفات إعداد متوافقة');

    expect(de.Integrations.learnProtocol).not.toBe('Mehr über das Protokoll erfahren');
    expect(de.Integrations.heroDesc).not.toContain('IDE-native Skill-Formate');
    expect(de.Integrations.missingToolDesc).not.toContain('kompatible Konfigurationsdateien');

    expect(es.Integrations.learnProtocol).not.toBe('Conoce el Protocolo');
    expect(es.Integrations.heroDesc).not.toContain('formatos de skills nativos del IDE');
    expect(es.Integrations.missingToolDesc).not.toContain('archivos de configuración compatibles');

    expect(fr.Integrations.learnProtocol).not.toBe('En savoir plus sur le Protocole');
    expect(fr.Integrations.heroDesc).not.toContain('formats de skills natifs des IDE');
    expect(fr.Integrations.missingToolDesc).not.toContain('fichiers de configuration compatibles');

    expect(ja.Integrations.learnProtocol).not.toBe('プロトコルについて学ぶ');
    expect(ja.Integrations.heroDesc).not.toContain('IDE ネイティブのスキル形式');
    expect(ja.Integrations.missingToolDesc).not.toContain('互換性のある設定ファイル');

    expect(ko.Integrations.learnProtocol).not.toBe('프로토콜에 대해 알아보기');
    expect(ko.Integrations.heroDesc).not.toContain('IDE 네이티브 스킬 형식');
    expect(ko.Integrations.missingToolDesc).not.toContain('호환 설정 파일');

    expect(pt.Integrations.learnProtocol).not.toBe('Aprenda Sobre O Protocolo');
    expect(pt.Integrations.heroDesc).not.toContain('formatos de skill nativos das IDEs');
    expect(pt.Integrations.missingToolDesc).not.toContain('arquivos de configuração compatíveis');

    expect(ru.Integrations.learnProtocol).not.toBe('Узнать о протоколе');
    expect(ru.Integrations.heroDesc).not.toContain('нативные форматы skills в IDE');
    expect(ru.Integrations.missingToolDesc).not.toContain('совместимые конфигурационные файлы');
  });

  it('keeps translated CLI and integrations feature descriptions tied to reusable skills', () => {
    expect(ar.CLI.features.autoInvoke.desc).toBe(
      'تصفّح مهارات وكلاء الذكاء الاصطناعي من المجتمع والجهات الرسمية لمعالجة PDF وأتمتة المتصفح والوثائق والمزيد.',
    );
    expect(ar.Integrations.cards.cursor.desc).toBe(
      'استخدم مهارات وكلاء الذكاء الاصطناعي القابلة لإعادة الاستخدام داخل Cursor.',
    );
    expect(ar.Integrations.cards.windsurf.desc).toBe(
      'استخدم مهارات وكلاء الذكاء الاصطناعي القابلة لإعادة الاستخدام داخل Windsurf.',
    );
    expect(ar.Integrations.cards.claude.desc).toBe(
      'استخدم مهارات وكلاء الذكاء الاصطناعي القابلة لإعادة الاستخدام داخل Claude Code.',
    );
    expect(ar.Integrations.cards.goose.desc).toBe(
      'استخدم مهارات وكلاء الذكاء الاصطناعي القابلة لإعادة الاستخدام داخل Goose.',
    );

    expect(de.CLI.features.autoInvoke.desc).toBe(
      'Durchsuchen Sie Community- und offizielle KI-Agenten-Skills für PDF-Verarbeitung, Browser-Automatisierung, Dokumentation und mehr.',
    );
    expect(de.Integrations.cards.cursor.desc).toBe('Nutzen Sie wiederverwendbare KI-Agenten-Skills direkt in Cursor.');
    expect(de.Integrations.cards.windsurf.desc).toBe(
      'Nutzen Sie wiederverwendbare KI-Agenten-Skills direkt in Windsurf.',
    );
    expect(de.Integrations.cards.claude.desc).toBe(
      'Nutzen Sie wiederverwendbare KI-Agenten-Skills direkt in Claude Code.',
    );
    expect(de.Integrations.cards.goose.desc).toBe('Nutzen Sie wiederverwendbare KI-Agenten-Skills direkt in Goose.');

    expect(es.CLI.features.autoInvoke.desc).toBe(
      'Explora skills comunitarios y oficiales de agentes de IA para procesamiento de PDF, automatización del navegador, documentación y más.',
    );
    expect(es.Integrations.cards.cursor.desc).toBe('Usa skills reutilizables de agentes de IA directamente en Cursor.');
    expect(es.Integrations.cards.windsurf.desc).toBe(
      'Usa skills reutilizables de agentes de IA directamente en Windsurf.',
    );
    expect(es.Integrations.cards.claude.desc).toBe(
      'Usa skills reutilizables de agentes de IA directamente en Claude Code.',
    );
    expect(es.Integrations.cards.goose.desc).toBe('Usa skills reutilizables de agentes de IA directamente en Goose.');

    expect(fr.CLI.features.autoInvoke.desc).toBe(
      'Parcourez des skills d’agents IA communautaires et officiels pour le traitement PDF, l’automatisation du navigateur, la documentation et plus encore.',
    );
    expect(fr.Integrations.cards.cursor.desc).toBe(
      'Utilisez des skills d’agents IA réutilisables directement dans Cursor.',
    );
    expect(fr.Integrations.cards.windsurf.desc).toBe(
      'Utilisez des skills d’agents IA réutilisables directement dans Windsurf.',
    );
    expect(fr.Integrations.cards.claude.desc).toBe(
      'Utilisez des skills d’agents IA réutilisables directement dans Claude Code.',
    );
    expect(fr.Integrations.cards.goose.desc).toBe(
      'Utilisez des skills d’agents IA réutilisables directement dans Goose.',
    );

    expect(ja.CLI.features.autoInvoke.desc).toBe(
      'PDF 処理、ブラウザ自動化、ドキュメント作業などに使える、コミュニティ製および公式の AI エージェントスキルを探せます。',
    );
    expect(ja.Integrations.cards.cursor.desc).toBe('Cursor で再利用可能な AI エージェントスキルを使えます。');
    expect(ja.Integrations.cards.windsurf.desc).toBe('Windsurf で再利用可能な AI エージェントスキルを使えます。');
    expect(ja.Integrations.cards.claude.desc).toBe('Claude Code で再利用可能な AI エージェントスキルを使えます。');
    expect(ja.Integrations.cards.goose.desc).toBe('Goose で再利用可能な AI エージェントスキルを使えます。');

    expect(ko.CLI.features.autoInvoke.desc).toBe(
      'PDF 처리, 브라우저 자동화, 문서 작업 등 다양한 용도의 커뮤니티 및 공식 AI 에이전트 스킬을 둘러보세요.',
    );
    expect(ko.Integrations.cards.cursor.desc).toBe('Cursor에서 재사용 가능한 AI 에이전트 스킬을 사용할 수 있습니다.');
    expect(ko.Integrations.cards.windsurf.desc).toBe(
      'Windsurf에서 재사용 가능한 AI 에이전트 스킬을 사용할 수 있습니다.',
    );
    expect(ko.Integrations.cards.claude.desc).toBe(
      'Claude Code에서 재사용 가능한 AI 에이전트 스킬을 사용할 수 있습니다.',
    );
    expect(ko.Integrations.cards.goose.desc).toBe('Goose에서 재사용 가능한 AI 에이전트 스킬을 사용할 수 있습니다.');

    expect(pt.CLI.features.autoInvoke.desc).toBe(
      'Explore skills comunitários e oficiais de agentes de IA para processamento de PDF, automação de navegador, documentação e muito mais.',
    );
    expect(pt.Integrations.cards.cursor.desc).toBe('Use skills reutilizáveis de agentes de IA diretamente no Cursor.');
    expect(pt.Integrations.cards.windsurf.desc).toBe(
      'Use skills reutilizáveis de agentes de IA diretamente no Windsurf.',
    );
    expect(pt.Integrations.cards.claude.desc).toBe(
      'Use skills reutilizáveis de agentes de IA diretamente no Claude Code.',
    );
    expect(pt.Integrations.cards.goose.desc).toBe('Use skills reutilizáveis de agentes de IA diretamente no Goose.');

    expect(ru.CLI.features.autoInvoke.desc).toBe(
      'Просматривайте навыки AI-агентов от сообщества и официальных авторов для обработки PDF, автоматизации браузера, работы с документацией и многого другого.',
    );
    expect(ru.Integrations.cards.cursor.desc).toBe('Используйте переиспользуемые навыки AI-агентов прямо в Cursor.');
    expect(ru.Integrations.cards.windsurf.desc).toBe(
      'Используйте переиспользуемые навыки AI-агентов прямо в Windsurf.',
    );
    expect(ru.Integrations.cards.claude.desc).toBe(
      'Используйте переиспользуемые навыки AI-агентов прямо в Claude Code.',
    );
    expect(ru.Integrations.cards.goose.desc).toBe('Используйте переиспользуемые навыки AI-агентов прямо в Goose.');
  });

  it('keeps english and chinese community copy focused on contributing skills instead of generic ecosystem language', () => {
    expect(en.Community.heroDesc).toBe(
      'Join the builders, contributors, and teams improving reusable AI agent skills and IDE workflows.',
    );
    expect(en.Community.heroDesc).not.toContain('open source ecosystem');
    expect(en.Community.contributeDesc).toBe(
      'Killer-Skills is open source. Contribute fixes, improve workflows, or publish reusable AI agent skills.',
    );

    expect(zh.Community.heroDesc).toBe('加入一起打磨可复用 AI 智能体技能与 IDE 工作流的开发者、贡献者与团队。');
    expect(zh.Community.heroDesc).not.toContain('开源生态');
    expect(zh.Community.contributeDesc).toBe(
      'Killer-Skills 是开源项目。欢迎贡献修复、完善工作流，或发布可复用 AI 智能体技能。',
    );
  });

  it('keeps english and chinese public guidance out of internal step and rollout wording', () => {
    expect(en.Collections.faq1A).not.toContain('open the installation docs before browsing more repositories');
    expect(en.Collections.seoDescription).not.toContain(blockedPhrase('CLI ', 'validation'));
    expect(en.Collections.seoDescription).not.toContain('rollout paths');
    expect(en.Docs.faq3A).not.toContain('workflow concept docs');
    expect(en.Solutions.faq1A).not.toContain(blockedPhrase('next', '-step paths'));
    expect(en.BlogCategory.faq3A).not.toContain(blockedPhrase('next', '-step intent'));

    expect(zh.Collections.faq1A).not.toContain('先用合集筛选候选工具');
    expect(zh.Docs.faq3A).not.toContain('workflows 概念页');
    expect(zh.Solutions.faq3A).not.toContain('执行一条命令安装并验证');
    expect(zh.BlogCategory.faq3A).not.toContain('按更精准的意图继续深入');
  });

  it('keeps shipped locale detail templates and labs UI localized', () => {
    for (const messages of shippedNonEnglishMessages) {
      expect(messages.Detail.faqWhatIs).not.toBe('What is {{name}}?');
      expect(messages.Detail.faqHowInstall).not.toBe('How do I install {{name}}?');
      expect(messages.Detail.howToName1).not.toBe('Open your terminal');
      expect(messages.Labs.emptyInput).not.toBe('Please enter your request first.');
      expect(messages.Labs.runLabel).not.toBe('Run Online Preview');
      expect(messages.Labs.chooseSkill).not.toBe('Choose Skill');
    }
  });

  it('keeps shipped locale blog links, cli faq, and install labels out of english fallback copy', () => {
    const blockedEnglishPhrases = [
      'Install the docx skill to create, edit, and format .docx files with your AI agent.',
      'Install the xlsx skill to read, write, and manipulate Excel files with your AI agent.',
      'Install the pdf skill for OCR, extraction, merging, and PDF generation with AI.',
      'Install the frontend-design skill for AI-powered UI component generation.',
      'Install the brand-guidelines skill for consistent visual identity generation with AI.',
      'Install the algorithmic-art skill to generate creative visual outputs with Claude Code.',
      'Install the pptx skill to create and edit PowerPoint files with your AI agent.',
      'Install the canvas skill for AI-generated posters, banners, and graphics.',
      'Install the doc-coauthoring skill for AI-assisted collaborative document writing.',
      'Install the webapp-testing skill for AI-driven UI and end-to-end test automation.',
      'Install the theme-factory skill for instant AI-generated brand themes and color systems.',
      'Install the slack-emoji skill to generate custom Slack emojis with your AI agent.',
      'Browse All Skills',
      'Install & CLI Guide',
      'PDF Automation with AI: OCR, Extraction & Report Workflows',
      'Skills for Developer Workflows: Build MCP Integrations in Claude Code or Cursor',
      'How do I install AI agent skills with the CLI?',
      'Which IDEs does the CLI support?',
      'Can I sync skills across multiple projects?',
      'How do I update installed skills?',
      'Install Command',
      'Install Path',
      'Get Manager',
    ];

    for (const messages of shippedNonEnglishMessages) {
      const serialized = JSON.stringify({
        blogIntentLinks: messages.Blog.IntentLinks,
        blogMisc: messages.Blog.Misc,
        blogMetaOverride: messages.Blog.MetaOverride,
        cliFaq: {
          faq1Q: messages.CLI.faq1Q,
          faq1A: messages.CLI.faq1A,
          faq2Q: messages.CLI.faq2Q,
          faq2A: messages.CLI.faq2A,
          faq3Q: messages.CLI.faq3Q,
          faq3A: messages.CLI.faq3A,
          faq4Q: messages.CLI.faq4Q,
          faq4A: messages.CLI.faq4A,
        },
        detailLabels: {
          installCommand: messages.Detail.installCommand,
          installPath: messages.Detail.installPath,
          getManager: messages.Detail.getManager,
          top5Percent: messages.Detail.top5Percent,
          ideDescriptions: messages.Detail.ideDescriptions,
        },
      });

      for (const phrase of blockedEnglishPhrases) {
        expect(serialized).not.toContain(phrase);
      }

      for (const description of Object.values(messages.Detail.ideDescriptions)) {
        expect(description).not.toMatch(/^Install to /);
      }

      expect(messages.Detail.top5Percent).not.toBe('Top 5%');
    }
  });

  it('keeps shipped locale category and blog metadata localized', () => {
    for (const messages of shippedNonEnglishMessages) {
      expect(messages.Categories.heroIntro).not.toBe(
        'Browse AI agent skills by category to find the right tool for your workflow.',
      );
      expect(messages.BlogIndex.keyword1.toLowerCase()).not.toBe('ai agent skills blog');
      expect(messages.BlogIndex.keyword2.toLowerCase()).not.toBe('developer workflow skills');
      expect(messages.BlogIndex.keyword3.toLowerCase()).not.toBe('ide skill articles');
    }
  });

  it('keeps localized docs sidebar labels focused on skills and CLI usage instead of platform/tooling wording', () => {
    expect(en.DocsSidebar.platformOverview).toBe('Skills Overview');
    expect(zh.DocsSidebar.platformOverview).toBe('技能概览');
    expect(ar.DocsSidebar.platformOverview).toBe('نظرة عامة على المهارات');
    expect(de.DocsSidebar.platformOverview).toBe('Skills-Übersicht');
    expect(es.DocsSidebar.platformOverview).toBe('Resumen de Skills');
    expect(fr.DocsSidebar.platformOverview).toBe('Aperçu des Skills');
    expect(ja.DocsSidebar.platformOverview).toBe('スキル概要');
    expect(ko.DocsSidebar.platformOverview).toBe('스킬 개요');
    expect(pt.DocsSidebar.platformOverview).toBe('Visão Geral de Skills');
    expect(ru.DocsSidebar.platformOverview).toBe('Обзор навыков');

    expect(en.DocsSidebar.cliTooling).toBe('Using the CLI');
    expect(zh.DocsSidebar.cliTooling).toBe('使用 CLI');
    expect(ar.DocsSidebar.cliTooling).toBe('استخدام CLI');
    expect(de.DocsSidebar.cliTooling).toBe('CLI verwenden');
    expect(es.DocsSidebar.cliTooling).toBe('Usar la CLI');
    expect(fr.DocsSidebar.cliTooling).toBe('Utiliser la CLI');
    expect(ja.DocsSidebar.cliTooling).toBe('CLI を使う');
    expect(ko.DocsSidebar.cliTooling).toBe('CLI 사용');
    expect(pt.DocsSidebar.cliTooling).toBe('Usar a CLI');
    expect(ru.DocsSidebar.cliTooling).toBe('Использование CLI');
  });

  it('keeps skill-card and skill-detail fallback copy on explicit public-surface contracts', () => {
    const skillCardSource = readPageSource('../components/SkillCard.astro');
    const skillDetailSource = readPageSource('../pages/[locale]/skills/[owner]/[...repo].astro');

    expect(skillCardSource).toContain('translateOr(messages, key, fallback)');
    expect(skillCardSource).toContain("resolveCopy('Common.noDescription', 'No description available')");
    expect(skillCardSource).not.toContain("t ? t('Common.noDescription')");
    expect(skillDetailSource).toContain("tr('Skills.noResults', 'No skills found')");
    expect(skillDetailSource).toContain("tr(\n  'Metadata.description'");
    expect(skillDetailSource).toContain('buildBreadcrumbTrail(');
  });

  it('keeps stale manager widget capability counts out of public messages', () => {
    for (const messages of localizedMessages) {
      expect(messages.SkillsManagerWidget.description).toContain('3,400');
      expect(messages.SkillsManagerWidget.description).not.toContain('1000');
    }
  });
});
