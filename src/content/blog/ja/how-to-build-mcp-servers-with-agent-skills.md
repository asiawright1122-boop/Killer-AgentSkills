---
title: "MCPサーバーの構築方法：Agent Skillsを使用した完全ガイド"
description: "公式のmcp-builderスキルを使用して、AIエージェント向けの本番環境対応のMCPサーバーを構築する方法を学びます。TypeScriptとPythonを使用したセットアップ、ツール設計、テスト、デプロイメントを網羅しています。"
pubDate: 2026-02-13
author: "Killer-Skills チーム"
tags: ["MCP", "チュートリアル", "Agent Skills", "Claude Code"]
lang: "ja"
featured: false
category: "developer-experience"
heroImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2560&auto=format&fit=crop"
---

# AIエージェントが実際に使用するMCPサーバーの構築方法

もし、あなたのAIコーディングエージェントがコードを書くだけでなく、それ以上のことができたらどうでしょうか？Slackメッセージの送信、データベースのクエリ、本番環境へのデプロイ、そしてDevOpsパイプライン全体の管理を、標準化されたプロトコルを通じて実行できたら？

それこそが **MCPサーバー** (Model Context Protocol) が可能にすることです。Anthropicのスキルリポジトリにある公式の **mcp-builder** スキルを使用すれば、本番グレードのMCPサーバーを数時間ではなく数分で構築できます。

```bash
# ワンコマンドでmcp-builderスキルをインストール
npx killer-skills add anthropics/skills/mcp-builder
```

このガイドでは、プロトコルの理解から最初のサーバーのデプロイまで、MCPサーバーの構築について知っておくべきすべてのことを学びます。

## MCPサーバーとは何か？

**MCPサーバー** は、AIエージェントが利用できるツール、リソース、プロンプトを公開する標準化されたサービスです。あなたのAIアシスタントと、データベース、API、ファイルシステム、クラウドサービスなどの現実世界との間の架け橋と考えてください。

**Model Context Protocol** (MCP) は、AIエージェントが外部サービスとやり取りするためのユニバーサルな方法を必要としているという根本的な問題を解決するために、Anthropicによって作成されました。MCP以前は、統合ごとにカスタムコードが必要でした。現在では、単一のプロトコルですべてを処理できます。

MCPが重要な理由は次のとおりです。

-   **ユニバーサルな互換性** — Claude、Cursor、Windsurf、およびあらゆるMCP互換クライアントで動作します。
-   **標準化されたインターフェース** — ツール、リソース、プロンプトは一貫したスキーマに従います。
-   **セキュリティ重視の設計** — 認証、入力検証、権限管理が組み込まれています。
-   **構成可能なワークフロー** — エージェントは複数のMCPツールを組み合わせることができます。

## なぜ mcp-builder スキルを使用するのか？

**mcp-builder** スキルは、Anthropicの公式リポジトリで最も強力なスキルの1つです。これは、次の機能を提供することで、Claudeを専門のMCPサーバー開発者に変えます。

1.  **深いプロトコル知識** — スキルは完全なMCP仕様をロードするため、Claudeは細部まで理解します。
2.  **ベストプラクティスの組み込み** — ツールの命名、エラー処理、ページネーションのパターンが事前に構成されています。
3.  **フレームワーク固有のガイド** — TypeScriptとPythonの両方に最適化されたテンプレート。
4.  **評価(Evaluation)の生成** — MCPサーバー用のテストスイートを自動的に作成します。

一から構築するのとは異なり、mcp-builderスキルは構造化された4フェーズのワークフローに従います。

| フェーズ | 行われること |
|:------|:-------------|
| **フェーズ 1: リサーチ** | APIの調査、ツール適用範囲の計画、スキーマの設計 |
| **フェーズ 2: 構築** | 適切なエラー処理と認証を備えたサーバーの実装 |
| **フェーズ 3: レビュー** | すべてのツールのテスト、レスポンスの検証、エッジケースのチェック |
| **フェーズ 4: 評価** | 品質を検証するための自動評価の作成 |

## はじめに：最初のMCPサーバーを構築する

### ステップ 1: スキルのインストール

まず、Killer-Skills CLIがインストールされていることを確認してください。

```bash
npm install -g killer-skills
```

次に、プロジェクトに mcp-builder スキルを追加します。

```bash
npx killer-skills add anthropics/skills/mcp-builder
```

スキルは `.claude/skills/` ディレクトリに追加され、ClaudeがMCPサーバー開発タスクを検出すると自動的にアクティブ化されます。

### ステップ 2: スタックを選択する

mcp-builderスキルは主に2つのスタックをサポートしています。

