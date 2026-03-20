#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

type Locale = 'en' | 'zh' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'pt' | 'ru' | 'ar';

type CollectionSeed = {
  slug: string;
  canonicalSlug: string;
  topic: Record<Locale, string>;
  focus: Record<Locale, string>;
};

const LOCALES: Locale[] = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'];

// Missing long-tail collection definitions.
// Only keep seeds that are still canonical targets. Migrated legacy slugs now redirect via canonicalSlug metadata.
const collectionSeeds: CollectionSeed[] = [
  {
    slug: 'top-mcp-for-data-analysis',
    canonicalSlug: 'data-workflows-and-analysis-tools',
    topic: {
      en: 'Data Analysis',
      zh: '数据分析',
      ja: 'データ分析',
      ko: '데이터 분석',
      es: 'Análisis de Datos',
      fr: 'Analyse de Données',
      de: 'Datenanalyse',
      pt: 'Análise de Dados',
      ru: 'Аналитика данных',
      ar: 'تحليل البيانات',
    },
    focus: {
      en: 'query workflows, reporting pipelines, and analysis-ready integrations',
      zh: '查询工作流、报告流水线与分析集成',
      ja: 'クエリワークフロー、レポートパイプライン、分析向け連携',
      ko: '쿼리 워크플로, 리포팅 파이프라인, 분석 통합',
      es: 'flujos de consulta, canalizaciones de reportes e integraciones analíticas',
      fr: 'workflows de requêtes, pipelines de reporting et intégrations analytiques',
      de: 'Abfrage-Workflows, Reporting-Pipelines und analyseorientierte Integrationen',
      pt: 'fluxos de consulta, pipelines de relatórios e integrações analíticas',
      ru: 'рабочие процессы запросов, отчетные пайплайны и интеграции для аналитики',
      ar: 'سير عمل الاستعلامات وخطوط التقارير والتكاملات التحليلية',
    },
  },
  {
    slug: 'top-mcp-for-testing',
    canonicalSlug: 'testing-automation-and-qa-workflow-tools',
    topic: {
      en: 'Software Testing',
      zh: '软件测试',
      ja: 'ソフトウェアテスト',
      ko: '소프트웨어 테스트',
      es: 'Pruebas de Software',
      fr: 'Tests Logiciels',
      de: 'Softwaretests',
      pt: 'Testes de Software',
      ru: 'Тестирование ПО',
      ar: 'اختبار البرمجيات',
    },
    focus: {
      en: 'test planning, validation loops, and quality-focused integration workflows',
      zh: '测试规划、验证闭环与质量导向集成流程',
      ja: 'テスト計画、検証ループ、品質重視の連携ワークフロー',
      ko: '테스트 기획, 검증 루프, 품질 중심 통합 워크플로',
      es: 'planificación de pruebas, ciclos de validación y flujos de integración orientados a calidad',
      fr: 'planification des tests, boucles de validation et workflows d’intégration orientés qualité',
      de: 'Testplanung, Validierungsschleifen und qualitätsorientierte Integrationsabläufe',
      pt: 'planejamento de testes, ciclos de validação e fluxos de integração com foco em qualidade',
      ru: 'планирование тестов, циклы валидации и интеграционные процессы с упором на качество',
      ar: 'تخطيط الاختبارات وحلقات التحقق وتدفقات التكامل الموجهة للجودة',
    },
  },
];

function shorten(text: string, maxLength = 160): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildTitle(locale: Locale, topic: string): string {
  if (locale === 'zh') return `AI Agent Skills 与工作流工具：${topic}`;
  if (locale === 'ja') return `AI Agent Skills とワークフローツール: ${topic}`;
  if (locale === 'ko') return `AI Agent Skills 및 워크플로 도구: ${topic}`;
  if (locale === 'es') return `AI Agent Skills y herramientas de flujo: ${topic}`;
  if (locale === 'fr') return `AI Agent Skills et outils de workflow : ${topic}`;
  if (locale === 'de') return `AI Agent Skills und Workflow-Tools: ${topic}`;
  if (locale === 'pt') return `AI Agent Skills e ferramentas de fluxo: ${topic}`;
  if (locale === 'ru') return `AI Agent Skills и инструменты рабочих процессов: ${topic}`;
  if (locale === 'ar') return `مهارات وكلاء الذكاء الاصطناعي وأدوات سير العمل: ${topic}`;
  return `AI Agent Skills & Workflow Tools: ${topic}`;
}

