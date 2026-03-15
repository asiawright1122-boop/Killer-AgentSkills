#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// 缺失的长尾集合定义
const newCollections = [
  {
    slug: 'top-mcp-for-data-analysis',
    title: {
      en: 'Best MCP Servers for Data Analysis',
      zh: '数据分析和可视化的最佳 MCP 服务器',
      ja: 'データ分析に最適なMCPサーバー',
      ko: '데이터 분석을 위한 최고의 MCP 서버',
    },
    description: {
      en: 'Discover MCP servers that enable AI agents to perform data analysis, database queries, and generate insights from your data.',
      zh: '发现让 AI 智能体能够执行数据分析、数据库查询并从数据中获取洞察的 MCP 服务器。',
      ja: 'AIエージェントがデータ分析、データベースクエリを実行し、データから洞察を生成できるMCPサーバーを発見します。',
      ko: 'AI 에이전트가 데이터 분석, 데이터베이스 쿼리 수행, 데이터에서 인사이트 생성을 가능하게 하는 MCP 서버를 발견하세요.',
    }
  },
  {
    slug: 'top-mcp-for-automation-workflows',
    title: {
      en: 'Best MCP Servers for Workflow Automation',
      zh: '工作流自动化的最佳 MCP 服务器',
      ja: 'ワークフロー自動化に最適なMCPサーバー',
      ko: '워크플로 자동화를 위한 최고의 MCP 서버',
    },
    description: {
      en: 'Find MCP servers that help automate repetitive tasks, build CI/CD pipelines, and orchestrate complex workflows.',
      zh: '查找帮助自动执行重复任务、构建 CI/CD 管道和编排复杂工作流的 MCP 服务器。',
      ja: '反復的なタスクの自動化、CICDパイプラインの構築、複雑なワークフローのオーケストレーションを支援するMCPサーバーを見つけます。',
      ko: '반복적인 작업 자동화, CI/CD 파이프라인 구축, 복잡한 워크플로 오케스트레이션을 지원하는 MCP 서버를 찾으세요.',
    }
  },
  {
    slug: 'top-mcp-for-file-processing',
    title: {
      en: 'Best MCP Servers for File Processing',
      zh: '文件处理的最佳 MCP 服务器',
      ja: 'ファイル処理に最適なMCPサーバー',
      ko: '파일 처리를 위한 최고의 MCP 服务器',
    },
    description: {
      en: 'Discover MCP servers that enable AI agents to read, write, and transform files of any format including PDF, Excel, and documents.',
      zh: '发现让 AI 智能体能够读取、写入和转换任何格式文件（包括 PDF、Excel 和文档）的 MCP 服务器。',
      ja: 'PDF、Excel、ドキュメントを含むあらゆる形式のファイルを読み取り、変換できるMCPサーバーを発見します。',
      ko: 'PDF, Excel, 문서를 포함한 모든 형식의 파일을 읽고 쓰고 변환할 수 있는 AI 에이전트를 지원하는 MCP 서버를 발견하세요.',
    }
  },
  {
    slug: 'top-mcp-for-testing',
    title: {
      en: 'Best MCP Servers for Software Testing',
      zh: '软件测试的最佳 MCP 服务器',
      ja: 'ソフトウェアテストに最適なMCPサーバー',
      ko: '소프트웨어 테스트를 위한 최고의 MCP 服务器',
    },
    description: {
      en: 'Find MCP servers that help automate testing, generate test cases, and perform code quality analysis.',
      zh: '查找帮助自动测试、生成测试用例和执行代码质量分析的 MCP 服务器。',
      ja: 'テストの自動化、テストケースの生成、コード品質分析を支援するMCPサーバーを見つけます.',
      ko: '테스트 자동화, 테스트 케이스 생성, 코드 품질 분석을 지원하는 MCP 서버를 찾으세요.',
    }
  },
  {
    slug: 'top-mcp-for-github-actions',
    title: {
      en: 'Best MCP Servers for GitHub Actions',
      zh: 'GitHub Actions 的最佳 MCP 服务器',
      ja: 'GitHub Actionsに最適なMCPサーバー',
      ko: 'GitHub Actions를 위한 최고의 MCP 服务器',
    },
    description: {
      en: 'Discover MCP servers that integrate with GitHub Actions for CI/CD automation, repository management, and developer workflows.',
      zh: '发现与 GitHub Actions 集成用于 CI/CD 自动化、仓库管理和开发者工作流的 MCP 服务器。',
      ja: 'CICD自動化、リポジトリ管理、開発者ワークフローためにGitHub Actionsと統合するMCPサーバーを発見します.',
      ko: 'CI/CD 자동화, 저장소 관리, 개발자 워크플로를 위해 GitHub Actions와 통합되는 MCP 서버를 발견하세요.',
    }
  },
  {
    slug: 'top-mcp-for-docker',
    title: {
      en: 'Best MCP Servers for Docker & Containers',
      zh: 'Docker 和容器的最佳 MCP 服务器',
      ja: 'Dockerとコンテナに最適なMCPサーバー',
      ko: 'Docker 및 컨테이너를 위한 최고의 MCP 服务器',
    },
    description: {
      en: 'Find MCP servers that help manage Docker containers, Kubernetes clusters, and cloud infrastructure.',
      zh: '查找帮助管理 Docker 容器、Kubernetes 集群和云基础设施的 MCP 服务器。',
      ja: 'Dockerコンテナ、Kubernetesクラスター、クラウドインフラストラクチャの管理を支援するMCPサーバーを見つけます.',
      ko: 'Docker 컨테이너, Kubernetes 클러스터, 클라우드 인프라 관리를 지원하는 MCP 서버를 찾으세요.',
    }
  },
  {
    slug: 'top-mcp-for-vscode',
    title: {
      en: 'Best MCP Servers for VS Code',
      zh: 'VS Code 的最佳 MCP 服务器',
      ja: 'VS Codeに最適なMCPサーバー',
      ko: 'VS Code를 위한 최고의 MCP 服务器',
    },
    description: {
      en: 'Discover MCP servers that enhance VS Code with AI-powered code completion, refactoring, and developer productivity.',
      zh: '发现通过 AI 驱动的代码补全、重构和开发者生产力增强 VS Code 的 MCP 服务器。',
      ja: 'AI驅動のコード補完、リファクタリング、開発者生産性でVS Codeを強化するMCPサーバーを発見します.',
      ko: 'AI 기반 코드 완료, 리팩토링, 개발자 생산성으로 VS Code를 강화하는 MCP 서버를 발견하세요.',
    }
  },
  {
    slug: 'top-mcp-for-jetbrains',
    title: {
      en: 'Best MCP Servers for JetBrains IDEs',
      zh: 'JetBrains IDE 的最佳 MCP 服务器',
      ja: 'JetBrains IDEに最適なMCPサーバー',
      ko: 'JetBrains IDE를 위한 최고의 MCP 服务器',
    },
    description: {
      en: 'Find MCP servers that integrate with JetBrains IDEs like IntelliJ, WebStorm, and PyCharm for enhanced development experience.',
      zh: '查找与 IntelliJ、WebStorm 和 PyCharm 等 JetBrains IDE 集成以增强开发体验的 MCP 服务器。',
      ja: 'IntelliJ、WebStorm、PyCharmなどのJetBrains IDEと統合し、開発体験を強化するMCPサーバーを見つけます.',
      ko: '향상된 개발 경험을 위해 IntelliJ, WebStorm, PyCharm과 같은 JetBrains IDE와 통합되는 MCP 서버를 찾으세요.',
    }
  },
  {
    slug: 'top-mcp-for-healthcare',
    title: {
      en: 'Best MCP Servers for Healthcare & Medical',
      zh: '医疗健康领域的最佳 MCP 服务器',
      ja: 'ヘルスケア・医療に最適なMCPサーバー',
      ko: '헬스케어 및 의료를 위한 최고의 MCP 服务器',
    },
    description: {
      en: 'Discover MCP servers designed for healthcare applications, medical data processing, and HIPAA-compliant AI workflows.',
      zh: '发现专为医疗应用、医学数据处理和符合 HIPAA 的 AI 工作流设计的 MCP 服务器。',
      ja: '医療アプリケーション、医療データ処理、HIPA準拠のAIワークフロ向けに設計されたMCPサーバーを発見します.',
      ko: '의료 애플리케이션, 의료 데이터 처리, HIPAA 호환 AI 워크플로를 위해 설계된 MCP 서버를 발견하세요.',
    }
  },
  {
    slug: 'top-mcp-for-fintech',
    title: {
      en: 'Best MCP Servers for Fintech & Finance',
      zh: '金融科技领域的最佳 MCP 服务器',
      ja: 'フィンテック・金融に最適なMCPサーバー',
      ko: '파이낸스 및 금융을 위한 최고의 MCP 服务器',
    },
    description: {
      en: 'Find MCP servers for financial data analysis, trading automation, and secure transaction processing.',
      zh: '查找用于金融数据分析、交易自动化和安全交易处理的 MCP 服务器。',
      ja: '金融データ分析、取引自動化、安全な取引処理のためのMCPサーバーを見つけます.',
      ko: '금융 데이터 분석, 거래 자동화, 안전한 트랜잭션 처리를 위한 MCP 서버를 찾으세요.',
    }
  },
];

