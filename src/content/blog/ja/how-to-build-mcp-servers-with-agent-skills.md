---
title: "MCPサーバーの構築方法：エージェントスキルを使った完全ガイド"
description: "MCPサーバーの構築方法を完全にマスターする。公式mcp-builderスキルを使ったTypeScriptとPythonのセットアップを完全に学びましょう。Learn now"
pubDate: 2026-02-13
author: "Killer-Skills Team"
tags: ["MCP", "Tutorial", "Agent Skills", "Claude Code"]
lang: "ja"
featured: false
category: "developer-experience"
heroImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2560&auto=format&fit=crop"
---
# MCPサーバーの構築方法: AIエージェントが実際に利用するサーバー

あなたのAIコーディングエージェントがコードを書くだけでなく、Slackメッセージを送信したり、データベースを照会したり、プロダクションにデプロイしたり、DevOpsパイプラインを管理したりできるような場合を想像してみてください。すべてが標準化されたプロトコルを通じて実現できるということです。

これは、まさに**MCPサーバー**（Model Context Protocol）が可能にするものです。Anthropicのスキルリポジトリからの公式の**mcp-builder**スキルを使用すると、数分で本番レベルのMCPサーバーを構築できます。

```bash
# mcp-builderスキルを1つのコマンドでインストール
npx killer-skills add anthropics/skills/mcp-builder
```

このガイドでは、MCPサーバーの構築方法について、プロトコルを理解することから最初のサーバーのデプロイまで、必要なすべてのことを学習します。
## MCPサーバーとは？

MCPサーバーは、AIエージェントが利用できるツール、リソース、プロンプトを提供する標準化されたサービスです。AIアシスタントと実世界 — データベース、API、ファイルシステム、クラウドサービスなど — の間の橋として考えることができます。

**モデルのコンテキストプロトコル** (MCP)は、Anthropicによって作成されました。AIエージェントが外部サービスとやり取りするための普遍的な方法が必要だったという基本的な問題を解決するためにです。MCP以前は、すべての統合にはカスタムコードが必要でした。現在、単一のプロトコルですべてを処理できます。

MCPが重要な理由は以下のとおりです:

- **ユニバーサルな互換性** — Claude、Cursor、Windsurf、そして任意のMCP互換クライアントで動作します
- **標準化されたインターフェイス** — ツール、リソース、プロンプトは一貫したスキーマに従います
- **セキュリティを第一にした設計** — 認証、入力検証、パーミッション制御が組み込まれています
- **構成可能なワークフロー** — エージェントは複数のMCPツールを連結して使用できます
## Why Use the mcp-builder Skill?

The **mcp-builder** スキルは、Anthropic の公式リポジトリで最も強力なスキルの一つです。以下の機能を提供することで、Claude を専門の MCP サーバー開発者に変えることができます:

1. **深いプロトコル知識** — スキルは MCP の完全な仕様を読み込み、Claude が細部まで理解できるようにします
2. **ベストプラクティスが組み込まれている** — ツール名、エラーハンドリング、ページネーションパターンなどがすべて事前に設定されています
3. **フレームワーク固有のガイド** — TypeScript と Python の両方に対応した最適化されたテンプレート
4. **評価生成** — MCP サーバーのテストスイートを自動で生成します

スクラッチからビルドすることとは異なり、mcp-builder スキルは構造化された 4 つのフェーズのワークフローに従います:

| フェーズ | どうなる |
|:------|:-------------|
| **フェーズ 1: 研究** | API を研究し、ツールのカバー範囲を計画し、スキーマを設計します |
| **フェーズ 2: ビルド** | エラーハンドリングや認証を適切に行ったサーバーを実装します |
| **フェーズ 3: レビュー** | すべてのツールをテストし、レスポンスを検証し、エッジケースを確認します |
| **フェーズ 4: 評価** | 品質を検証する自動評価を生成します |
## Getting Started: Build Your First MCP Server

### Step 1: Install the Skill

First, make sure you have the Killer-Skills CLI installed:

```bash
npm install -g killer-skills
```

Then add the mcp-builder skill to your project:

```bash
npx killer-skills add anthropics/skills/mcp-builder
```

The skill will be added to your `.claude/skills/` directory and automatically activated when Claude detects MCP server development tasks.

### Step 2: Choose Your Stack

The mcp-builder skill supports two primary stacks:

**TypeScript (Recommended)**
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
```

TypeScriptは、以下の理由からお勧めされています：
- 公式MCPチームからの高品質なSDKサポート
- 静的型付けにより、ランタイム前にエラーを検出できる
- 強力な実行環境との互換性
- AIモデルはTypeScriptコードを生成するのに優れています

**Python**
```bash
pip install mcp pydantic
```

Pythonは、チームがすでにPythonを使用しているか、PythonヘビーのAPIと統合する場合に適した選択です。

### Step 3: Define Your Tools

優れたMCPサーバーの鍵は、よく設計されたツールです。以下はテンプレートです：

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "my-api-server",
  version: "1.0.0",
});

server.tool(
  "create_item",
  "システムに新しいアイテムを作成します",
  {
    name: z.string().describe("作成するアイテムの名前"),
    description: z.string().optional().describe("オプションの説明"),
    tags: z.array(z.string()).optional().describe("カテゴリ化のためのタグ"),
  },
  async ({ name, description, tags }) => {
    const result = await api.createItem({ name, description, tags });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);
```

