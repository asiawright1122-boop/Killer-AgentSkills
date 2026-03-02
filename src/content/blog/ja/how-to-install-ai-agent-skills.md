---
title: "30"
description: "CLI"
pubDate: 2026-02-24
author: "Killer-Skills Team"
tags: ["Tutorial", "AI Agent Skills", "CLI", "Developer Tools", "Automation"]
lang: "ja"
featured: false
category: "guides"
heroImage: "https://images.unsplash.com/photo-1629654297299-c8506221ca97?q=80&w=2560&auto=format&fit=crop"
---
# AIエージェントのスキルをインストールする方法

あなたは使用したいAIエージェントのスキルを見つけた。たぶんそれは、[docx自動化スキル](/en/skills/anthropics/skills/docx)か、特殊なフロントエンドUIジェネレーターである。ここで、あなたはそれをプロジェクトに組み込む必要があるので、コーディングエージェントが実際にそれを読むことができるようになる。

あなたは手動でマークダウンテキストをコピーして貼り付け、正しいディレクトリを作成し、フロントマターのフォーマットを自分で修正することができます。あるいは、すべてを自動化する1つのコマンドを実行することができます。
## The killer-skills CLI

私たちはこれ専用のコマンドラインツールを作成しました。これは、GitHubからスキルを取得し、IDE (Claude Code、Cursor、Windsurf、またはGitHub Copilot) に適した形式に変換し、正しいディレクトリに配置することを扱います。

永久的にインストールする必要はありません。Node.js に付属する `npx` を介して直接実行できます。

ターミナルを開き、プロジェクトディレクトリに移動し、次のコマンドを実行します：

```bash
npx killer-skills add <owner>/<repo>/<skill-name>
```

例えば、PDF自動化スキルをインストールするには、次のコマンドを実行します：

```bash
npx killer-skills add anthropics/skills/pdf
```

CLI はプロジェクトファイルを調べて、使用している IDE を検出します。 `.cursor` ディレクトリが見つかると、スキルを `.mdc` ファイルとしてフォーマットします。 `.claude` ディレクトリが見つかると、`SKILL.md` としてフォーマットします。
## 複数のIDEでのインストール

同一プロジェクトで複数のエージェントを使用する場合（たとえば、ターミナルでClaude Codeを使用し、Cursorをエディターとして使用する場合）、CLIにすべてのエージェントに対してスキルを一度にインストールするように強制できます。

`--all` フラグを追加するだけです：

```bash
npx killer-skills add anthropics/skills/pdf --all
```

これにより、`.claude/skills/` と `.cursor/rules/` の両方に必要なファイルが作成され、コアの指示は同一のままですが、メタデータは各エージェントに正しくフォーマットされます。
## スキルをインストールするための検索

正確なリポジトリパスを覚えていない場合でも、ターミナルから直接検索できます：

```bash
npx killer-skills search auth
```

コミュニティデータベースを検索して、スター数やフルインストールパスを含む上位の一致を返します。さらに、[Killer-Skills ウェブサイト](/en/skills)でオープンソースディレクトリを全て閲覧することもできます。
## スキルの最新化

スキルは進化します。著者は新しいエッジケースを追加し、悪い説明を修正し、プロンプトの信頼性を向上させます。CLI経由でスキルをインストールしたため、同じように簡単に更新できます。

```bash
npx killer-skills update
```

これにより、インストールしたすべてのスキルをチェックし、GitHub上のアップストリームソースと比較し、可能な限りローカル変更を保存しながら更新を適用します。
## 実際に何が起こっているのか？

`add` コマンドを実行すると、CLI は実行可能なソフトウェアや npm の依存関係をインストールしません。ただテキストをダウンロードするだけです。

スキルは、単に Large Language Model に対する指示を含む Markdown ファイルです。CLI は、その Markdown を取得し、エディターが期待する特定の YAML または JSON形式でラップし、ローカルフォルダーに書き込みます。

バックグラウンドプロセスはありません。電話ホームのテレメトリーや隠れたペイロードもありません。ただのドキュメントで、AI エージェントがそれを探す場所に正確に配置されます。

---
* 関連情報: [AI エージェントのスキルとは何か？](/ja/blog/what-are-ai-agent-skills) と [2026 年のベスト AI エージェントスキル](/ja/blog/best-ai-agent-skills-2026)