function buildDescription(locale: Locale, topic: string, focus: string): string {
  if (locale === 'zh') {
    return `面向 ${topic} 的 AI Agent Skills、工作流工具与集成清单，覆盖 ${focus}，帮助团队快速搭建可复用流程。`;
  }
  if (locale === 'ja') {
    return `${topic} 向けの AI Agent Skills とワークフローツールをまとめ、${focus} を通じて再利用可能な開発フロー構築を支援します。`;
  }
  if (locale === 'ko') {
    return `${topic} 중심의 AI Agent Skills, 워크플로 도구, 통합 구성을 정리해 ${focus} 기반의 재사용 가능한 흐름 설계를 돕습니다.`;
  }
  if (locale === 'es') {
    return `Colección de AI Agent Skills, herramientas de flujo e integraciones para ${topic}, enfocada en ${focus} para construir flujos reutilizables.`;
  }
  if (locale === 'fr') {
    return `Collection d’AI Agent Skills, d’outils de workflow et d’intégrations pour ${topic}, axée sur ${focus} pour des workflows réutilisables.`;
  }
  if (locale === 'de') {
    return `Sammlung von AI Agent Skills, Workflow-Tools und Integrationen für ${topic}, mit Fokus auf ${focus} für wiederverwendbare Abläufe.`;
  }
  if (locale === 'pt') {
    return `Coleção de AI Agent Skills, ferramentas de fluxo e integrações para ${topic}, com foco em ${focus} para fluxos reutilizáveis.`;
  }
  if (locale === 'ru') {
    return `Подборка AI Agent Skills, инструментов рабочих процессов и интеграций для ${topic}; акцент на ${focus} для повторяемых рабочих процессов.`;
  }
  if (locale === 'ar') {
    return `مجموعة من مهارات وكلاء الذكاء الاصطناعي وأدوات سير العمل والتكاملات الخاصة بـ ${topic} مع تركيز على ${focus} لبناء تدفقات قابلة لإعادة الاستخدام.`;
  }
  return `A curated set of AI Agent Skills, workflow tools, and integrations for ${topic}, focused on ${focus} to support reusable workflows.`;
}

function buildKeywords(locale: Locale, topic: string, slug: string): string[] {
  const normalizedTopic = topic.toLowerCase();
  const intentFromSlug = slug
    .replace(/^top-mcp-for-/, '')
    .split('-')
    .join(' ');

  const baseKeywords = [
    'ai agent skills',
    'workflow tools',
    'developer workflows',
    normalizedTopic,
    intentFromSlug,
    'mcp integrations',
  ];

  if (locale === 'zh') {
    baseKeywords.push('AI Agent Skills', '工作流自动化', 'MCP 集成');
  } else if (locale === 'ja') {
    baseKeywords.push('AI Agent Skills', 'ワークフロー自動化', 'MCP連携');
  } else if (locale === 'ko') {
    baseKeywords.push('AI Agent Skills', '워크플로 자동화', 'MCP 통합');
  }

  return Array.from(new Set(baseKeywords));
}

function generateCollection(seed: CollectionSeed) {
  const collection: Record<string, any> = {
    title: {},
    description: {},
    seoTitle: {},
    seoDescription: {},
    keywords: {},
    featured: false,
    category: 'developer-tools',
    canonicalSlug: seed.canonicalSlug,
    legacySlugs: [seed.slug],
    skills: [], // Required field, populated by other flows.
    longDescription: {},
  };

  for (const locale of LOCALES) {
    const topic = seed.topic[locale] || seed.topic.en;
    const focus = seed.focus[locale] || seed.focus.en;

    const title = buildTitle(locale, topic);
    const description = buildDescription(locale, topic, focus);

    collection.title[locale] = title;
    collection.description[locale] = description;
    collection.seoTitle[locale] = `${title} | Killer-Skills`;
    collection.seoDescription[locale] = shorten(description, 155);
    collection.longDescription[locale] = description;
    collection.keywords[locale] = buildKeywords(locale, topic, seed.slug);
  }

  return collection;
}

function main() {
  const collectionsDir = path.resolve(process.cwd(), 'src/content/collections');
  let created = 0;

  console.log('Creating missing long-tail collection pages...\n');

  for (const seed of collectionSeeds) {
    const filePath = path.join(collectionsDir, `${seed.slug}.json`);

    if (fs.existsSync(filePath)) {
      console.log(`Skipped: ${seed.slug} (already exists)`);
      continue;
    }

    const collection = generateCollection(seed);
    fs.writeFileSync(filePath, `${JSON.stringify(collection, null, 2)}\n`);
    console.log(`Created: ${seed.slug}`);
    created += 1;
  }

  console.log(`\nDone. Created ${created} new collections.`);
}

main();