**TypeScript (推奨)**
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
```

TypeScriptが推奨される理由はいくつかあります。
-   公式MCPチームによる高品質なSDKサポート
-   静的型付けによるランタイム前のエラー検知
-   実行環境との強力な互換性
-   AIモデルはTypeScriptコードの生成に優れている

**Python**
```bash
pip install mcp pydantic
```

チームがすでにPythonを使用している場合や、Python中心のAPIを統合する場合には、Pythonが最適な選択肢です。

### ステップ 3: ツールを定義する

優れたMCPサーバーの鍵は、適切に設計されたツールです。テンプレートは次のとおりです。

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
    tags: z.array(z.string()).optional().describe("分類用のタグ"),
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

### ステップ 4: ベストプラクティスを実装する

mcp-builderスキルは、いくつかの重要なパターンを強制します。

**ツールの命名規則**
```
✅ github_create_issue
✅ slack_send_message
✅ db_query_users

❌ createIssue
❌ send
❌ doStuff
```

一貫したプレフィックス（サービス名）＋アクション指向の動詞を使用してください。これにより、エージェントが適切なツールをすばやく見つけて選択できるようになります。

**実用的なエラーメッセージ**
```typescript
// ❌ 悪い例
throw new Error("Not found");

// ✅ 良い例
throw new Error(
  `リポジトリ "${owner}/${repo}" が見つかりませんでした。` +
  `リポジトリが存在し、アクセス権があることを確認してください。` +
  `まず github_list_repos でリポジトリを一覧表示してみてください。`
);
```

**ツールのアノテーション**

すべてのツールには、エージェントがその動作を理解するのに役立つアノテーションを含める必要があります。

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

## 実例：GitHub MCPサーバーの構築

現実的な例を見てみましょう。AIエージェントがGitHubリポジトリを管理できるようにするMCPサーバーを構築するとします。

**mcp-builderスキルがアクティブな状態でClaudeに依頼します。**

> 「GitHub API用のMCPサーバーを構築してください。問題(Issue)の作成、リポジトリの一覧表示、プルリクエストの管理、コードの検索をサポートする必要があります。」

Claudeは次のことを行います。
1.  GitHub REST APIドキュメントをリサーチする
2.  どのエンドポイントをカバーするか計画する（通常15〜25個のツール）
3.  適切なOAuth認証を備えた完全なサーバーを構築する
4.  各ツールのテスト評価を生成する

結果は、適切なエラー処理、ページネーション、レート制限、認証を備えた本番環境対応のサーバーです。これは通常、手動で構築するのに数日かかるものです。

## MCPサーバーの主要な設計原則

### APIカバレッジ vs. ワークフローツール

mcp-builderスキルは重要なバランスを教えます。

-   **包括的なカバレッジ** は、エージェントに操作を組み合わせる柔軟性を与えます。
-   **ワークフローツール** は、一般的なマルチステップの操作を単一の呼び出しにまとめます。
-   不明な場合は、包括的なAPIカバレッジを優先してください。

### コンテキスト管理

エージェントは、焦点を絞った関連データを使用して最高のパフォーマンスを発揮します。

-   APIレスポンス全体ではなく、エージェントが必要なフィールドのみを返します。
-   リスト操作のページネーションをサポートします。
-   結果を絞り込むためのフィルターを含めます。

### テストと評価

mcp-builderスキルは、以下をテストする自動評価を生成します。

-   **ハッピーパス** — 有効な入力での正常な動作
-   **エッジケース** — 空の結果、大規模なデータセット、特殊文字
-   **エラー処理** — 無効な入力、認証失敗、レート制限
-   **現実的なシナリオ** — ツールを組み合わせたマルチステップのワークフロー

## Killer-Skills経由でのインストール

開始する最も速い方法は、Killer-Skillsマーケットプレイスを経由することです。

```bash
# 公式スキルをブラウズ
npx killer-skills search mcp

# mcp-builderをインストール
npx killer-skills add anthropics/skills/mcp-builder

# インストールを確認
npx killer-skills list
```

インストールすると、スキルはClaude Code、Claude.ai、およびあらゆるClaude API統合で自動的に利用可能になります。MCPサーバーの構築に関する会話を開始するだけで、Claudeはスキルの指示をロードします。

## 次のステップは？

MCPサーバーは、AIエージェントが世界とやり取りする標準的な方法になりつつあります。mcp-builderスキルがあれば、あなたはMCPプロトコルの専門家である必要はありません。サーバーが何をすべきかに集中している間、Claudeが複雑な処理をこなします。

最初のMCPサーバーを構築する準備はできましたか？今日から始める方法は次のとおりです。

1.  **スキルをインストールする**: `npx killer-skills add anthropics/skills/mcp-builder`
2.  **APIを選択する**: 統合したいサービス（Slack、Notion、JIRAなど）を選択します。
3.  **ニーズを説明する**: 必要なツールをClaudeに伝えると、サーバー全体が構築されます。
4.  **デプロイしてテストする**: 生成された評価(Evaluations)を使用してサーバーを検証します。

AI開発の未来は、より多くのコードを書くことではなく、AIエージェントに適切なツールを与えることです。MCPサーバーとAgent Skillsは、その未来を今日可能にします。

---

*さらなるスキルを探索したいですか？ [Killer-Skillsマーケットプレイス](https://killer-skills.com/ja/skills)にアクセスして、あなたのAIコーディングワークフローのための何百もの検証済みAgent Skillsを見つけてください。*
