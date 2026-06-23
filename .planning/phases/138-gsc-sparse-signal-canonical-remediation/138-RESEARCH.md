# Phase 138 Research: GSC Sparse-Signal & Canonical Remediation

## 1. Context & Objectives

The latest Google Search Console (GSC) Opportunity Board report (dated 2026-06-23) identifies 20 sparse-signal pages with 0.00% CTR. Our objectives for Phase 138 are:
1. **Optimize Sparse-Signal Pages**: Set tailored, high-intent titles and meta descriptions for key target pages (`Yorick-Ryu/deep-share`, `akiojin/llmlb`, `agentjido/jido_signal`, `takuto-tanaka-4digit/excel-unidiff-cli`) in their respective locales.
2. **Review Edge Redirections**: Ensure that trailing-slash variations and `www` hostnames are correctly 301-redirected, preventing index bloat or drift.

## 2. Sparse-Signal Metadata Overrides

We will implement hardcoded overrides in the skill detail routing script (`src/pages/[locale]/skills/[owner]/[...repo].astro`) to serve refined titles and descriptions for high-impression, low-CTR queries.

### Override Mapping Strategy

- **`Yorick-Ryu/deep-share`**
  - **`en` Title**: `deep-share: Convert Markdown to Word (DOCX) in Claude Code`
  - **`en` Desc**: `Use the deep-share skill in Claude Code, Cursor, or Windsurf to convert Markdown files to styled Word documents (.docx) with one command.`
  - **`ja` Title**: `deep-share: MarkdownをWord (docx) に変換するClaude Codeスキル`
  - **`ja` Desc**: `Claude CodeやCursor、Windsurf環境で、コマンド1つでMarkdownファイルをWord（.docx形式）に変換して出力できる検証済みツール。`

- **`akiojin/llmlb`**
  - **`en` Title**: `llmlb: LLM Load Balancer & Routing Proxy for Claude Code`
  - **`en` Desc**: `Configure and run llmlb load balancer to route LLM requests efficiently across backup providers in Claude Code, Cursor, and Windsurf.`
  - **`ru` Title**: `llmlb: Балансировщик нагрузки LLM для Claude Code`
  - **`ru` Desc**: `Инструмент llmlb для балансировки и проксирования запросов к моделям ИИ в окружении Claude Code, Cursor и Windsurf.`

- **`agentjido/jido_signal`**
  - **`en` Title**: `jido_signal: Event Signals & PubSub for Elixir AI Agents`
  - **`en` Desc**: `Integrate event-driven PubSub signals into your Elixir agents. Verified setup for jido_signal in Claude Code, Cursor, and Windsurf.`
  - **`de` Title**: `jido_signal: Ereignissignale für Elixir KI-Agenten`
  - **`de` Desc**: `Installieren Sie jido_signal, um ereignisgesteuerte PubSub-Signale in Ihre Elixir-Agenten in Claude Code, Cursor und Windsurf zu integrieren.`

- **`takuto-tanaka-4digit/excel-unidiff-cli`**
  - **`en` Title**: `excel-unidiff-cli: Compare Excel Sheets via Diff in Claude Code`
  - **`en` Desc**: `Run excel-unidiff-cli in Claude Code, Cursor, or Windsurf to compare Excel sheets, highlighting data deltas in unified diff format.`
  - **`ja` Title**: `excel-unidiff-cli: Excelシートの差分をCLIで比较・確認`
  - **`ja` Desc**: `Claude CodeやCursor、WindsurfからExcelファイルを直接読み込み、データの差分を unified diff 形式で確認できる便利ツール。`

## 3. Redirection Audits

- **Www to Non-Www Redirect**: Handled in `src/middleware.ts` (lines 520-530). Matches `hostname === www.SITE_DOMAIN` and redirects via 301.
- **Trailing Slash Redirect**: Handled in `src/middleware.ts` (lines 544-598). Replaces trailing slash with an empty string and redirects via 301.
- **Sitemap Purity**: Checked via `tests/pages/sitemaps.test.ts`.

## 4. Verification Methods

1. **Local Dev Test**: Verify that request overrides generate correct title and meta attributes when running queries against these specific skill pages.
2. **Vitest Regression Check**: Run the test suites.
3. **Production Astro Build Check**: Execute `npm run build` to verify routing integration.