### Step 4: Implement Best Practices

mcp-builderスキルは、いくつかの重要なパターンを強制します：

**ツールの命名規則**
```
✅ github_create_issue
✅ slack_send_message
✅ db_query_users

❌ createIssue
❌ send
❌ doStuff
```

一貫したプレフィックス（サービス名）+ アクション指向の動詞を使用します。これにより、エージェントが正しいツールを簡単に発見して選択できます。

**実行可能なエラーメッセージ**
```typescript
// ❌ 悪い
throw new Error("見つかりませんでした");

// ✅ 良い
throw new Error(
  `"${owner}/${repo}" リポジトリが見つかりませんでした。 ` +
  `リポジトリが存在し、アクセスできることを確認してください。 ` +
  `まずgithub_list_reposでリポジトリをリストすることを試してください。`
);
```

**ツールの注釈**

各ツールには、エージェントがツールの動作を理解するのに役立つ注釈が含まれている必要があります：

```typescript
server.tool(
  "delete_item",
  "アイテムを永久に削除します",
  { id: z.string() },
  async ({ id }) => { /* ... */ },
  {
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    }
  }
);
```
## 実践的な例: GitHub MCPサーバーの構築

実際の例を見てみましょう。GitHubリポジトリをAIエージェントが管理できるMCPサーバーを構築したいとします。

**mcp-builderスキルを有効にしてClaudeに聞いてみましょう:**

> "GitHub API用のMCPサーバーを構築してください。Issueの作成、リポジトリのリスト表示、プルリクエストの管理、コードの検索をサポートするようにしてください。"

Claudeは:
1. GitHub REST APIのドキュメントを調査します
2. カバーするエンドポイントを計画します（通常、15〜25のツール）
3. 正しいOAuth認証を備えた完全なサーバーを構築します
4. 各ツールのテスト評価を生成します

結果は、適切なエラーハンドリング、ペジネーション、レート制限、認証を備えた本番環境向けのサーバーになります。通常、手動で構築するには数日かかる作業です。
## キーデザインプリンシプル for MCPサーバー

### APIカバレッジ vs. ワークフロー ツール

mcp-builder スキルは、重要なバランスの学習を教えてくれます:

- **包括的なカバレッジ** は、エージェントに操作の組み立てを自由に行えるようにします
- **ワークフロー ツール** は、一般的な多段階の操作を単一の呼び出しにバンドルします
- 不確実な場合、包括的な API カバレッジを優先します

### コンテキスト管理

エージェントは、焦点を当てた、関連のあるデータで最も効果的に動作します:

- エージェントが必要とするフィールドのみを返し、全APIレスポンスを返さない
- リスト操作のページネーションをサポート
- 結果を絞り込むためのフィルタを含める

### テストと評価

mcp-builder スキルは、自動評価を生成し、以下のものをテストします:

- **ハッピーパス** — 有効な入力で正常な動作
- **エッジケース** — 空の結果、大きなデータセット、特殊文字
- **エラーハンドリング** — 無効な入力、認証失敗、レート制限
- **実際のシナリオ** — ツールを連結してワークフローを形成する多段階のワークフロー
## Killer-Skillsを介してのインストール

最も迅速な開始方法は、Killer-Skillsマーケットプレイスを通じて行うことです：

```bash
# 公式のスキルをブラウズ
npx killer-skills search mcp

# mcp-builderをインストール
npx killer-skills add anthropics/skills/mcp-builder

# インストールを検証
npx killer-skills list
```

インストール後、スキルは自動的にClaude Code、Claude.ai、またClaude APIのすべての統合で利用可能になります。MCPサーバーの構築について会話を開始すると、Claudeはスキルの指示を読み込みます。
## 次のステップ

MCPサーバーは、AIエージェントが世界とやり取りするための標準的な方法となりつつあります。mcp-builderスキルを使用することで、MCPプロトコルについて詳しく知る必要はありません — クロードが複雑さを処理し、サーバーが何を行うべきかを集中できます。

最初のMCPサーバーの構築を開始する準備はできましたか？ここでは、今日から始める方法を紹介します：

1. **スキルのインストール**: `npx killer-skills add anthropics/skills/mcp-builder`
2. **APIの選択**: 統合したいサービスを選択してください (Slack、Notion、JIRAなど)
3. **ニーズの説明**: クロードに必要なツールを伝え、サーバー全体を構築してくれます
4. **デプロイとテスト**: 生成された評価を使用してサーバーを検証します

AI開発の将来は、より多くのコードを書くことではなく、AIエージェントに正しいツールを提供することです。MCPサーバーとエージェントスキルは、その将来を今日可能にします。

---

*さらにスキルを探す？[Killer-Skills Marketplace](https://killer-skills.com/ja/skills)を閲覧して、AIコーディングワークフロー用の数百の検証済みエージェントスキルを発見してください.*

---

*関連：[AIエージェントスキルとは？](/ja/blog/what-are-ai-agent-skills)と[2026年のベストAIエージェントスキル](/ja/blog/best-ai-agent-skills-2026)*