const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'];

function generateCollection(slug: string, baseData: any) {
  const collection: any = {
    title: {},
    description: {},
    seoTitle: {},
    seoDescription: {},
    keywords: {},
    featured: false,
    category: 'developer-tools',
    skills: [],  // Required field - will be populated later
    longDescription: {},
  };

  LOCALES.forEach(locale => {
    const baseTitle = baseData.title[locale] || baseData.title.en;
    const baseDesc = baseData.description[locale] || baseData.description.en;
    const year = new Date().getFullYear();
    
    collection.title[locale] = baseTitle;
    collection.description[locale] = baseDesc;
    collection.seoTitle[locale] = `${baseTitle} ${year} | Killer-Skills`;
    collection.seoDescription[locale] = baseDesc.substring(0, 150);
    collection.longDescription[locale] = baseDesc; // Use description as longDescription for now
    
    // Generate keywords
    const keywords = [
      'mcp', 'mcp server', 'model context protocol',
      slug.replace('top-mcp-for-', '').replace(/-/g, ' ')
    ];
    collection.keywords[locale] = [...new Set(keywords)];
  });

  return collection;
}

function main() {
  const collectionsDir = 'src/content/collections';
  let created = 0;
  
  console.log('Creating missing long-tail collection pages...\n');
  
  newCollections.forEach(({ slug, title, description }) => {
    const filePath = path.join(collectionsDir, `${slug}.json`);
    
    if (fs.existsSync(filePath)) {
      console.log(`⏭️  Skipped: ${slug} (already exists)`);
      return;
    }
    
    const collection = generateCollection(slug, { title, description });
    
    fs.writeFileSync(filePath, JSON.stringify(collection, null, 2) + '\n');
    console.log(`✅ Created: ${slug}`);
    created++;
  });
  
  console.log(`\n✨ Done! Created ${created} new collections.`);
}

main();
